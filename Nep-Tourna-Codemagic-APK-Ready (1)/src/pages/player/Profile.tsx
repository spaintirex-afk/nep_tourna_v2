import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCurrentUser, useDB, useWallet } from '../../store'
import { changePassword, passwordIssues, updateProfile } from '../../lib/actions'
import { fmtDate, fmtNcc, fmtRupees } from '../../lib/format'
import { Avatar, Card, CardHead, Field, StatCard, StatusBadge, useToast } from '../../components/ui'
import LogoutButton from '../../components/LogoutButton'

export default function Profile() {
  const db = useDB()
  const user = useCurrentUser()
  const wallet = useWallet(user?.id)
  const toast = useToast()

  const s = db.settings.wallet

  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [ffUid, setFfUid] = useState(user?.ffUid ?? '')
  const [ffIgn, setFfIgn] = useState(user?.ffIgn ?? '')
  const [profileErr, setProfileErr] = useState<{ fullName?: string; phone?: string }>({})
  const [savingProfile, setSavingProfile] = useState(false)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwErr, setPwErr] = useState<{ current?: string; next?: string; confirm?: string; form?: string }>({})
  const [savingPw, setSavingPw] = useState(false)

  if (!user) return null

  const joinedCount = db.registrations.filter((r) => r.userId === user.id && r.status === 'joined').length
  const prizesWon = db.transactions
    .filter((t) => t.userId === user.id && t.type === 'prize' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0)

  const onProfileSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: { fullName?: string; phone?: string } = {}
    if (!fullName.trim()) errs.fullName = 'Full name cannot be empty.'
    if (!phone.trim()) errs.phone = 'Phone number is required.'
    setProfileErr(errs)
    if (Object.keys(errs).length > 0) return

    setSavingProfile(true)
    const res = await updateProfile(user.id, { fullName, phone, ffUid, ffIgn })
    setSavingProfile(false)
    if (res.ok) {
      toast.push('success', 'Profile updated.')
    } else {
      toast.push('error', res.error)
    }
  }

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
          <h1>My Profile</h1>
          <div className="sub">Manage your account details and security</div>
        </div>
        <LogoutButton />
      </div>

      {/* Header card */}
      <Card className="card-pad mb24">
        <div className="row" style={{ gap: 18 }}>
          <Avatar name={user.fullName} color={user.avatarColor} size="avatar-lg" />
          <div className="grow" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{user.fullName}</div>
            <div className="muted">@{user.username}</div>
            <div className="row wrap mt8" style={{ gap: 8 }}>
              <StatusBadge status={user.role} />
              <StatusBadge status={user.status} />
              <span className="small muted">Member since {fmtDate(user.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="divider" />
        <div className="stat-grid">
          <StatCard
            icon="👛"
            label="Balance"
            value={`${fmtNcc(wallet?.available ?? 0, s.coinSymbol)}`}
            bg="var(--amber-soft)"
            color="var(--amber)"
          />
          <StatCard icon="🎟️" label="Tournaments Joined" value={joinedCount} />
          <StatCard
            icon="🏆"
            label="Prizes Won"
            value={fmtNcc(prizesWon, s.coinSymbol)}
            bg="var(--green-soft)"
            color="var(--green)"
          />
        </div>
      </Card>

      <div className="grid-2">
        {/* Editable profile */}
        <Card>
          <CardHead title="Edit Profile" sub="These details are visible to organizers" />
          <div className="card-pad">
            <form onSubmit={onProfileSubmit}>
              <Field label="Full Name" required error={profileErr.fullName}>
                <input
                  className={`input ${profileErr.fullName ? 'invalid' : ''}`}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>
              <Field label="Phone" required error={profileErr.phone}>
                <input
                  className={`input ${profileErr.phone ? 'invalid' : ''}`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98XXXXXXXX"
                />
              </Field>
              <Field label="Free Fire UID" hint="Shown on leaderboards and result sheets.">
                <input className="input" value={ffUid} onChange={(e) => setFfUid(e.target.value)} placeholder="e.g. 123456789" />
              </Field>
              <Field label="Free Fire IGN">
                <input className="input" value={ffIgn} onChange={(e) => setFfIgn(e.target.value)} placeholder="e.g. AARAVxOP" />
              </Field>

              <div className="divider" />
              <Field label="Email">
                <input className="input" value={user.email} disabled style={{ background: '#f8f9fc', color: 'var(--text-3)' }} />
              </Field>
              <Field label="Username">
                <input className="input" value={user.username} disabled style={{ background: '#f8f9fc', color: 'var(--text-3)' }} />
              </Field>
              <div className="alert alert-info small">
                ℹ️ Email, username and role can't be changed here. Contact{' '}
                <span className="mono">{db.settings.general.supportEmail}</span> if you need help with them.
              </div>

              <button type="submit" className="btn btn-primary btn-block mt8" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>
        </Card>

        {/* Change password */}
        <Card>
          <CardHead title="Change Password" sub="Use a strong, unique password" />
          <div className="card-pad">
            <form onSubmit={onPasswordSubmit}>
              {pwErr.form && <div className="alert alert-error">{pwErr.form}</div>}
              <Field label="Current Password" required error={pwErr.current}>
                <input
                  type="password"
                  className={`input ${pwErr.current ? 'invalid' : ''}`}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                />
              </Field>
              <Field
                label="New Password"
                required
                error={pwErr.next}
                hint="Min 8 chars with an uppercase, lowercase and number."
              >
                <input
                  type="password"
                  className={`input ${pwErr.next ? 'invalid' : ''}`}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm New Password" required error={pwErr.confirm}>
                <input
                  type="password"
                  className={`input ${pwErr.confirm ? 'invalid' : ''}`}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              <button type="submit" className="btn btn-blue btn-block mt8" disabled={savingPw}>
                {savingPw ? 'Updating…' : 'Change Password'}
              </button>
            </form>

            <div className="divider" />
            <dl className="kv">
              <dt>Balance ≈</dt>
              <dd>{fmtRupees((wallet?.available ?? 0) * s.rate)}</dd>
              <dt>Total deposited</dt>
              <dd>{fmtNcc(wallet?.totalDeposited ?? 0, s.coinSymbol)}</dd>
              <dt>Total withdrawn</dt>
              <dd>{fmtNcc(wallet?.totalWithdrawn ?? 0, s.coinSymbol)}</dd>
            </dl>
          </div>
        </Card>
      </div>
    </div>
  )
}
