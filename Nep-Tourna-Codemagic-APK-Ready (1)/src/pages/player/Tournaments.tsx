import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser, useDB, useWallet } from '../../store'
import { joinTournament } from '../../lib/actions'
import { fmtDate, fmtNcc, fmtTime } from '../../lib/format'
import {
  ConfirmDialog,
  EmptyState,
  SkeletonCards,
  StatusBadge,
  useFakeLoading,
  useToast,
} from '../../components/ui'
import type { Tournament, TournamentStatus } from '../../lib/types'

const STATUS_OPTIONS: { value: TournamentStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'registration_open', label: 'Registration Open' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'registration_closed', label: 'Registration Closed' },
  { value: 'live', label: 'Live' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function Tournaments() {
  const db = useDB()
  const user = useCurrentUser()
  const wallet = useWallet(user?.id)
  const toast = useToast()
  const loading = useFakeLoading([], 400)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<TournamentStatus | ''>('')
  const [type, setType] = useState('')
  const [confirmT, setConfirmT] = useState<Tournament | null>(null)
  const [joining, setJoining] = useState(false)

  const s = db.settings.wallet
  const available = wallet?.available ?? 0

  const types = useMemo(() => Array.from(new Set(db.tournaments.map((t) => t.type))).sort(), [db.tournaments])

  const joinedCountOf = (tId: string) =>
    db.registrations.filter((r) => r.tournamentId === tId && r.status === 'joined').length
  const alreadyJoined = (tId: string) =>
    db.registrations.some((r) => r.tournamentId === tId && r.userId === user?.id && r.status === 'joined')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return db.tournaments
      .filter((t) => (q ? t.name.toLowerCase().includes(q) : true))
      .filter((t) => (status ? t.status === status : true))
      .filter((t) => (type ? t.type === type : true))
      .sort((a, b) => {
        // non-cancelled first, then by date
        if ((a.status === 'cancelled') !== (b.status === 'cancelled')) return a.status === 'cancelled' ? 1 : -1
        return (b.date + b.startTime).localeCompare(a.date + a.startTime)
      })
  }, [db.tournaments, search, status, type])

  const doJoin = async () => {
    if (!confirmT || !user) return
    setJoining(true)
    const res = await joinTournament(user.id, confirmT.id)
    setJoining(false)
    setConfirmT(null)
    if (res.ok) {
      toast.push('success', `Joined "${confirmT.name}"! Good luck 🏆`)
    } else if (res.error.includes('Insufficient')) {
      toast.push('error', `${res.error} Head to Deposit to top up your coins.`)
    } else {
      toast.push('error', res.error)
    }
  }

  const joinButton = (t: Tournament) => {
    if (t.status === 'cancelled') return null
    if (alreadyJoined(t.id))
      return (
        <button className="btn btn-sm btn-outline" disabled>
          Joined ✓
        </button>
      )
    if (t.status !== 'registration_open')
      return (
        <button className="btn btn-sm btn-outline" disabled title="Registration not open">
          {t.status === 'upcoming' ? 'Opening Soon' : t.status === 'completed' ? 'Completed' : 'Closed'}
        </button>
      )
    if (joinedCountOf(t.id) >= t.maxPlayers)
      return (
        <button className="btn btn-sm btn-outline" disabled>
          Full
        </button>
      )
    return (
      <button className="btn btn-sm btn-primary" onClick={() => setConfirmT(t)}>
        Join {t.entryFee > 0 ? `· ${t.entryFee} ${s.coinSymbol}` : 'Free'}
      </button>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Tournaments</h1>
          <div className="sub">Browse all events and grab your slot</div>
        </div>
        <Link to="/my-tournaments" className="btn btn-outline">🎯 My Tournaments</Link>
      </div>

      <div className="filters">
        <div className="search-input">
          <input
            className="input"
            placeholder="Search tournaments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as TournamentStatus | '')}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {types.map((tp) => (
            <option key={tp} value={tp}>{tp}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <SkeletonCards count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🏆"
          title="No tournaments found"
          message="Try adjusting your search or filters. New events are added regularly."
          action={
            <button
              className="btn btn-sm btn-outline mt8"
              onClick={() => {
                setSearch('')
                setStatus('')
                setType('')
              }}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="t-grid">
          {filtered.map((t) => {
            const joined = joinedCountOf(t.id)
            const pct = Math.min(100, Math.round((joined / t.maxPlayers) * 100))
            const cancelled = t.status === 'cancelled'
            return (
              <div
                key={t.id}
                className="card t-card"
                style={cancelled ? { opacity: 0.55, filter: 'grayscale(0.7)' } : undefined}
              >
                <div className="t-banner">
                  {t.banner && <img src={t.banner} alt="" />}
                  <span className="t-fee">{t.entryFee > 0 ? `${t.entryFee} ${s.coinSymbol}` : 'FREE'}</span>
                  <span className="t-status"><StatusBadge status={t.status} /></span>
                  <span className="t-game">{t.game} · {t.type}</span>
                </div>
                <div className="t-body">
                  <Link to={`/tournaments/${t.id}`} className="t-name">{t.name}</Link>
                  <div className="t-meta">
                    <span>📅 <b>{fmtDate(t.date)}</b></span>
                    <span>⏰ <b>{fmtTime(t.startTime)}</b></span>
                    <span>👥 <b>{joined}/{t.maxPlayers}</b> slots</span>
                  </div>
                  <div className="slotbar"><div style={{ width: `${pct}%` }} /></div>
                  <div className="t-foot">
                    <span className="prize-tag">🏆 {fmtNcc(t.prizePool, s.coinSymbol)}</span>
                    <div className="row" style={{ gap: 6 }}>
                      <Link to={`/tournaments/${t.id}`} className="btn btn-sm btn-outline">Details</Link>
                      {joinButton(t)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmT !== null}
        onClose={() => setConfirmT(null)}
        onConfirm={doJoin}
        busy={joining}
        title="Confirm Tournament Entry"
        confirmLabel="Confirm & Join"
        message={
          confirmT && (
            <div>
              <p className="mb8">
                You are about to join <b>{confirmT.name}</b> ({confirmT.game} · {confirmT.type}).
              </p>
              <dl className="kv">
                <dt>Entry Fee</dt>
                <dd>{fmtNcc(confirmT.entryFee, s.coinSymbol)}</dd>
                <dt>Current Balance</dt>
                <dd>{fmtNcc(available, s.coinSymbol)}</dd>
                <dt>Balance After Joining</dt>
                <dd className={available - confirmT.entryFee < 0 ? 'text-red' : 'text-green'}>
                  {fmtNcc(available - confirmT.entryFee, s.coinSymbol)}
                </dd>
              </dl>
              {available < confirmT.entryFee && (
                <div className="alert alert-warn mt16" style={{ marginBottom: 0 }}>
                  Insufficient balance — please <Link to="/deposit" className="strong">deposit coins</Link> first.
                </div>
              )}
            </div>
          )
        }
      />
    </div>
  )
}
