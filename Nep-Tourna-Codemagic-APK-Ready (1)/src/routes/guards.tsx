import React, { useEffect } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../store'
import type { Role } from '../lib/types'
import { canAccessArea, homeRouteFor, isStaff, type AdminArea } from '../lib/permissions'

export function RequireAuth({ role, area, children }: { role?: Role; area?: AdminArea; children: React.ReactNode }) {
  const user = useCurrentUser()
  const loc = useLocation()
  const isAdminRoute = loc.pathname.startsWith('/admin')

  if (!user) return <Navigate to={isAdminRoute ? '/admin/login' : '/login'} replace state={{ from: loc.pathname }} />

  // Suspended players are locked out; staff accounts are never suspended through the player flow.
  if (user.status === 'suspended' && !isStaff(user.role)) return <Navigate to="/suspended" replace />

  // Area-gated admin sections: must be staff AND the role must grant this area.
  if (area) {
    if (!isStaff(user.role) || !canAccessArea(user.role, area)) return <Navigate to="/access-denied" replace />
    return <>{children}</>
  }

  // Admin panel shell: any staff member may enter; specific sections are area-gated.
  if (role === 'admin') {
    if (!isStaff(user.role)) return <Navigate to="/access-denied" replace />
    return <>{children}</>
  }

  if (role && user.role !== role) return <Navigate to="/access-denied" replace />
  return <>{children}</>
}

export function AccessDeniedPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const home = !user ? '/login' : isStaff(user.role) ? homeRouteFor(user.role) : '/dashboard'
  useEffect(() => {
    const t = setTimeout(() => navigate(home, { replace: true }), 2500)
    return () => clearTimeout(t)
  }, [home, navigate])
  return (
    <div className="access-denied">
      <div className="ad-ico">🚫</div>
      <h1>Access Denied</h1>
      <p>You do not have permission to access this page. Redirecting you to your dashboard…</p>
      <a className="btn btn-primary" href={home}>Back to Dashboard</a>
    </div>
  )
}

export function SuspendedPage() {
  const user = useCurrentUser()
  return (
    <div className="access-denied">
      <div className="ad-ico">⛔</div>
      <h1>Account Suspended</h1>
      <p>
        Your account has been suspended by the admin team. Please contact support at{' '}
        <b>support@neptourna.local</b> for assistance.
      </p>
      {user && <p className="muted small">Signed in as @{user.username}</p>}
      <a className="btn btn-outline" href="/login">Back to Login</a>
    </div>
  )
}
