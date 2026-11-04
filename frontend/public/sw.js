const CACHE = 'grain-vision-pwa-v3'
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/offline-defaults.json',
]

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.addAll(APP_SHELL)

    // Vite fingerprints production JS and CSS. Read their current URLs from
    // index.html so the shell and styles are ready before the device goes offline.
    const response = await fetch('/index.html', { cache: 'reload' })
    if (response.ok) {
      const html = await response.clone().text()
      await cache.put('/index.html', response.clone())
      const assetUrls = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']/g)]
        .map(match => new URL(match[1], self.location.origin))
        .filter(url => url.origin === self.location.origin)
      await Promise.all(assetUrls.map(url => cache.add(url.href).catch(() => undefined)))
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('grain-vision-pwa-') && key !== CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // Network first keeps route and content responses current, with a cached
  // shell or asset available when the field connection drops.
  event.respondWith((async () => {
    try {
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(CACHE)
        await cache.put(request, response.clone())
      }
      return response
    } catch {
      const cached = await caches.match(request)
      if (cached) return cached
      if (request.mode === 'navigate') return (await caches.match('/index.html')) || Response.error()
      return Response.error()
    }
  })())
})
