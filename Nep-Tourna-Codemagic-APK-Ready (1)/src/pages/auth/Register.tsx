import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register, passwordIssues } from '../../lib/actions'
import { Field } from '../../components/ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FormState {
  fullName: string
  username: string
  email: string
  password: string
  confirmPassword: string
  phone: string
  ffUid: string
  ffIgn: string
}

const EMPTY: FormState = {
  fullName: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  ffUid: '',
  ffIgn: '',
}

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const errs: Partial<Record<keyof FormState, string>> = {}
  if (!f.fullName.trim()) errs.fullName = 'Full name is required.'
  if (!/^[a-z0-9_]{3,20}$/.test(f.username.trim().toLowerCase()))
    errs.username = 'Username must be 3–20 characters (lowercase letters, numbers, underscore).'
  if (!EMAIL_RE.test(f.email.trim())) errs.email = 'Please enter a valid email address.'
  const pwIssue = passwordIssues(f.password)
  if (pwIssue) errs.password = pwIssue
  if (f.password !== f.confirmPassword) errs.confirmPassword = 'Passwords do not match.'
  if (!f.phone.trim()) errs.phone = 'Phone number is required.'
  return errs
}

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setBusy(true)
    const res = await register({
      fullName: form.fullName,
      username: form.username,
      email: form.email,
      password: form.password,
      confirmPassword: form.confirmPassword,
      phone: form.phone,
      ffUid: form.ffUid || undefined,
      ffIgn: form.ffIgn || undefined,
    })
    if (!res.ok) {
      setFormError(res.error)
      setBusy(false)
      return
    }
    navigate('/dashboard', { replace: true })
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
            Join the <span>Arena</span>
          </h1>
          <p>
            Create your player account in under a minute. Deposit NCC Coins, enter tournaments,
            publish your stats on the leaderboard and cash out real winnings.
          </p>
          <div className="hero-stats">
            <div className="hs">
              <b>Free</b>
              <span>To Register</span>
            </div>
            <div className="hs">
              <b>Daily</b>
              <span>Tournaments</span>
            </div>
            <div className="hs">
              <b>Instant</b>
              <span>Wallet</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-card" style={{ maxWidth: 560 }}>
          <h2>Create your account</h2>
          <div className="sub">Already registered? <Link to="/login" className="text-blue strong">Sign in</Link></div>

          {formError && <div className="alert alert-error">{formError}</div>}

          <form onSubmit={onSubmit}>
            <div className="form-grid">
              <Field label="Full Name" required error={errors.fullName}>
                <input
                  className={`input ${errors.fullName ? 'invalid' : ''}`}
                  placeholder="Aarav Sharma"
                  value={form.fullName}
                  onChange={set('fullName')}
                />
              </Field>
              <Field label="Username" required error={errors.username} hint="3–20 chars: a-z, 0-9, _">
                <input
                  className={`input ${errors.username ? 'invalid' : ''}`}
                  placeholder="aarav_ff"
                  value={form.username}
                  onChange={set('username')}
                />
              </Field>
              <Field label="Email" required error={errors.email}>
                <input
                  type="email"
                  className={`input ${errors.email ? 'invalid' : ''}`}
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                />
              </Field>
              <Field label="Phone" required error={errors.phone}>
                <input
                  className={`input ${errors.phone ? 'invalid' : ''}`}
                  placeholder="98XXXXXXXX"
                  value={form.phone}
                  onChange={set('phone')}
                  autoComplete="tel"
                />
              </Field>
              <Field
                label="Password"
                required
                error={errors.password}
                hint="Min 8 chars with upper, lower and number."
              >
                <input
                  type="password"
                  className={`input ${errors.password ? 'invalid' : ''}`}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm Password" required error={errors.confirmPassword}>
                <input
                  type="password"
                  className={`input ${errors.confirmPassword ? 'invalid' : ''}`}
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Free Fire UID" error={undefined} hint="Optional — shown on leaderboards.">
                <input className="input" placeholder="e.g. 123456789" value={form.ffUid} onChange={set('ffUid')} />
              </Field>
              <Field label="Free Fire IGN" hint="Optional — your in-game name.">
                <input className="input" placeholder="e.g. AARAVxOP" value={form.ffIgn} onChange={set('ffIgn')} />
              </Field>
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-block mt8" disabled={busy}>
              {busy ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="auth-switch">
            By registering you agree to play fair. Cheating or room-sharing leads to a ban.
          </div>
        </div>
      </div>
    </div>
  )
}
