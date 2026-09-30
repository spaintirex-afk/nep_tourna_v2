import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser, useDB, useWallet } from '../../store'
import { joinTournament } from '../../lib/actions'
import { fmtDate, fmtNcc, fmtRupees, fmtTime } from '../../lib/format'
import {
  Card,
  CardHead,
  ConfirmDialog,
  EmptyState,
  SkeletonCards,
  StatCard,
  StatusBadge,
  useFakeLoading,
  useToast,
} from '../../components/ui'
import type { Tournament } from '../../lib/types'

export default function Dashboard() {
  const db = useDB()
  const user = useCurrentUser()
  const wallet = useWallet(user?.id)
  const toast = useToast()
  const loading = useFakeLoading([], 450)
  const [confirmT, setConfirmT] = useState<Tournament | null>(null)
  const [joining, setJoining] = useState(false)

  const s = db.settings.wallet

  const joinedRegs = useMemo(
    () => db.registrations.filter((r) => r.userId === user?.id && r.status === 'joined'),
    [db.registrations, user?.id],
  )

  const stats = useMemo(() => {
    const joinedTournamentIds = new Set(joinedRegs.map((r) => r.tournamentId))
    const activeJoined = db.tournaments.filter(
      (t) => joinedTournamentIds.has(t.id) && ['upcoming', 'registration_open', 'registration_closed', 'live'].includes(t.status),
    ).length
    const prizesWon = db.transactions
      .filter((t) => t.userId === user?.id && t.type === 'prize' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0)
    const matchesPlayed = db.results
      .filter((r) => r.status === 'published')
      .reduce((sum, r) => sum + r.entries.filter((e) => e.userId === user?.id).length, 0)
    return { joined: joinedTournamentIds.size, activeJoined, prizesWon, matchesPlayed }
  }, [db.tournaments, db.transactions, db.results, joinedRegs, user?.id])

  const upcoming = useMemo(
    () =>
      db.tournaments
        .filter((t) => t.status === 'registration_open' || t.status === 'upcoming')
        .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
        .slice(0, 4),
    [db.tournaments],
  )

  const announcements = useMemo(
    () =>
      db.announcements
        .filter((a) => a.status === 'published')
        .sort((a, b) => b.publishDate.localeCompare(a.publishDate))
        .slice(0, 3),
    [db.announcements],
  )

  const joinedCountOf = (tId: string) =>
    db.registrations.filter((r) => r.tournamentId === tId && r.status === 'joined').length
  const alreadyJoined = (tId: string) => joinedRegs.some((r) => r.tournamentId === tId)

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
    const joined = joinedCountOf(t.id)
    if (alreadyJoined(t.id))
      return (
        <button className="btn btn-sm btn-outline" disabled>
          Joined ✓
        </button>
      )
    if (t.status !== 'registration_open')
      return (
        <button className="btn btn-sm btn-outline" disabled title="Registration not open yet">
          {t.status === 'upcoming' ? 'Opening Soon' : 'Closed'}
        </button>
      )
    if (joined >= t.maxPlayers)
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

  const available = wallet?.available ?? 0

  const quickActions = [
    { to: '/deposit', icon: '💰', label: 'Deposit', bg: 'var(--green-soft)', color: 'var(--green)' },
    { to: '/withdraw', icon: '🏧', label: 'Withdraw', bg: 'var(--amber-soft)', color: 'var(--amber)' },
    { to: '/tournaments', icon: '🏆', label: 'Browse Tournaments', bg: 'var(--blue-soft)', color: 'var(--blue)' },
    { to: '/my-tournaments', icon: '🎯', label: 'My Tournaments', bg: 'var(--violet-soft)', color: 'var(--violet)' },
    { to: '/leaderboard', icon: '📊', label: 'Leaderboard', bg: '#e0f2fe', color: '#0369a1' },
    { to: '/support', icon: '🎧', label: 'Support', bg: 'var(--red-soft)', color: 'var(--red)' },
  ]

  if (!user) return null

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Namaste, {user.fullName.split(' ')[0]} 👋</h1>
          <div className="sub">Ready to dominate today's lobby?</div>
        </div>
        <Link to="/tournaments" className="btn btn-primary">
          🏆 Browse Tournaments
        </Link>
      </div>

      {/* Wallet hero */}
      <div className="wallet-hero mb24">
        <div className="wh-label">Available Balance</div>
        <div className="wh-amount">
          {fmtNcc(available, s.coinSymbol)}
          <small>≈ {fmtRupees(available * s.rate)}</small>
        </div>
        <div className="wh-sub">
          1 {s.coinSymbol} = {fmtRupees(s.rate)}
          {wallet && wallet.pending > 0 && (
            <> · <span style={{ color: '#ffd166', fontWeight: 700 }}>{fmtNcc(wallet.pending, s.coinSymbol)} pending (reserved by withdrawals)</span></>
          )}
        </div>
        <div className="wh-actions">
          <Link to="/deposit" className="btn btn-primary">💰 Deposit</Link>
          <Link to="/withdraw" className="btn btn-outline">🏧 Withdraw</Link>
          <Link to="/wallet" className="btn btn-ghost" style={{ color: '#c6d0e8' }}>View wallet →</Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="qa-grid mb24">
        {quickActions.map((qa) => (
          <Link key={qa.to} to={qa.to} className="qa">
            <span className="qa-ico" style={{ background: qa.bg, color: qa.color }}>{qa.icon}</span>
            {qa.label}
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="stat-grid mb24">
        <StatCard icon="🎟️" label="Tournaments Joined" value={stats.joined} />
        <StatCard
          icon="🔥"
          label="Active / Upcoming"
          value={stats.activeJoined}
          bg="var(--red-soft)"
          color="var(--red)"
        />
        <StatCard
          icon="🏆"
          label="Prizes Won"
          value={fmtNcc(stats.prizesWon, s.coinSymbol)}
          bg="var(--green-soft)"
          color="var(--green)"
        />
        <StatCard
          icon="🎮"
          label="Matches Played"
          value={stats.matchesPlayed}
          bg="var(--violet-soft)"
          color="var(--violet)"
        />
      </div>

      {/* Upcoming tournaments */}
      <Card className="mb24">
        <CardHead
          title="Upcoming Tournaments"
          sub="Open and upcoming events — join before slots run out"
          action={
            <Link to="/tournaments" className="btn btn-sm btn-outline">View all →</Link>
          }
        />
        <div style={{ padding: 18 }}>
          {loading ? (
            <SkeletonCards count={3} />
          ) : upcoming.length === 0 ? (
            <EmptyState
              icon="🏆"
              title="No upcoming tournaments"
              message="New events are announced regularly. Check the announcements page for updates."
              action={<Link to="/announcements" className="btn btn-sm btn-outline mt8">View announcements</Link>}
            />
          ) : (
            <div className="t-grid">
              {upcoming.map((t) => {
                const joined = joinedCountOf(t.id)
                const pct = Math.min(100, Math.round((joined / t.maxPlayers) * 100))
                return (
                  <div key={t.id} className="card t-card">
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
                        {joinButton(t)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Announcements */}
      <Card>
        <CardHead
          title="Announcements"
          sub="Latest news from the arena"
          action={<Link to="/announcements" className="btn btn-sm btn-outline">See all →</Link>}
        />
        {announcements.length === 0 ? (
          <EmptyState icon="📢" title="No announcements yet" message="Check back later for news and updates." />
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="notif-item">
              <div className="n-ico" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>📢</div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row wrap" style={{ gap: 6 }}>
                  <span className="strong">{a.title}</span>
                  <StatusBadge status={a.type} />
                  {a.priority === 'high' && <StatusBadge status="high" label="Important" />}
                </div>
                <div className="small muted truncate">{a.message}</div>
                <div className="small muted">{fmtDate(a.publishDate)}</div>
              </div>
            </div>
          ))
        )}
      </Card>

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
