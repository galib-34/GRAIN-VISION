import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Application from '@/Application'
import ProtectedRoute from '@/components/ProtectedRoute'
import { AppRuntimeContext, type InstallPromptEvent } from '@/components/AppRuntimeContext'
import { GoogleOAuthProvider } from '@react-oauth/google'
import LoginPage from '@/pages/LoginPage'
import './styles.css'
import './status.css'
import './mobile-field.css'
import './theme-overrides.css'

export default function App() {
  const [installAvailable, setInstallAvailable] = useState(false)
  const installPromptRef = useRef<InstallPromptEvent | null>(null)

  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault()
      installPromptRef.current = event as InstallPromptEvent
      setInstallAvailable(true)
    }
    const onInstalled = () => { installPromptRef.current = null; setInstallAvailable(false) }
    window.addEventListener('beforeinstallprompt', onInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onInstallPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
    const register = () => { void navigator.serviceWorker.register('/sw.js').catch(() => {}) }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  async function installApp() {
    const prompt = installPromptRef.current
    if (!prompt) return
    try { await prompt.prompt(); await prompt.userChoice }
    finally { installPromptRef.current = null; setInstallAvailable(false) }
  }

  const routes = <Routes>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/*" element={<ProtectedRoute><Application/></ProtectedRoute>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>
  const configuredGoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || ''
  const googleClientId = /^(your_actual_client_id_here|your-google-oauth-client-id)/i.test(configuredGoogleClientId) ? '' : configuredGoogleClientId
  return <AppRuntimeContext.Provider value={{ installAvailable, installApp }}>{googleClientId ? <GoogleOAuthProvider clientId={googleClientId}>{routes}</GoogleOAuthProvider> : routes}</AppRuntimeContext.Provider>
}
