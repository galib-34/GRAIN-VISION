import type { SaveLotPayload } from './api'
import { saveLotTransaction } from './api'

const DB_NAME = 'grain-vision-offline'
const STORE_NAME = 'pending-lots'
export interface QueuedLot { key: string; queued_at: string; payload: SaveLotPayload }

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not open the offline lot queue.'))
  })
}

export async function queueLot(payload: SaveLotPayload): Promise<void> {
  const db = await openQueueDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put({ key: crypto.randomUUID(), queued_at: new Date().toISOString(), payload } satisfies QueuedLot)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('Could not save this lot for later sync.'))
    transaction.onabort = () => reject(transaction.error || new Error('Offline queue update was interrupted.'))
  })
  db.close()
}

export async function queuedLotCount(): Promise<number> {
  const db = await openQueueDb()
  const count = await new Promise<number>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not read the offline lot queue.'))
  })
  db.close()
  return count
}

export async function syncQueuedLots(): Promise<number> {
  if (!navigator.onLine) return 0
  const db = await openQueueDb()
  const entries = await new Promise<QueuedLot[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result as QueuedLot[])
    request.onerror = () => reject(request.error || new Error('Could not read queued lots.'))
  })
  db.close()

  let synced = 0
  for (const entry of entries) {
    try {
      await saveLotTransaction(entry.payload)
      const writeDb = await openQueueDb()
      await new Promise<void>((resolve, reject) => {
        const transaction = writeDb.transaction(STORE_NAME, 'readwrite')
        transaction.objectStore(STORE_NAME).delete(entry.key)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error || new Error('Could not clear a synced lot.'))
        transaction.onabort = () => reject(transaction.error || new Error('Queue update was interrupted.'))
      })
      writeDb.close()
      synced++
    } catch {
      // Keep the failed entry and stop, preserving order for the next connection.
      break
    }
  }
  return synced
}
