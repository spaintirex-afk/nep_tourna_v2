import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../../lib/actions'
import { Field } from '../../components/ui'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Please enter both email and password.')
      return
    }
    setBusy(true)
    const res = await login(email, password, remember, true)
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero" style={{ background: 'linear-gradient(160deg, #060d22 0%, var(--navy) 50%, var(--navy-3) 100%)' }}>
        <div className="hero-content" style={{ textAlign: 'center', margin: '0 auto' }}>
          <div style={{ fontSize: 64, lineHeight: 1 }}>🛡️</div>
          <h1 style={{ fontSize: 30 }}>
            Admin <span>Control Room</span>
          </h1>
          <p>
            Manage tournaments, players, wallets, deposits, results and platform settings for
            Nep Tourna. Restricted access — all actions are audit-logged.
          </p>
          <div className="hero-stats" style={{ justifyContent: 'center' }}>
            <div className="hs">
              <b>24/7</b>
              <span>Moderation</span>
            </div>
            <div className="hs">
              <b>100%</b>
              <span>Audit Logged</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-panel" style={{ background: '#f8faff' }}>
        <div className="auth-card">
          <div className="row mb8" style={{ gap: 10 }}>
            <span style={{ fontSize: 26 }}>🛡️</span>
            <span className="badge badge-red">Restricted</span>
          </div>
          <h2>Admin Access Only</h2>
          <div className="sub">Sign in with your administrator credentials.</div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={onSubmit}>
            <Field label="Admin Email" required>
              <input
                type="email"
                className="input"
                placeholder="admin@yourdomain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label="Password" required>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>

            <div className="row between mb16">
              <label className="checkbox">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me on this device
              </label>
            </div>

            <button type="submit" className="btn btn-blue btn-lg btn-block" disabled={busy}>
              {busy ? 'Verifying…' : '🛡️ Enter Admin Panel'}
            </button>
          </form>

          <div className="auth-switch">
            Not an admin? <Link to="/login">Player sign in →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
