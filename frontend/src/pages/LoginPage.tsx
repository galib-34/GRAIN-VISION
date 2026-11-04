import { useState, type FormEvent } from 'react'
import { ArrowRight, LoaderCircle, Sprout } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import './login-page.css'

const API = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/$/, '')
const configuredGoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || ''
const googleSignInEnabled = !!configuredGoogleClientId && !/^(your_actual_client_id_here|your-google-oauth-client-id)/i.test(configuredGoogleClientId)

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true); setError('')
    try {
      const response = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.token) throw new Error(data.detail || 'Could not sign in. Check your operator credentials.')
      localStorage.setItem('grainvision_token', data.token)
      localStorage.setItem('grainvision_session', 'authenticated')
      if (data.user) localStorage.setItem('grainvision_user', JSON.stringify(data.user))
      const destination = (location.state as { from?: string } | null)?.from || '/'
      navigate(destination, { replace: true })
    } catch (e) { setError((e as Error).message) }
    finally { setSubmitting(false) }
  }

  async function signInWithGoogle(credential?: string) {
    if (!credential) { setError('Google sign-in did not return an ID token. Please try again.'); return }
    setSubmitting(true); setError('')
    try {
      const response = await fetch(`${API}/api/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: credential }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.access_token) throw new Error(data.detail || 'Could not verify your Google sign-in. Please try again.')
      localStorage.setItem('grainvision_token', data.access_token)
      localStorage.setItem('grainvision_session', 'authenticated')
      if (data.user) localStorage.setItem('grainvision_user', JSON.stringify(data.user))
      const destination = (location.state as { from?: string } | null)?.from || '/'
      navigate(destination, { replace: true })
    } catch (e) { setError((e as Error).message) }
    finally { setSubmitting(false) }
  }

  return <main className="login-shell"><section className="login-card"><div className="login-brand"><span className="brand-mark"><Sprout size={24}/></span><div><strong>GRAIN<span>·</span>VISION</strong><small>MANDI FIELD OPERATIONS</small></div></div><div className="login-intro"><span className="eyebrow">SECURE OPERATOR ACCESS</span><h1>Welcome back</h1><p>Sign in to continue grain inspection and procurement work.</p></div><form onSubmit={event => void signIn(event)}><label className="field"><span>Operator username</span><input autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} placeholder="Enter your username"/></label><label className="field"><span>Password</span><input autoComplete="current-password" type="password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password"/></label>{error && <div className="login-error" role="alert">{error}</div>}<button className="button primary login-submit" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" size={17}/> Signing in…</> : <>Sign in <ArrowRight size={17}/></>}</button></form>{googleSignInEnabled ? <><div className="login-divider"><span>OR CONTINUE WITH</span></div><div className="google-login-wrap"><GoogleLogin onSuccess={response => { void signInWithGoogle(response.credential) }} onError={() => setError('Google sign-in was cancelled or could not start.')} theme="outline" shape="pill" size="large" text="continue_with" width="320"/></div></> : <p className="google-config-note">Google sign-in is unavailable until an OAuth client ID is configured.</p>}<small className="login-footer">Authorized mandi inspectors and procurement operators only.</small></section></main>
}
