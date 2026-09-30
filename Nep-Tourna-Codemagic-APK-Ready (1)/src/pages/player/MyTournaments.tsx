import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser, useDB } from '../../store'
import { fmtDate, fmtDateTime, fmtNcc, fmtTime } from '../../lib/format'
import { Card, EmptyState, SkeletonTable, StatusBadge, Tabs, useFakeLoading } from '../../components/ui'
import type { Match, Registration, Tournament } from '../../lib/types'

type TabId = 'all' | 'upcoming' | 'live' | 'completed' | 'cancelled'

function roomVisible(m: Match): boolean {
  if (m.status === 'live' || m.status === 'completed') return true
  if (!m.roomReleaseTime) return true
  return new Date(m.roomReleaseTime).getTime() <= Date.now()
}

export default function MyTournaments() {
  const db = useDB()
  const user = useCurrentUser()
  const loading = useFakeLoading([], 400)
  const [tab, setTab] = useState<TabId>('all')

  const s = db.settings.wallet

  const joined = useMemo(() => {
    const out: { reg: Registration; t: Tournament }[] = []
    if (!user) return out
    const regs = db.registrations.filter((r) => r.userId === user.id && r.status === 'joined')
    for (const r of regs) {
      const t = db.tournaments.find((x) => x.id === r.tournamentId)
      if (t) out.push({ reg: r, t })
    }
    out.sort((a, b) => (b.t.date + b.t.startTime).localeCompare(a.t.date + a.t.startTime))
    return out
  }, [db.registrations, db.tournaments, user])

  const inTab = (t: Tournament): boolean => {
    switch (tab) {
      case 'upcoming':
        return ['upcoming', 'registration_open', 'registration_closed'].includes(t.status)
      case 'live':
        return t.status === 'live'
      case 'completed':
        return t.status === 'completed'
      case 'cancelled':
        return t.status === 'cancelled'
      default:
        return true
    }
  }

  const countOf = (pred: (t: Tournament) => boolean) => joined.filter((j) => pred(j.t)).length
  const rows = joined.filter((j) => inTab(j.t))

  const nextMatch = (tId: string): Match | undefined => {
    const ms = db.matches.filter((m) => m.tournamentId === tId)
    return (
      ms.find((m) => m.status === 'live') ??
      ms
        .filter((m) => m.status === 'scheduled')
        .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0] ??
      ms[0]
    )
  }

  const renderRoom = (t: Tournament) => {
    const m = nextMatch(t.id)
    if (!m) return <span className="muted small">—</span>
    if (!roomVisible(m)) return <span className="muted small">🔒 Releases {fmtDateTime(m.roomReleaseTime)}</span>
    if (!m.roomId) return <span className="muted small">Room TBA</span>
    return (
      <span className="mono small">
        {m.roomId} / {m.roomPassword || '—'}
      </span>
    )
  }

  const tabs = [
    { id: 'all', label: 'All', count: joined.length },
    { id: 'upcoming', label: 'Upcoming / Open', count: countOf((t) => ['upcoming', 'registration_open', 'registration_closed'].includes(t.status)) },
    { id: 'live', label: 'Live', count: countOf((t) => t.status === 'live') },
    { id: 'completed', label: 'Completed', count: countOf((t) => t.status === 'completed') },
    { id: 'cancelled', label: 'Cancelled', count: countOf((t) => t.status === 'cancelled') },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My Tournaments</h1>
          <div className="sub">All tournaments you have registered for</div>
        </div>
        <Link to="/tournaments" className="btn btn-primary">🏆 Browse more</Link>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as TabId)} />

      <Card>
        {loading ? (
          <SkeletonTable rows={4} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="🎯"
            title={tab === 'all' ? 'No tournaments joined yet' : 'Nothing here'}
            message={
              tab === 'all'
                ? 'Join your first tournament and it will show up here with room details and schedule.'
                : 'No joined tournaments match this filter.'
            }
            action={<Link to="/tournaments" className="btn btn-sm btn-primary mt8">Browse tournaments</Link>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table cards-mobile">
              <thead>
                <tr>
                  <th>Tournament</th>
                  <th>Date</th>
                  <th>Start</th>
                  <th>Entry Paid</th>
                  <th>Status</th>
                  <th>Room Info</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ t }) => (
                  <tr key={t.id}>
                    <td data-label="Tournament" className="span2">
                      <Link to={`/tournaments/${t.id}`} className="strong text-blue">{t.name}</Link>
                      <div className="small muted">{t.game} · {t.type}</div>
                    </td>
                    <td data-label="Date">{fmtDate(t.date)}</td>
                    <td data-label="Start">{fmtTime(t.startTime)}</td>
                    <td data-label="Entry Paid">{t.entryFee > 0 ? fmtNcc(t.entryFee, s.coinSymbol) : 'Free'}</td>
                    <td data-label="Status"><StatusBadge status={t.status} /></td>
                    <td data-label="Room Info">{renderRoom(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
