import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCurrentUser, useDB } from '../../store'
import { changePassword, passwordIssues } from '../../lib/actions'
import { fmtDate } from '../../lib/format'
import { Avatar, Card, CardHead, Field, StatusBadge, useToast } from '../../components/ui'
import LogoutButton from '../../components/LogoutButton'
import { ROLE_LABELS } from '../../lib/permissions'

export default function AdminProfile() {
  const db = useDB()
  const user = useCurrentUser()
  const toast = useToast()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwErr, setPwErr] = useState<{ current?: string; next?: string; confirm?: string; form?: string }>({})
  const [savingPw, setSavingPw] = useState(false)

  if (!user) return null

  const onPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: { current?: string; next?: string; confirm?: string } = {}
    if (!current) errs.current = 'Current password is required.'
    const issue = passwordIssues(next)
    if (issue) errs.next = issue
    if (next !== confirm) errs.confirm = 'Passwords do not match.'
    setPwErr(errs)
    if (Object.keys(errs).length > 0) return

    setSavingPw(true)
    const res = await changePassword(user.id, current, next)
    setSavingPw(false)
    if (res.ok) {
      toast.push('success', 'Password changed successfully.')
      setCurrent('')
      setNext('')
      setConfirm('')
    } else {
      setPwErr({ form: res.error })
      toast.push('error', res.error)
    }
  }

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <h1>My Account</h1>
          <div className="sub">Your staff profile and security settings</div>
        </div>
        <LogoutButton />
      </div>

      <Card className="card-pad mb24">
        <div className="row" style={{ gap: 18 }}>
          <Avatar name={user.fullName} color={user.avatarColor} size="avatar-lg" />
          <div className="grow" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{user.fullName}</div>
            <div className="muted">@{user.username}</div>
            <div className="row wrap mt8" style={{ gap: 8 }}>
              <StatusBadge status={user.role} label={ROLE_LABELS[user.role]} />
              <StatusBadge status={user.status} />
              <span className="small muted">Member since {fmtDate(user.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="divider" />
        <dl className="kv">
          <dt>Email</dt><dd>{user.email}</dd>
          <dt>Phone</dt><dd>{user.phone || '—'}</dd>
          <dt>Role</dt><dd>{ROLE_LABELS[user.role]}</dd>
        </dl>
        <div className="alert alert-info small" style={{ marginBottom: 0 }}>
          ℹ️ Role and email are managed by a super administrator from <b>People &amp; Roles</b>. Contact{' '}
          <span className="mono">{db.settings.general.supportEmail}</span> if you need them changed.
        </div>
      </Card>

      <Card>
        <CardHead title="Change Password" sub="Use a strong, unique password" />
        <div className="card-pad">
          <form onSubmit={onPasswordSubmit}>
            {pwErr.form && <div className="alert alert-error">{pwErr.form}</div>}
            <Field label="Current Password" required error={pwErr.current}>
              <input type="password" className={`input ${pwErr.current ? 'invalid' : ''}`} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="New Password" required error={pwErr.next} hint="Min 8 chars with an uppercase, lowercase and number.">
              <input type="password" className={`input ${pwErr.next ? 'invalid' : ''}`} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Confirm New Password" required error={pwErr.confirm}>
              <input type="password" className={`input ${pwErr.confirm ? 'invalid' : ''}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </Field>
            <button type="submit" className="btn btn-blue btn-block mt8" disabled={savingPw}>
              {savingPw ? 'Updating…' : 'Change Password'}
            </button>
          </form>

          <div className="divider" />
          <LogoutButton className="btn btn-danger btn-block" label="⏻ Log out of the admin panel" />
        </div>
      </Card>
    </div>
  )
}
