import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { resetPassword, passwordIssues } from '../../lib/actions'
import { Field } from '../../components/ui'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string }>({})
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const errs: { email?: string; password?: string; confirm?: string } = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Please enter a valid email address.'
    const pwIssue = passwordIssues(password)
    if (pwIssue) errs.password = pwIssue
    if (password !== confirm) errs.confirm = 'Passwords do not match.'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setBusy(true)
    const res = await resetPassword(email, password)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setDone(true)
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
            Reset your <span>password</span>
          </h1>
          <p>
            Locked out of your account? Set a new password below and get back into the arena in seconds.
          </p>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <h2>Forgot password</h2>
          <div className="sub">Enter your account email and choose a new password.</div>

          {done ? (
            <>
              <div className="alert alert-success">
                ✅ Password reset successfully. You can now sign in with your new password.
              </div>
              <Link to="/login" className="btn btn-primary btn-lg btn-block">
                Back to Sign In
              </Link>
            </>
          ) : (
            <form onSubmit={onSubmit}>
              {error && <div className="alert alert-error">{error}</div>}

              <Field label="Email" required error={errors.email}>
                <input
                  type="email"
                  className={`input ${errors.email ? 'invalid' : ''}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </Field>
              <Field
                label="New Password"
                required
                error={errors.password}
                hint="Min 8 chars with an uppercase, lowercase and number."
              >
                <input
                  type="password"
                  className={`input ${errors.password ? 'invalid' : ''}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm New Password" required error={errors.confirm}>
                <input
                  type="password"
                  className={`input ${errors.confirm ? 'invalid' : ''}`}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>

              <button type="submit" className="btn btn-primary btn-lg btn-block mt8" disabled={busy}>
                {busy ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          )}

          <div className="auth-switch">
            Remembered it? <Link to="/login">Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
