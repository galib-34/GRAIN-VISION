import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Camera, Check, CheckCircle2, ChevronDown, Download, FileText, Flashlight, ImagePlus, Leaf, LoaderCircle, Plus, RefreshCw, ScanLine, Share2, ShieldCheck, Upload, UserRound, X } from 'lucide-react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import InspectionOutput from '@/components/InspectionOutput'
import type { ValuationResult } from '@/types/procurement'
import HistoryLedger from '@/components/HistoryLedger'
import DashboardMetrics from '@/components/DashboardMetrics'
import { fetchDashboardSummary, saveLotTransaction } from '@/services/api'
import Settings, { type DeductionRateSettings } from '@/components/Settings'
import { queueLot, queuedLotCount, syncQueuedLots } from '@/services/offlineLotQueue'
import Header from '@/components/Header'
import DashboardPage from '@/pages/DashboardPage'
import InspectionPage from '@/pages/InspectionPage'
import SettingsPage from '@/pages/SettingsPage'
import SupportPage from '@/pages/SupportPage'
import MobileBottomNav from '@/components/MobileBottomNav'
import PWAInstallCard from '@/components/PWAInstallCard'

const API = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/$/, '')
const currency = (value?: number | null) => value == null ? '—' : `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
type Farmer = { id: number; name: string; phone: string; location?: string; seller_code?: string }
type Detection = { class: string; confidence: number; box: { x1: number; y1: number; x2: number; y2: number }; normalized_box?: { x1: number; y1: number; x2: number; y2: number } }
type Lot = { lot_id: string; seller_name?: string; weight_kg?: number; quality_score?: number; total_estimated_price?: number; estimated_rate_per_kg?: number; status?: string; created_at?: string }
type Analysis = { metrics: Record<string, any>; decision: Record<string, any>; price_reference: Record<string, any>; fci_valuation?: ValuationResult; lot?: Lot; detections?: Detection[]; image?: { width: number; height: number }; model?: { name: string } }
type ValidationMetric = { label: string; value: string; detail: string; status: 'PASS' | 'WARNING' | 'FAIL' | 'UNAVAILABLE' }
type PriceReference = { modal_price_per_quintal: number; source: string; status?: string; warning?: string; provider?: string }
const DEFAULT_PRICE_REFERENCE: PriceReference = { modal_price_per_quintal: 2441, source: 'Default MSP Baseline (₹2,441/qtl)', status: 'default_baseline', provider: 'official_msp_baseline' }

const saved = <T,>(key: string, fallback: T): T => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback } }
export default function Application() {
  const location = useLocation()
  const [farmerId, setFarmerId] = useState(() => saved('gv-farmer', ''))
  const [farmerName, setFarmerName] = useState(() => saved('gv-farmer-name', ''))
  const [weight, setWeight] = useState(() => saved('gv-weight', '500'))
  const [weightUnit, setWeightUnit] = useState(() => saved<'kg' | 'qtl'>('gv-weight-unit', 'kg'))
  const [baseline, setBaseline] = useState(() => saved('gv-baseline', ''))
  const [manualPriceOverride, setManualPriceOverride] = useState(() => saved('gv-manual-price-override', false))
  const [priceReference, setPriceReference] = useState<PriceReference>(DEFAULT_PRICE_REFERENCE)
  const [refreshingPrice, setRefreshingPrice] = useState(false)
  const [manualMoisture, setManualMoisture] = useState(() => saved('gv-manual-moisture', ''))
  const [deductionRates, setDeductionRates] = useState<DeductionRateSettings>(() => saved('gv-deduction-rates', { chalky: 12, broken: 15, damaged_discolored: 20, sound_shortfall: 10 }))
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [stats, setStats] = useState<Record<string, any>>({})
  const [newFarmer, setNewFarmer] = useState(false)
  const [farmerForm, setFarmerForm] = useState({ name: '', phone: '', location: '', seller_code: '' })
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [savingTransaction, setSavingTransaction] = useState(false)
  const [toast, setToast] = useState('')
  const [pendingOfflineLots, setPendingOfflineLots] = useState(0)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 })
  const [validation, setValidation] = useState<ValidationMetric[]>([])
  const [loading, setLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'degraded' | 'offline'>('checking')
  const [error, setError] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [torch, setTorch] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [showFarmerModal, setShowFarmerModal] = useState(false)
  const [receiptLot, setReceiptLot] = useState<Lot | null>(null)
  const [decisionLot, setDecisionLot] = useState<Lot | null>(null)
  const [rejectReason, setRejectReason] = useState('Quality Below Minimum Threshold')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraCaptureRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageStageRef = useRef<HTMLDivElement>(null)
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null)
  const lastTapRef = useRef(0)

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = localStorage.getItem('grainvision_token')
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(`${API}${path}`, { ...init, headers })
    if (!response.ok) { let message = `${response.status} ${response.statusText}`; try { const body = await response.json(); message = body.message || body.detail || message } catch { /* retain HTTP status */ } throw new Error(message) }
    return response
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [sellerResponse, statsResponse, lotsResponse, transactionStats] = await Promise.all([request('/api/sellers'), request('/api/dashboard/stats'), request('/api/lots'), fetchDashboardSummary()])
      const sellerData = await sellerResponse.json(); const statsData = await statsResponse.json(); const lotData = await lotsResponse.json()
      setFarmers(sellerData.sellers || []); setStats({ ...statsData, total_lots: transactionStats.total_lots_assessed, accepted_lots: transactionStats.total_lots_accepted, rejected_lots: transactionStats.total_lots_rejected, total_procurement_value: transactionStats.total_procurement_value }); setLots(lotData.lots || [])
    } catch (e) { setError(`Backend unavailable: ${(e as Error).message}`) }
  }, [request])

  useEffect(() => {
    void refresh()
    void request('/api/health').then(r => r.json()).then(d => setApiStatus(d.status === 'ok' ? 'online' : 'degraded')).catch(() => setApiStatus('offline'))
    void request('/api/prices').then(r => r.json()).then(d => { const ref = d.andhra_pradesh_paddy_reference; if (ref?.modal_price_per_quintal) setPriceReference(ref) }).catch(() => {})
  }, [refresh, request])
  useEffect(() => {
    let active = true
    const updateCount = () => { void queuedLotCount().then(count => { if (active) setPendingOfflineLots(count) }).catch(() => {}) }
    const syncWhenOnline = () => {
      void syncQueuedLots().then(async count => {
        updateCount()
        if (count) { setToast(`${count} offline lot ${count === 1 ? 'record' : 'records'} synced.`); await refresh(); window.setTimeout(() => setToast(''), 4500) }
      }).catch(() => updateCount())
    }
    updateCount()
    window.addEventListener('online', syncWhenOnline)
    const markOnline = () => setIsOnline(true)
    const markOffline = () => setIsOnline(false)
    window.addEventListener('online', markOnline)
    window.addEventListener('offline', markOffline)
    if (navigator.onLine) syncWhenOnline()
    return () => { active = false; window.removeEventListener('online', syncWhenOnline); window.removeEventListener('online', markOnline); window.removeEventListener('offline', markOffline) }
  }, [refresh])
  useEffect(() => { localStorage.setItem('gv-farmer', JSON.stringify(farmerId)); localStorage.setItem('gv-farmer-name', JSON.stringify(farmerName)) }, [farmerId, farmerName])
  useEffect(() => { localStorage.setItem('gv-weight', JSON.stringify(weight)); localStorage.setItem('gv-weight-unit', JSON.stringify(weightUnit)); localStorage.setItem('gv-baseline', JSON.stringify(baseline)) }, [weight, weightUnit, baseline])
  useEffect(() => { localStorage.setItem('gv-manual-price-override', JSON.stringify(manualPriceOverride)) }, [manualPriceOverride])
  useEffect(() => { localStorage.setItem('gv-deduction-rates', JSON.stringify(deductionRates)) }, [deductionRates])
  useEffect(() => { localStorage.setItem('gv-manual-moisture', JSON.stringify(manualMoisture)) }, [manualMoisture])
  useEffect(() => { if (!file) { setPreviewUrl(''); setValidation([]); return } const url = URL.createObjectURL(file); setPreviewUrl(url); return () => URL.revokeObjectURL(url) }, [file])
  useEffect(() => { if (previewUrl) void validateImage(previewUrl).then(setValidation) }, [previewUrl])
  useEffect(() => { if (analysis && imageRef.current?.complete) drawBoxes() }, [analysis, previewUrl])
  useEffect(() => { setZoomLevel(1); setZoomOrigin({ x: 50, y: 50 }) }, [analysis])
  useEffect(() => {
    if (!analysis) return
    const container = imageStageRef.current
    if (!container) return
    let frame = 0
    const scheduleDraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(drawBoxes) }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleDraw) : null
    observer?.observe(container)
    window.addEventListener('resize', scheduleDraw)
    scheduleDraw()
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', scheduleDraw) }
  }, [analysis, previewUrl, location.pathname])
  useEffect(() => { if (cameraOpen) void startCamera(); else stopCamera(); return () => stopCamera() }, [cameraOpen, facing])

  async function validateImage(url: string): Promise<ValidationMetric[]> {
    try {
      const img = new Image(); img.src = url
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Image could not be decoded')) })
      const canvas = document.createElement('canvas'); const scale = Math.min(1, 640 / Math.max(img.width, img.height)); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('Canvas pixel access unavailable')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      const gray = new Float32Array(canvas.width * canvas.height); let sum = 0; let dark = 0; let bright = 0
      for (let i = 0, p = 0; i < pixels.length; i += 4, p++) { const y = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]; gray[p] = y; sum += y; if (y < 12) dark++; if (y > 245) bright++ }
      const mean = sum / gray.length; let variance = 0; let lapSum = 0; let lapSq = 0; let edge = 0
      for (let y = 1; y < canvas.height - 1; y++) for (let x = 1; x < canvas.width - 1; x++) { const i = y * canvas.width + x; const d = gray[i - 1] + gray[i + 1] + gray[i - canvas.width] + gray[i + canvas.width] - 4 * gray[i]; lapSum += d; lapSq += d * d; if (Math.abs(gray[i - 1] - gray[i + 1]) + Math.abs(gray[i - canvas.width] - gray[i + canvas.width]) > 55) edge++ }
      variance = Math.max(0, lapSq / Math.max(1, (canvas.width - 2) * (canvas.height - 2)) - (lapSum / Math.max(1, (canvas.width - 2) * (canvas.height - 2))) ** 2)
      const clipped = (dark + bright) / gray.length; const edgeRatio = edge / Math.max(1, (canvas.width - 2) * (canvas.height - 2))
      const lightStatus = mean < 45 || mean > 220 || clipped > 0.35 ? 'FAIL' : mean < 65 || mean > 195 || clipped > 0.15 ? 'WARNING' : 'PASS'
      const blurStatus = variance < 35 ? 'FAIL' : variance < 110 ? 'WARNING' : 'PASS'
      const densityStatus = edgeRatio < 0.025 || edgeRatio > 0.42 ? 'FAIL' : 'PASS'
      const densityDetail = edgeRatio < 0.025
        ? 'No grain sample detected. Please spread grains on a matte surface.'
        : edgeRatio > 0.42
          ? 'Texture is extremely dense. Spread grains apart on a matte surface.'
          : 'Texture density is within the sample readiness range.'
      return [
        { label: 'Exposure', value: `${Math.round(mean)}/255 mean`, detail: `${(clipped * 100).toFixed(1)}% near-black/white pixels`, status: lightStatus },
        { label: 'Focus sharpness', value: `Laplacian variance ${Math.round(variance)}`, detail: 'Pixel edge contrast proxy; higher is sharper', status: blurStatus },
        { label: 'Grain separation', value: `${(edgeRatio * 100).toFixed(1)}% edge density`, detail: densityDetail, status: densityStatus },
      ]
    } catch { return [{ label: 'Image metrics', value: 'Unavailable', detail: 'The browser could not read image pixels for validation.', status: 'UNAVAILABLE' }] }
  }

  async function startCamera() {
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError('Camera access is unavailable. Use the photo picker instead.'); return }
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } } }); streamRef.current = stream; if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() } }
    catch (e) { setCameraError((e as Error).name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in browser settings or choose a photo.' : 'Could not start the camera. Choose a photo to continue.') }
  }
  function stopCamera() { streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null }
  function captureFrame() { const video = videoRef.current; if (!video || !video.videoWidth) return; const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d')?.drawImage(video, 0, 0); canvas.toBlob(blob => { if (blob) { void usePhoto(new File([blob], `grain-sample-${Date.now()}.jpg`, { type: 'image/jpeg' })); setCameraOpen(false) } }, 'image/jpeg', 0.94) }
  async function toggleTorch() { const track = streamRef.current?.getVideoTracks()[0]; const caps = track?.getCapabilities() as MediaTrackCapabilities & { torch?: boolean } | undefined; if (!track || !caps?.torch) return; const enabled = !torch; await track.applyConstraints({ advanced: [{ torch: enabled } as MediaTrackConstraintSet] }); setTorch(enabled) }
  async function usePhoto(next: File | undefined) {
    if (!next) return
    setError('')
    try { setFile(await compressPhoto(next)); setAnalysis(null) }
    catch (e) { setError(`Could not prepare this photo: ${(e as Error).message}`) }
  }

  async function compressPhoto(source: File): Promise<File> {
    let bitmap: ImageBitmap | undefined
    let objectUrl: string | undefined
    let width = 0; let height = 0
    let drawable: CanvasImageSource
    try {
      if ('createImageBitmap' in window) {
        try { bitmap = await createImageBitmap(source) } catch { /* Try browser image decoding below. */ }
      }
      if (bitmap) {
        drawable = bitmap
        width = bitmap.width; height = bitmap.height
      } else {
        objectUrl = URL.createObjectURL(source)
        const image = new Image(); image.src = objectUrl
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Image could not be decoded')) })
        width = image.naturalWidth; height = image.naturalHeight
        drawable = image
      }
      const longSideLimit = 1920
      const ratio = Math.min(1, longSideLimit / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas image compression is unavailable')
      context.drawImage(drawable!, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not encode compressed image')), 'image/jpeg', 0.85))
      const name = source.name.replace(/\.[^.]+$/, '') || 'grain-sample'
      return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
    } finally { bitmap?.close(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }

  async function addFarmer(e: React.FormEvent) { e.preventDefault(); try { const response = await request('/api/sellers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(farmerForm) }); const data = await response.json(); setFarmers(list => [...list, data.seller]); setFarmerId(String(data.seller.id)); setFarmerName(data.seller.name); setNewFarmer(false); setFarmerForm({ name: '', phone: '', location: '', seller_code: '' }) } catch (e) { setError(`Could not register farmer: ${(e as Error).message}`) } }

  async function analyze() {
    if (!file) { setError('Capture or choose a grain sample before analysis.'); return }
    const separation = validation.find(metric => metric.label === 'Grain separation' && metric.status === 'FAIL')
    if (separation) { setError(separation.detail); return }
    setLoading(true); setError(''); setAnalysis(null)
    try {
      const form = new FormData(); form.append('image', file); form.append('save_lot', 'true')
      if (weight) form.append('lot_weight_kg', String(Number(weight) * (weightUnit === 'qtl' ? 100 : 1)))
      if (farmerId) form.append('seller_id', farmerId)
      if (manualPriceOverride && baseline && Number(baseline) > 0) form.append('manual_baseline_price_per_quintal', baseline)
      if (manualMoisture.trim() !== '') form.append('manual_moisture_pct', manualMoisture)
      form.append('chalky_deduction_rate_per_pct_per_quintal', String(deductionRates.chalky))
      form.append('broken_deduction_rate_per_pct_per_quintal', String(deductionRates.broken))
      form.append('damaged_deduction_rate_per_pct_per_quintal', String(deductionRates.damaged_discolored))
      form.append('sound_shortfall_rate_per_pct_per_quintal', String(deductionRates.sound_shortfall))
      const response = await request('/api/v1/analyze-grain', { method: 'POST', body: form }); const data = await response.json(); setAnalysis(data); if (data.price_reference?.modal_price_per_quintal) setPriceReference(data.price_reference); setTimeout(drawBoxes, 0); void refresh()
    } catch (e) { setError(`Analysis failed: ${(e as Error).message}`) } finally { setLoading(false) }
  }
  async function refreshPriceReference() {
    setRefreshingPrice(true)
    try { const response = await request('/api/prices/refresh', { method: 'POST' }); const data = await response.json(); const ref = data.reference || data; if (ref.modal_price_per_quintal) setPriceReference(ref) }
    catch (e) { setError(`Could not refresh mandi price: ${(e as Error).message}`) }
    finally { setRefreshingPrice(false) }
  }
  async function recordTransaction() {
    const valuation = analysis?.fci_valuation
    if (!valuation || valuation.status === 'REJECT') return
    setSavingTransaction(true)
    const payload = { farmer_id: farmerId || undefined, farmer_name: analysis?.lot?.seller_name || farmerName || '', grain_type: 'Swarna Paddy', net_weight_kg: valuation.total_lot_weight_kg, fci_valuation: valuation }
    try {
      if (!navigator.onLine) {
        await queueLot(payload)
        setPendingOfflineLots(count => count + 1)
        setToast('Lot saved on this device. It will sync when the network returns.')
        setAnalysis(null); setFile(null); window.setTimeout(() => setToast(''), 5000)
        return
      }
      await saveLotTransaction(payload)
      setToast('Lot transaction saved to the procurement ledger.'); setAnalysis(null); setFile(null); await refresh(); window.setTimeout(() => setToast(''), 4500)
    } catch (e) {
      if (e instanceof TypeError) {
        try { await queueLot(payload); setPendingOfflineLots(count => count + 1); setToast('Network interrupted. Lot saved on this device for later sync.'); setAnalysis(null); setFile(null); window.setTimeout(() => setToast(''), 5000) }
        catch (queueError) { setError(`Could not queue lot locally: ${(queueError as Error).message}`) }
      } else setError(`Could not save lot transaction: ${(e as Error).message}`)
    }
    finally { setSavingTransaction(false) }
  }
  function drawBoxes() {
    const img = imageRef.current; const canvas = canvasRef.current; if (!img || !canvas || !analysis) return
    const sourceWidth = analysis.image?.width || img.naturalWidth; const sourceHeight = analysis.image?.height || img.naturalHeight
    const displayWidth = img.clientWidth; const displayHeight = img.clientHeight
    if (!img.complete || !img.naturalWidth || !img.naturalHeight || !sourceWidth || !sourceHeight || !displayWidth || !displayHeight) return
    const imgAspect = img.naturalWidth / img.naturalHeight
    const containerAspect = displayWidth / displayHeight
    let renderWidth = displayWidth
    let renderHeight = displayHeight
    let offsetX = 0
    let offsetY = 0
    if (containerAspect > imgAspect) {
      renderWidth = displayHeight * imgAspect
      offsetX = (displayWidth - renderWidth) / 2
    } else {
      renderHeight = displayWidth / imgAspect
      offsetY = (displayHeight - renderHeight) / 2
    }
    const scaleX = renderWidth / img.naturalWidth
    const scaleY = renderHeight / img.naturalHeight
    const sourceToNaturalX = img.naturalWidth / sourceWidth; const sourceToNaturalY = img.naturalHeight / sourceHeight
    canvas.width = Math.round(displayWidth); canvas.height = Math.round(displayHeight)
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const detections = analysis.detections || []; const palette = ['#34d399', '#fbbf24', '#fb7185', '#60a5fa', '#c084fc', '#f97316']; const labelRects: Array<{ x: number; y: number; w: number; h: number }> = []
    detections.forEach(d => {
      const normalized = Boolean(d.normalized_box); const b = d.normalized_box || d.box
      const naturalX1 = normalized ? b.x1 * img.naturalWidth : b.x1 * sourceToNaturalX
      const naturalY1 = normalized ? b.y1 * img.naturalHeight : b.y1 * sourceToNaturalY
      const naturalX2 = normalized ? b.x2 * img.naturalWidth : b.x2 * sourceToNaturalX
      const naturalY2 = normalized ? b.y2 * img.naturalHeight : b.y2 * sourceToNaturalY
      const x = offsetX + naturalX1 * scaleX; const y = offsetY + naturalY1 * scaleY
      const bw = (naturalX2 - naturalX1) * scaleX; const bh = (naturalY2 - naturalY1) * scaleY
      const color = palette[Math.abs(d.class.split('').reduce((n, c) => n + c.charCodeAt(0), 0)) % palette.length]
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, displayWidth / 500); ctx.strokeRect(x, y, bw, bh)
      if (labelRects.length < 14 && bw > 42 && bh > 22) {
        const label = `${d.class} ${Math.round(d.confidence * 100)}%`; ctx.font = `bold ${Math.max(12, displayWidth / 72)}px system-ui`
        const tw = ctx.measureText(label).width + 10; const th = 21; const ly = Math.max(0, y - th)
        const overlaps = labelRects.some(r => x < r.x + r.w && x + tw > r.x && ly < r.y + r.h && ly + th > r.y)
        if (!overlaps) { labelRects.push({ x, y: ly, w: tw, h: th }); ctx.fillStyle = color; ctx.fillRect(x, ly, tw, th); ctx.fillStyle = '#07100c'; ctx.fillText(label, x + 5, Math.max(15, ly + 15)) }
      }
    })
  }

  function touchPoint(event: React.TouchEvent<HTMLDivElement>, index = 0) {
    const rect = imageStageRef.current?.getBoundingClientRect()
    const touch = event.touches[index]
    if (!rect || !touch) return null
    return { x: Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100)), y: Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100)) }
  }
  function onOverlayTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length >= 2) {
      const a = event.touches[0]; const b = event.touches[1]
      pinchStartRef.current = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom: zoomLevel }
      const rect = imageStageRef.current?.getBoundingClientRect()
      if (rect) setZoomOrigin({ x: ((a.clientX + b.clientX) / 2 - rect.left) / rect.width * 100, y: ((a.clientY + b.clientY) / 2 - rect.top) / rect.height * 100 })
      event.preventDefault()
      return
    }
    const now = Date.now()
    if (now - lastTapRef.current < 320) {
      const point = touchPoint(event)
      if (point) setZoomOrigin(point)
      setZoomLevel(current => current > 1 ? 1 : 2.5)
      lastTapRef.current = 0
    } else lastTapRef.current = now
  }
  function onOverlayTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2 || !pinchStartRef.current) return
    const a = event.touches[0]; const b = event.touches[1]
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    setZoomLevel(Math.max(1, Math.min(4, pinchStartRef.current.zoom * distance / pinchStartRef.current.distance)))
    event.preventDefault()
  }
  function onOverlayTouchEnd(event: React.TouchEvent<HTMLDivElement>) { if (event.touches.length < 2) pinchStartRef.current = null }

  const metrics = analysis?.metrics || {}; const lotsToShow = lots.length ? lots : (stats.recent_activity as Lot[] || [])
  const currentFarmer = useMemo(() => farmers.find(f => String(f.id) === farmerId), [farmers, farmerId])
  async function decide(lot: Lot, status: 'accepted' | 'rejected') { try { await request(`/api/lots/${lot.lot_id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: status, rejection_reason: status === 'rejected' ? rejectReason : null, notes: '' }) }); setDecisionLot(null); void refresh() } catch (e) { setError(`Could not update lot: ${(e as Error).message}`) } }
  async function receiptPdf(lot: Lot) {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF()
    const left = 18
    let y = 22
    pdf.setFillColor(6, 78, 59)
    pdf.rect(0, 0, 210, 39, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(15)
    pdf.text('GRAIN-VISION PROCUREMENT RECEIPT', left, y)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(`Transaction reference  ${lot.lot_id}`, left, y + 8)
    y = 54
    const rows: Array<[string, string]> = [
      ['Farmer', lot.seller_name || 'Unassigned'],
      ['Lot weight', lot.weight_kg ? `${lot.weight_kg} kg` : 'Unavailable'],
      ['Quality score', lot.quality_score == null ? 'Unavailable' : `${lot.quality_score} / 100`],
      ['Decision', (lot.status || 'assessed').toUpperCase()],
      ['Estimated procurement value', currency(lot.total_estimated_price).replace('₹', 'INR ')],
      ['Estimated unit rate', `${currency(lot.estimated_rate_per_kg).replace('₹', 'INR ')} / kg`],
      ['Date recorded', lot.created_at ? new Date(lot.created_at).toLocaleString('en-IN') : 'Unavailable'],
    ]
    rows.forEach(([label, value], index) => {
      if (index % 2 === 0) { pdf.setFillColor(244, 248, 245); pdf.rect(left, y - 6, 174, 13, 'F') }
      pdf.setTextColor(90, 104, 96); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.text(label, left + 3, y + 2)
      pdf.setTextColor(25, 42, 33); pdf.setFont('helvetica', 'bold'); pdf.text(value, 207 - pdf.getTextWidth(value), y + 2)
      y += 14
    })
    y += 12
    pdf.setDrawColor(16, 185, 129)
    pdf.line(left, y, 192, y)
    pdf.setTextColor(83, 96, 88); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8)
    pdf.text(pdf.splitTextToSize('Advisory decision-support receipt. Quality scores and price estimates are informational and are not an accredited statutory grade or a binding purchase offer.', 174), left, y + 8)
    return pdf
  }
  async function downloadReceipt(lot: Lot) { (await receiptPdf(lot)).save(`GRAIN-VISION-${lot.lot_id}-receipt.pdf`) }
  async function shareReceipt(lot: Lot) {
    const pdf = await receiptPdf(lot)
    const file = new File([pdf.output('blob')], `GRAIN-VISION-${lot.lot_id}-receipt.pdf`, { type: 'application/pdf' })
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try { await navigator.share({ title: `Secure receipt ${lot.lot_id}`, files: [file] }) }
      catch (e) { if ((e as Error).name !== 'AbortError') setError(`Could not share receipt: ${(e as Error).message}`) }
    } else { pdf.save(`GRAIN-VISION-${lot.lot_id}-receipt.pdf`); setError('Secure file sharing is not supported here. The receipt PDF was downloaded instead.') }
  }

  return <div className="app-shell">
    <Header price={manualPriceOverride ? Number(baseline) || priceReference.modal_price_per_quintal : priceReference.modal_price_per_quintal} priceSource={manualPriceOverride ? 'Manual operator override' : priceReference.source} apiStatus={apiStatus} pendingOfflineLots={pendingOfflineLots}/>
    <main id="top">
      {error && <div className="alert"><AlertTriangle size={17}/><span>{error}</span><button onClick={() => setError('')}><X size={16}/></button></div>}
      {pendingOfflineLots > 0 && <div className="offline-queue-indicator"><span className="pulse-dot"/> {pendingOfflineLots} lot {pendingOfflineLots === 1 ? 'record' : 'records'} waiting to sync</div>}
      {toast && <div className="success-toast"><CheckCircle2 size={16}/>{toast}</div>}
      <Routes>
      <Route path="/" element={<DashboardPage><DashboardMetrics metrics={{ total_lots_assessed: stats.total_lots ?? 0, total_lots_accepted: stats.accepted_lots ?? 0, total_lots_rejected: stats.rejected_lots ?? 0, total_procurement_value: stats.total_procurement_value ?? 0, total_procured_weight_quintals: stats.total_procured_weight_quintals ?? 0 }}/><HistoryLedger/><section className="panel ledger-panel"><div className="section-heading ledger-heading"><div><span className="step-label">RECENT ACTIVITY</span><h2>Recent lots</h2></div><button className="button subtle" onClick={() => void refresh()}><RefreshCw size={15}/> Refresh</button></div><div className="ledger-table"><div className="ledger-header"><span>LOT / FARMER</span><span>WEIGHT</span><span>SCORE</span><span>EST. VALUE</span><span>STATUS</span><span>ACTIONS</span></div>{lotsToShow.length ? lotsToShow.map(lot => <div className="ledger-row" key={lot.lot_id}><div><strong>{lot.lot_id}</strong><small>{lot.seller_name || 'Unassigned'}</small></div><span>{lot.weight_kg ? `${lot.weight_kg} kg` : '—'}</span><span>{lot.quality_score ?? '—'}</span><b>{currency(lot.total_estimated_price)}</b><span className={`status-pill ${(lot.status || 'assessed').toLowerCase()}`}>{lot.status || 'assessed'}</span><div className="ledger-actions"><button title="Receipt options" onClick={() => setReceiptLot(lot)}><FileText size={16}/></button>{lot.status === 'assessed' && <button title="Record decision" onClick={() => setDecisionLot(lot)}><CheckCircle2 size={16}/></button>}</div></div>) : <div className="empty-ledger">No lot records yet. Completed sample assessments will appear here.</div>}</div></section></DashboardPage>}/>
      <Route path="/inspect" element={<InspectionPage online={isOnline} pendingOfflineLots={pendingOfflineLots} printData={analysis?.fci_valuation ? { lotId: analysis.lot?.lot_id || 'Pending lot ID', farmerName: analysis.lot?.seller_name || farmerName, grainType: 'Swarna Paddy', weightKg: analysis.fci_valuation.total_lot_weight_kg, moisturePct: manualMoisture, valuation: analysis.fci_valuation } : undefined}><div className="workspace-grid"><section className="panel intake-panel"><div className="section-heading intake-heading"><div><h2>Assess a sample</h2><p>Link a farmer and lot before running the visual inspection.</p><Link className="inline-settings-link" to="/settings">Lot weight and pricing settings</Link></div></div>
        <div className="step-section"><div className="step-title"><span className="step-number">1</span><div><strong>Farmer profile</strong><small>Identity attached to this lot</small></div></div><div className="step-card"><div className="input-row"><div className="select-wrap"><select value={farmerId} onChange={e => { setFarmerId(e.target.value); const f = farmers.find(item => String(item.id) === e.target.value); setFarmerName(f?.name || '') }}><option value="">Unassigned farmer</option>{farmers.map(f => <option key={f.id} value={f.id}>{f.name} · {f.phone}</option>)}</select><ChevronDown size={16}/></div><button className="button subtle" onClick={() => setNewFarmer(v => !v)}><Plus size={16}/> Add</button></div>{currentFarmer && <div className="farmer-summary"><UserRound size={15}/><span>{currentFarmer.name} · {currentFarmer.location || 'Location not set'}</span></div>}
          {newFarmer && <form className="farmer-form" onSubmit={e => void addFarmer(e)}><div className="form-grid"><Field label="Farmer name *" value={farmerForm.name} onChange={name => setFarmerForm({ ...farmerForm, name })} required/><Field label="Phone number *" value={farmerForm.phone} onChange={phone => setFarmerForm({ ...farmerForm, phone })} required/><Field label="Village / mandi" value={farmerForm.location} onChange={location => setFarmerForm({ ...farmerForm, location })}/><Field label="Farmer ID" value={farmerForm.seller_code} onChange={seller_code => setFarmerForm({ ...farmerForm, seller_code })}/></div><button className="button primary" type="submit">Save farmer profile</button></form>}</div></div>
        <div className="step-section"><div className="step-title"><span className="step-number">2</span><div><strong>Moisture meter reading</strong><small>Enter the physical meter reading for this sample</small></div></div><div className="step-card"><label className="field moisture-meter-field"><span>Moisture % · digital meter reading <b className="required-mark">Required check</b></span><input type="number" min="5" max="35" step="0.1" value={manualMoisture} onChange={event => setManualMoisture(event.target.value)} placeholder="Leave blank to use 13.0%"/><div className="moisture-presets" role="group" aria-label="Moisture quick presets">{[['14%', '14'], ['15%', '15'], ['17% MSP limit', '17'], ['19%', '19']].map(([label, value]) => <button type="button" key={value} className={`moisture-preset ${manualMoisture === value ? 'selected' : ''}`} onClick={() => setManualMoisture(value)}>{label}</button>)}</div>{!manualMoisture.trim() && <small className="moisture-default-warning" role="status">Moisture not entered. Defaulting to safe baseline (13.0%). Ensure physical check.</small>}</label></div></div>
        <div className="step-section capture-section"><div className="step-title"><span className="step-number">3</span><div><strong>Grain sample</strong><small>Evenly spread grains on a matte surface</small></div></div>
          <div className="step-card sample-card">
            <p className="sample-instruction">Spread the grains evenly on a matte surface in good light, then capture or upload one clear sample. Fill the frame with grains only.</p>
            <div className={`capture-drop ${previewUrl ? 'has-image' : ''}`}>{previewUrl ? <><img src={previewUrl} alt="Selected grain sample"/><div className="photo-overlay"><span><Check size={14}/> SAMPLE LOADED · {file?.name}</span><button type="button" className="icon-button" onClick={() => { setFile(null); setAnalysis(null) }} aria-label="Remove image"><X size={16}/></button></div></> : <div className="drop-placeholder"><div className="camera-glyph"><Camera size={23}/></div><strong>Capture or upload a grain sample</strong><small>JPG, PNG or WebP · pixel analysis runs on this device</small></div>}</div>
            <div className="capture-actions"><button type="button" className="button sample-action" onClick={() => cameraCaptureRef.current?.click()}><Camera size={18}/><span>Take Sample Photo</span></button><button type="button" className="button sample-action" onClick={() => galleryRef.current?.click()}><ImagePlus size={18}/><span>Upload from Gallery</span></button><input ref={cameraCaptureRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { void usePhoto(e.target.files?.[0]); e.currentTarget.value = '' }}/><input ref={galleryRef} type="file" accept="image/*" hidden onChange={e => { void usePhoto(e.target.files?.[0]); e.currentTarget.value = '' }}/></div><button type="button" className="live-camera-link" onClick={() => { setCameraError(''); setCameraOpen(true) }}>Open live viewfinder instead</button>
            {!!validation.length && <div className="validation-card"><div className="validation-head"><div><ShieldCheck size={17}/><strong>Image readiness</strong></div><span>ON DEVICE · CANVAS</span></div>{validation.map(m => <div className="validation-row" key={m.label}><div><strong>{m.label}</strong><small>{m.detail}</small></div><span className={`metric-state ${m.status.toLowerCase()}`}>{m.status === 'PASS' && <Check size={12}/>} {m.status}</span><b>{m.value}</b></div>)}</div>}
          </div>
          <button className={`button analyze-button ${analysis ? 'analysis-complete' : ''}`} onClick={() => void analyze()} disabled={!file || loading}><span>{loading ? <LoaderCircle className="spin"/> : <ScanLine/>}{loading ? 'Running YOLOv8 inference…' : 'Analyze sample'}</span><ArrowRight size={17}/></button>
        </div>
      </section>
      <section className="panel results-panel"><div className="section-heading"><div><span className="step-label">INSPECTION RESULTS</span><h2>Quality & valuation</h2><p>Detection results and advisory procurement estimate.</p></div><span className="model-tag"><span className="pulse-dot"/> YOLOV8</span></div>
        <InspectionOutput valuation={analysis?.fci_valuation} loading={loading} qualityScore={metrics.quality_score} grade={metrics.grade || metrics.quality_grade} saving={savingTransaction} onConfirmRecord={() => void recordTransaction()} detectionCount={analysis?.detections?.length || 0} detectionCounts={(analysis?.detections || []).reduce<Record<string, number>>((counts, detection) => { counts[detection.class] = (counts[detection.class] || 0) + 1; return counts }, {})}>
          {analysis && <>
            <div className="result-meta inspection-meta"><span>LOT REFERENCE</span><b>{analysis.lot?.lot_id || 'Not saved'}</b><span>FARMER</span><b>{analysis.lot?.seller_name || farmerName || 'Unassigned'}</b></div>
            <div className="quality-grid">{[['Total grains', metrics.total_grains], ['Broken', `${metrics.broken_pct ?? '—'}%`], ['Chalky', `${metrics.chalky_pct ?? '—'}%`], ['Foreign matter', `${metrics.foreign_matter_count_pct ?? '—'}%`]].map(([label, value]) => <div className="quality-cell" key={String(label)}><span>{label}</span><strong>{value ?? '—'}</strong></div>)}</div>
            <div className="detection-view"><div className="detection-head"><strong>Detection overlay</strong><span>Pinch or double-tap to zoom</span></div><div ref={imageStageRef} className="image-stage" onTouchStart={onOverlayTouchStart} onTouchMove={onOverlayTouchMove} onTouchEnd={onOverlayTouchEnd} style={{ aspectRatio: `${analysis.image?.width || 4} / ${analysis.image?.height || 3}` }}><img ref={imageRef} src={previewUrl} onLoad={drawBoxes} style={{ transform: `scale(${zoomLevel})`, transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%` }} alt="Analyzed sample with YOLO detections"/><canvas ref={canvasRef} style={{ transform: `scale(${zoomLevel})`, transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%` }}/>{zoomLevel > 1 && <button className="zoom-reset" onClick={() => setZoomLevel(1)}>Reset zoom · {zoomLevel.toFixed(1)}×</button>}</div></div>
            <div className="result-actions"><button className="button primary" onClick={() => analysis.lot && setDecisionLot(analysis.lot)} disabled={!analysis.lot}><CheckCircle2 size={16}/> Record decision</button><button className="button subtle" onClick={() => void refresh()}><RefreshCw size={15}/> Refresh ledger</button></div>
          </>}
        </InspectionOutput>
      </section></div>
      </InspectionPage>} />
      <Route path="/settings" element={<SettingsPage><Settings baseline={baseline} onBaselineChange={setBaseline} weight={weight} onWeightChange={setWeight} weightUnit={weightUnit} onWeightUnitChange={setWeightUnit} manualMoisture={manualMoisture} onManualMoistureChange={setManualMoisture} deductionRates={deductionRates} onDeductionRatesChange={setDeductionRates} priceReference={priceReference} manualPriceOverride={manualPriceOverride} onManualPriceOverrideChange={enabled => { if (enabled) setBaseline(String(priceReference.modal_price_per_quintal || 2441)); setManualPriceOverride(enabled) }} onRefreshPrice={refreshPriceReference} refreshingPrice={refreshingPrice} showMoisture={false}/><PWAInstallCard/></SettingsPage>} />
      <Route path="/support" element={<SupportPage apiStatus={apiStatus} pendingOfflineLots={pendingOfflineLots}/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
      <footer><span><Leaf size={14}/> GRAIN-VISION</span><small>Decision support estimates only · Mandi rates are informational baselines</small></footer>
    </main>
    {cameraOpen && <div className="modal-backdrop"><section className="camera-modal"><header><div><span className="step-label">SAMPLE CAPTURE</span><h2>Camera viewfinder</h2></div><button className="icon-button" onClick={() => setCameraOpen(false)}><X/></button></header><div className="viewfinder"><video ref={videoRef} playsInline muted/><div className="viewfinder-frame"/><span className="viewfinder-label"><span className="pulse-dot"/> LIVE CAMERA</span></div>{cameraError && <div className="camera-error"><AlertTriangle size={16}/>{cameraError}</div>}<div className="camera-controls"><button className="button secondary" onClick={() => setFacing(f => f === 'environment' ? 'user' : 'environment')}><RefreshCw size={16}/> Switch camera</button><button className="capture-shutter" aria-label="Capture grain image" onClick={captureFrame}><span/></button><button className="button secondary" onClick={() => void toggleTorch()}><Flashlight size={16}/>{torch ? 'Torch on' : 'Torch'}</button></div><button className="camera-gallery" onClick={() => { setCameraOpen(false); setTimeout(() => galleryRef.current?.click(), 0) }}><Upload size={15}/> Choose a photo instead</button></section></div>}
    {showFarmerModal && <Dialog title="Terminal profile" close={() => setShowFarmerModal(false)}><p className="dialog-copy">Operator sign-in and account registration are available through the backend API. Farmer records remain linked to each saved lot.</p><div className="dialog-actions"><button className="button primary" onClick={() => setShowFarmerModal(false)}>Close</button></div></Dialog>}
    {decisionLot && <Dialog title={`Record decision · ${decisionLot.lot_id}`} close={() => setDecisionLot(null)}><p className="dialog-copy">Confirm the procurement determination for {decisionLot.seller_name || 'this lot'}.</p><div className="decision-choice"><button className="button primary" onClick={() => void decide(decisionLot, 'accepted')}><CheckCircle2 size={16}/> Accept lot</button><select value={rejectReason} onChange={e => setRejectReason(e.target.value)}><option>Quality Below Minimum Threshold</option><option>Excessive Broken / Chalky Grains</option><option>Foreign Objects / Stones Detected</option><option>Price Mismatch</option><option>Other</option></select><button className="button danger" onClick={() => void decide(decisionLot, 'rejected')}>Reject lot</button></div></Dialog>}
    {receiptLot && <Dialog title="Transaction receipt" close={() => setReceiptLot(null)}><p className="dialog-copy">Receipt for {receiptLot.lot_id} · {receiptLot.seller_name || 'Unassigned farmer'} · {currency(receiptLot.total_estimated_price)}</p><div className="dialog-actions"><button className="button primary" onClick={() => downloadReceipt(receiptLot)}><Download size={16}/> Download Official Receipt (PDF)</button><button className="button secondary" onClick={() => void shareReceipt(receiptLot)}><Share2 size={16}/> Share Secure Receipt</button></div><small className="receipt-note">Downloads a PDF; sharing uses the device share sheet when supported.</small></Dialog>}
    <MobileBottomNav/>
  </div>
}

function Field({ label, value, onChange, type = 'text', placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) { return <label className="field"><span>{label}</span><input required={required} type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}/></label> }
function Dialog({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close() }}><section className="dialog"><header><h2>{title}</h2><button className="icon-button" onClick={close}><X size={18}/></button></header>{children}</section></div> }

