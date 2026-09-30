import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser, useDB } from '../../store'
import { fmtNcc } from '../../lib/format'
import { Avatar, Card, EmptyState, SkeletonTable, Tabs, useFakeLoading } from '../../components/ui'
import type { MatchResult } from '../../lib/types'

interface Row {
  userId: string
  playerName: string
  ffUid: string
  matches: number
  kills: number
  points: number
  bonus: number
  total: number
  prize: number
}

function aggregate(results: MatchResult[]): Row[] {
  const map = new Map<string, Row>()
  for (const r of results) {
    for (const e of r.entries) {
      const key = e.userId || e.playerName || e.ffUid
      if (!key) continue
      const cur =
        map.get(key) ??
        ({ userId: e.userId, playerName: e.playerName, ffUid: e.ffUid, matches: 0, kills: 0, points: 0, bonus: 0, total: 0, prize: 0 } as Row)
      cur.matches += 1
      cur.kills += e.kills
      cur.points += e.points
      cur.bonus += e.bonus
      cur.total += e.total
      cur.prize += e.prize
      if (e.playerName) cur.playerName = e.playerName
      if (e.ffUid) cur.ffUid = e.ffUid
      map.set(key, cur)
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total || b.kills - a.kills)
}

export default function Leaderboard() {
  const db = useDB()
  const user = useCurrentUser()
  const loading = useFakeLoading([], 450)
  const [tab, setTab] = useState('overall')

  const s = db.settings.wallet

  const published = useMemo(() => db.results.filter((r) => r.status === 'published'), [db.results])

  const tournamentsWithResults = useMemo(() => {
    const ids = Array.from(new Set(published.map((r) => r.tournamentId)))
    return ids
      .map((id) => db.tournaments.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => !!t)
  }, [published, db.tournaments])

  const rows = useMemo(() => {
    if (tab === 'overall') return aggregate(published)
    return aggregate(published.filter((r) => r.tournamentId === tab))
  }, [tab, published])

  const tabs = [
    { id: 'overall', label: '🌐 Overall' },
    ...tournamentsWithResults.map((t) => ({ id: t.id, label: t.name })),
  ]

  const rankClass = (i: number) => (i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '')
  const rankIcon = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Leaderboard</h1>
          <div className="sub">Standings computed from published match results</div>
        </div>
        <Link to="/tournaments" className="btn btn-outline">🏆 Join a tournament</Link>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <Card>
        {loading ? (
          <SkeletonTable rows={6} cols={10} />
        ) : published.length === 0 ? (
          <EmptyState
            icon="📊"
            title="No published results yet"
            message="Leaderboards appear here as soon as tournament results are published by the organizers."
            action={<Link to="/tournaments" className="btn btn-sm btn-primary mt8">Browse tournaments</Link>}
          />
        ) : rows.length === 0 ? (
          <EmptyState icon="📊" title="No standings for this tournament" message="Results are not published for this event yet." />
        ) : (
          <div className="table-wrap">
            <table className="table cards-mobile">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>FF Name</th>
                  <th>UID</th>
                  <th className="num">Matches</th>
                  <th className="num">Kills</th>
                  <th className="num">Placement Pts</th>
                  <th className="num">Kill Pts</th>
                  <th className="num">Total</th>
                  <th className="num">Prize</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const u = db.users.find((x) => x.id === r.userId)
                  const me = r.userId === user?.id
                  return (
                    <tr key={`${r.userId}-${i}`} className={me ? 'lb-me' : ''}>
                      <td data-label="Rank" className={`lb-rank ${rankClass(i)}`}>{rankIcon(i)}</td>
                      <td data-label="Player" className="span2">
                        <div className="row" style={{ gap: 8 }}>
                          <Avatar name={u?.fullName || r.playerName || '?'} color={u?.avatarColor ?? 'var(--blue)'} size="avatar-sm" />
                          <div>
                            <div className="strong">{u?.fullName || r.playerName || 'Unknown'}</div>
                            {me && <div className="small text-blue strong">You</div>}
                          </div>
                        </div>
                      </td>
                      <td data-label="FF Name">{r.playerName || '—'}</td>
                      <td data-label="UID" className="mono small">{r.ffUid || '—'}</td>
                      <td data-label="Matches" className="num">{r.matches}</td>
                      <td data-label="Kills" className="num strong">{r.kills}</td>
                      <td data-label="Placement Pts" className="num">{r.points}</td>
                      <td data-label="Kill Pts" className="num">{r.bonus}</td>
                      <td data-label="Total" className="num strong text-blue">{r.total}</td>
                      <td data-label="Prize" className="num">
                        {r.prize > 0 ? <span className="prize-tag">{fmtNcc(r.prize, s.coinSymbol)}</span> : <span className="muted">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
