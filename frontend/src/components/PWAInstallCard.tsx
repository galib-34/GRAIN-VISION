import { useEffect, useState } from 'react'
import { CheckCircle2, Download, Share, Smartphone } from 'lucide-react'
import { useAppRuntime } from '@/components/AppRuntimeContext'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export default function PWAInstallCard() {
  const { installAvailable, installApp } = useAppRuntime()
  const [standalone, setStandalone] = useState(isStandalone)
  const [ios, setIos] = useState(isIOSDevice)
  const [showIOSHelp, setShowIOSHelp] = useState(false)

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const updateMode = () => setStandalone(isStandalone())
    const markInstalled = () => setStandalone(true)
    const updatePlatform = () => setIos(isIOSDevice())
    displayMode.addEventListener?.('change', updateMode)
    window.addEventListener('appinstalled', markInstalled)
    window.addEventListener('pageshow', updatePlatform)
    return () => {
      displayMode.removeEventListener?.('change', updateMode)
      window.removeEventListener('appinstalled', markInstalled)
      window.removeEventListener('pageshow', updatePlatform)
    }
  }, [])

  return <section className="pwa-install-card" aria-labelledby="pwa-install-title">
    <div className="pwa-install-icon"><Smartphone size={20}/></div>
    <div className="pwa-install-content">
      <div className="pwa-install-heading"><div><span className="step-label">FIELD ACCESS</span><h2 id="pwa-install-title">Install GRAIN-VISION</h2></div></div>
      {standalone ? <div className="pwa-install-state installed"><CheckCircle2 size={17}/><span>Running in field PWA mode. The app is installed on this device.</span></div> : <>
        <p>Add the procurement workspace to your home screen for a focused, standalone field experience.</p>
        {installAvailable ? <button className="button pwa-install-button" onClick={() => void installApp()}><Download size={16}/> Install App</button> : ios ? <button className="button pwa-install-button" onClick={() => setShowIOSHelp(value => !value)}><Share size={16}/> {showIOSHelp ? 'Hide install steps' : 'Add to Home Screen'}</button> : <div className="pwa-install-state"><Smartphone size={17}/><span>Use your browser’s menu to install or add this app to your home screen when available.</span></div>}
        {ios && showIOSHelp && <div className="pwa-ios-help" role="status"><strong>Install from Safari</strong><ol><li>Tap Safari’s <Share size={13}/> Share button.</li><li>Choose <b>“Add to Home Screen”</b>.</li><li>Tap <b>Add</b> to finish.</li></ol></div>}
      </>}
    </div>
  </section>
}
