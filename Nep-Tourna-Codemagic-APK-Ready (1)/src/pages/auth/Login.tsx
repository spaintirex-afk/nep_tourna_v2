import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../../lib/actions'
import { useDB } from '../../store'
import { fmtNcc } from '../../lib/format'

export default function Login() {
  const db = useDB()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)

  const playerCount = db.users.filter((u) => u.role === 'player').length
  const liveCount = db.tournaments.filter((t) => t.status === 'live' || t.status === 'registration_open').length
  const prizeTotal = db.tournaments.reduce((s, t) => s + t.prizePool, 0)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const fe: { email?: string; password?: string } = {}
    if (!email.trim()) fe.email = 'Email is required.'
    if (!password) fe.password = 'Password is required.'
    setFieldErrors(fe)
    if (Object.keys(fe).length > 0) return

    setBusy(true)
    const res = await login(email, password, remember, false)
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    const user = db.users.find((u) => u.id === res.id)
    navigate(user?.role === 'admin' ? '/admin/dashboard' : '/dashboard', { replace: true })
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="hero-content">
          <div className="row" style={{ gap: 12 }}>
            <div className="brand-mark" style={{ width: 44, height: 44, fontSize: 17 }}>NT</div>
            <div>
              <div className="brand-name" style={{ fontSize: 19 }}>NEP<span>TOURNA</span></div>
              <div className="brand-sub">Free Fire Esports Arena</div>
            </div>
          </div>
          <h1>
            Compete. Win. <span>Get Paid.</span>
          </h1>
          <p>
            Nepal's premier Free Fire tournament platform. Join daily scrims and major cups, climb the
            leaderboard, and withdraw your winnings straight to eSewa, Khalti or your bank.
          </p>
          <div className="hero-stats">
            <div className="hs">
              <b>{playerCount}+</b>
              <span>Players</span>
            </div>
            <div className="hs">
              <b>{liveCount}</b>
              <span>Open Events</span>
            </div>
            <div className="hs">
              <b>{fmtNcc(prizeTotal, db.settings.wallet.coinSymbol)}</b>
              <span>Prize Pool</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <h2>Welcome back 👋</h2>
          <div className="sub">Sign in to your player account to continue.</div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={onSubmit}>
            <div className="field">
              <label>
                Email <span className="text-red">*</span>
              </label>
              <input
                type="email"
                className={`input ${fieldErrors.email ? 'invalid' : ''}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              {fieldErrors.email && <div className="err">⚠ {fieldErrors.email}</div>}
            </div>

            <div className="field">
              <label>
                Password <span className="text-red">*</span>
              </label>
              <input
                type="password"
                className={`input ${fieldErrors.password ? 'invalid' : ''}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              {fieldErrors.password && <div className="err">⚠ {fieldErrors.password}</div>}
            </div>

            <div className="row between mb16">
              <label className="checkbox">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-blue small strong">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="auth-switch">
            Don't have an account? <Link to="/register">Register now</Link>
          </div>
          <div className="auth-switch small muted">
            Staff member? <Link to="/admin/login">Admin login →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
