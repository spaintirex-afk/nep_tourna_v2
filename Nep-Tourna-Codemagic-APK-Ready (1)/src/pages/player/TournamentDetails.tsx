import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCurrentUser, useDB, useWallet } from '../../store'
import { joinTournament } from '../../lib/actions'
import { fmtDate, fmtDateTime, fmtNcc, fmtRupees, fmtTime } from '../../lib/format'
import {
  Card,
  CardHead,
  ConfirmDialog,
  EmptyState,
  StatusBadge,
  useToast,
} from '../../components/ui'
import type { Match } from '../../lib/types'

function roomVisible(m: Match): boolean {
  if (m.status === 'live' || m.status === 'completed') return true
  if (!m.roomReleaseTime) return true
  return new Date(m.roomReleaseTime).getTime() <= Date.now()
}

export default function TournamentDetails() {
  const { id } = useParams()
  const db = useDB()
  const user = useCurrentUser()
  const wallet = useWallet(user?.id)
  const toast = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [joining, setJoining] = useState(false)

  const s = db.settings.wallet
  const available = wallet?.available ?? 0

  const t = db.tournaments.find((x) => x.id === id)

  const joinedCount = useMemo(
    () => (t ? db.registrations.filter((r) => r.tournamentId === t.id && r.status === 'joined').length : 0),
    [db.registrations, t],
  )
  const alreadyJoined = useMemo(
    () => (t && user ? db.registrations.some((r) => r.tournamentId === t.id && r.userId === user.id && r.status === 'joined') : false),
    [db.registrations, t, user],
  )
  const matches = useMemo(
    () => (t ? db.matches.filter((m) => m.tournamentId === t.id) : []),
    [db.matches, t],
  )

  if (!t) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1>Tournament</h1>
            <div className="sub">Details</div>
          </div>
        </div>
        <Card>
          <EmptyState
            icon="❓"
            title="Tournament not found"
            message="This tournament may have been deleted or the link is invalid."
            action={<Link to="/tournaments" className="btn btn-sm btn-primary mt8">← Back to tournaments</Link>}
          />
        </Card>
      </div>
    )
  }

  const pct = Math.min(100, Math.round((joinedCount / t.maxPlayers) * 100))
  const full = joinedCount >= t.maxPlayers

  const doJoin = async () => {
    if (!user) return
    setJoining(true)
    const res = await joinTournament(user.id, t.id)
    setJoining(false)
    setConfirmOpen(false)
    if (res.ok) {
      toast.push('success', `Joined "${t.name}"! Good luck 🏆`)
    } else if (res.error.includes('Insufficient')) {
      toast.push('error', `${res.error} Head to Deposit to top up your coins.`)
    } else {
      toast.push('error', res.error)
    }
  }

  const joinDisabledReason = (): string | null => {
    if (t.status === 'cancelled') return 'Tournament cancelled'
    if (alreadyJoined) return null
    if (t.status !== 'registration_open') return t.status === 'upcoming' ? 'Registration opening soon' : 'Registration closed'
    if (full) return 'Tournament full'
    return null
  }

  const disabledReason = joinDisabledReason()

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>
            <Link to="/tournaments" className="muted" style={{ fontWeight: 600 }}>Tournaments</Link> / {t.name}
          </h1>
          <div className="sub">{t.game} · {t.type}</div>
        </div>
        {alreadyJoined ? (
          <span className="badge badge-green">Registered ✓</span>
        ) : disabledReason ? (
          <button className="btn btn-lg btn-outline" disabled title={disabledReason}>{disabledReason}</button>
        ) : (
          <button className="btn btn-lg btn-primary" onClick={() => setConfirmOpen(true)}>
            🎟️ Join · {t.entryFee > 0 ? `${t.entryFee} ${s.coinSymbol}` : 'Free'}
          </button>
        )}
      </div>

      {t.status === 'cancelled' && (
        <div className="alert alert-error">
          ⛔ This tournament has been cancelled. {t.entryFee > 0 ? 'Entry fees for registered players are refunded automatically.' : ''}
        </div>
      )}
      {alreadyJoined && t.status !== 'cancelled' && (
        <div className="alert alert-success">
          ✅ You're registered for this tournament. Room details appear below once released. Good luck!
        </div>
      )}

      {/* Banner */}
      <div className="card t-banner mb24" style={{ height: 190, borderRadius: 'var(--radius)', alignItems: 'flex-end', padding: '18px 22px' }}>
        {t.banner && <img src={t.banner} alt="" />}
        <span className="t-fee" style={{ fontSize: 13 }}>{t.entryFee > 0 ? `${t.entryFee} ${s.coinSymbol} entry` : 'FREE ENTRY'}</span>
        <span className="t-status"><StatusBadge status={t.status} /></span>
        <div style={{ position: 'relative' }}>
          <div style={{ color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            {t.name}
          </div>
          <div style={{ color: '#c6d0e8', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t.game} · {t.type} · 🏆 {fmtNcc(t.prizePool, s.coinSymbol)} prize pool
          </div>
        </div>
      </div>

      <div className="grid-2 mb24">
        <div style={{ display: 'grid', gap: 18, alignContent: 'start', minWidth: 0 }}>
          {/* Description */}
          <Card>
            <CardHead title="About this tournament" />
            <div className="card-pad">
              <p style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>{t.description || 'No description provided.'}</p>
            </div>
          </Card>

          {/* Details grid */}
          <Card>
            <CardHead title="Tournament Details" />
            <div className="card-pad">
              <dl className="kv">
                <dt>Game</dt><dd>{t.game}</dd>
                <dt>Type</dt><dd>{t.type}</dd>
                <dt>Entry Fee</dt><dd>{t.entryFee > 0 ? fmtNcc(t.entryFee, s.coinSymbol) : 'Free'}</dd>
                <dt>Prize Pool</dt><dd className="text-green">{fmtNcc(t.prizePool, s.coinSymbol)} (≈ {fmtRupees(t.prizePool * s.rate)})</dd>
                <dt>Date</dt><dd>{fmtDate(t.date)}</dd>
                <dt>Start Time</dt><dd>{fmtTime(t.startTime)}</dd>
                <dt>Registration Deadline</dt><dd>{fmtDateTime(t.regDeadline)}</dd>
                <dt>Map</dt><dd>{t.map || '—'}</dd>
                <dt>Mode</dt><dd>{t.mode || '—'}</dd>
                <dt>Registration</dt><dd><StatusBadge status={t.status} /></dd>
              </dl>
              <div className="divider" />
              <div className="row between mb8">
                <span className="small strong">Slots</span>
                <span className="small muted">{joinedCount} / {t.maxPlayers} joined</span>
              </div>
              <div className="slotbar progress-lg"><div style={{ width: `${pct}%` }} /></div>
            </div>
          </Card>

          {/* Matches */}
          <Card>
            <CardHead title="Matches" sub="Room ID & password are released closer to match time" />
            {matches.length === 0 ? (
              <EmptyState icon="🎮" title="No matches scheduled yet" message="The schedule will appear here once the admin publishes it." />
            ) : (
              <div className="table-wrap">
                <table className="table cards-mobile">
                  <thead>
                    <tr>
                      <th>Match</th>
                      <th>Date / Time</th>
                      <th>Map · Mode</th>
                      <th>Status</th>
                      <th>Room Info</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m) => (
                      <tr key={m.id}>
                        <td data-label="Match" className="strong">{m.name}</td>
                        <td data-label="Date / Time">{fmtDate(m.date)} · {fmtTime(m.startTime)}</td>
                        <td data-label="Map · Mode">{m.map} · {m.mode}</td>
                        <td data-label="Status"><StatusBadge status={m.status} /></td>
                        <td data-label="Room Info">
                          {roomVisible(m) && m.roomId ? (
                            <span className="mono">
                              ID: <b>{m.roomId}</b> · PW: <b>{m.roomPassword || '—'}</b>
                            </span>
                          ) : (
                            <span className="muted small">🔒 Releases {fmtDateTime(m.roomReleaseTime)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div style={{ display: 'grid', gap: 18, alignContent: 'start', minWidth: 0 }}>
          {/* Prize distribution */}
          <Card>
            <CardHead title="🏆 Prize Distribution" sub={`Total ${fmtNcc(t.prizePool, s.coinSymbol)}`} />
            <div className="card-pad">
              {t.prizes.length === 0 ? (
                <div className="muted small">Prize breakdown will be announced soon.</div>
              ) : (
                t.prizes
                  .slice()
                  .sort((a, b) => a.rank - b.rank)
                  .map((p) => (
                    <div key={p.rank} className="row between" style={{ padding: '7px 0', borderBottom: '1px solid #f0f2f7' }}>
                      <span className="strong">
                        {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`} Rank {p.rank}
                      </span>
                      <span className="prize-tag">{fmtNcc(p.amount, s.coinSymbol)}</span>
                    </div>
                  ))
              )}
            </div>
          </Card>

          {/* Rules */}
          <Card>
            <CardHead title="📜 Rules" />
            <div className="card-pad">
              <div className="small" style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>
                {t.rules || db.settings.tournament.defaultRules || 'No rules published.'}
              </div>
            </div>
          </Card>

          {/* Join card (mobile-friendly duplicate CTA) */}
          {!alreadyJoined && t.status !== 'cancelled' && (
            <Card className="card-pad">
              <div className="small muted mb8">Your balance</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{fmtNcc(available, s.coinSymbol)}</div>
              <button
                className="btn btn-primary btn-block btn-lg mt16"
                disabled={!!disabledReason || full}
                onClick={() => setConfirmOpen(true)}
              >
                {disabledReason ?? `Join for ${t.entryFee > 0 ? `${t.entryFee} ${s.coinSymbol}` : 'free'}`}
              </button>
              {available < t.entryFee && !disabledReason && (
                <div className="alert alert-warn mt16" style={{ marginBottom: 0 }}>
                  Not enough coins? <Link to="/deposit" className="strong">Deposit now →</Link>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doJoin}
        busy={joining}
        title="Confirm Tournament Entry"
        confirmLabel="Confirm & Join"
        message={
          <div>
            <p className="mb8">
              You are about to join <b>{t.name}</b> ({t.game} · {t.type}).
            </p>
            <dl className="kv">
              <dt>Entry Fee</dt>
              <dd>{fmtNcc(t.entryFee, s.coinSymbol)}</dd>
              <dt>Current Balance</dt>
              <dd>{fmtNcc(available, s.coinSymbol)}</dd>
              <dt>Balance After Joining</dt>
              <dd className={available - t.entryFee < 0 ? 'text-red' : 'text-green'}>
                {fmtNcc(available - t.entryFee, s.coinSymbol)}
              </dd>
            </dl>
            {available < t.entryFee && (
              <div className="alert alert-warn mt16" style={{ marginBottom: 0 }}>
                Insufficient balance — please <Link to="/deposit" className="strong">deposit coins</Link> first.
              </div>
            )}
          </div>
        }
      />
    </div>
  )
}
