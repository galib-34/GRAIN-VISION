import { Navigate, useLocation } from 'react-router-dom'
import type { PropsWithChildren } from 'react'

export default function ProtectedRoute({ children }: PropsWithChildren) {
  const location = useLocation()
  const token = localStorage.getItem('grainvision_token')
  const session = localStorage.getItem('grainvision_session')
  return token && session === 'authenticated'
    ? <>{children}</>
    : <Navigate to="/login" replace state={{ from: location.pathname }} />
}
