import { useMemo, useState } from 'react'
import { useDB } from '../../store'
import { Card, EmptyState, Avatar } from '../../components/ui'
import { fmtNcc } from '../../lib/format'

interface Agg {
  userId: string
  playerName: string
  ffName: string
  ffUid: string
  matches: number
  kills: number
  points: number
  bonus: number
  total: number
  prize: number
}

export default function Leaderboards() {
  const db = useDB()
  const [scope, setScope] = useState('overall')

  const published = useMemo(() => db.results.filter((r) => r.status === 'published'), [db.results])
  const tournamentsWithResults = useMemo(
    () =>
      [...new Set(published.map((r) => r.tournamentId))]
        .map((tid) => db.tournaments.find((t) => t.id === tid))
        .filter((t): t is NonNullable<typeof t> => Boolean(t)),
    [published, db.tournaments],
  )

  const rows = useMemo(() => {
    const source = scope === 'overall' ? published : published.filter((r) => r.tournamentId === scope)
    const map = new Map<string, Agg>()
    for (const res of source) {
      for (const e of res.entries) {
        const u = db.users.find((x) => x.id === e.userId)
        const cur = map.get(e.userId) ?? {
          userId: e.userId,
          playerName: u?.fullName ?? e.playerName,
          ffName: u?.ffIgn ?? '',
          ffUid: e.ffUid || u?.ffUid || '',
          matches: 0, kills: 0, points: 0, bonus: 0, total: 0, prize: 0,
        }
        cur.matches += 1
        cur.kills += e.kills
        cur.points += e.points
        cur.bonus += e.bonus
        cur.total += e.total
        cur.prize += e.prize
        map.set(e.userId, cur)
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total || b.kills - a.kills)
  }, [scope, published, db.users])

  const rankCell = (i: number) => (
    <td data-label="Rank" className={`lb-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
    </td>
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Leaderboards</h1>
          <div className="sub">Derived automatically from published match results</div>
        </div>
      </div>

      <div className="filters">
        <select className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="overall">🌐 Overall (all tournaments)</option>
          {tournamentsWithResults.map((t) => (
            <option key={t.id} value={t.id}>🏆 {t.name}</option>
          ))}
        </select>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="📊"
            title="No leaderboard data yet"
            message="Leaderboards populate automatically once match results are published."
          />
        ) : (
          <div className="table-wrap">
            <table className="table cards-mobile">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>FF Name</th>
                  <th>UID</th>
                  <th>Matches</th>
                  <th>Kills</th>
                  <th>Placement Pts</th>
                  <th>Kill Pts</th>
                  <th>Total</th>
                  <th>Prize Won</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const u = db.users.find((x) => x.id === r.userId)
                  return (
                    <tr key={r.userId}>
                      {rankCell(i)}
                      <td data-label="Player">
                        <span className="row" style={{ gap: 8 }}>
                          {u && <Avatar name={u.fullName} color={u.avatarColor} size="avatar-sm" />}
                          <span className="strong truncate" style={{ maxWidth: 160 }}>{r.playerName}</span>
                        </span>
                      </td>
                      <td data-label="FF Name">{r.ffName || <span className="muted">—</span>}</td>
                      <td data-label="UID" className="mono">{r.ffUid || '—'}</td>
                      <td data-label="Matches">{r.matches}</td>
                      <td data-label="Kills">{r.kills}</td>
                      <td data-label="Placement Pts">{r.points}</td>
                      <td data-label="Kill Pts">{r.bonus}</td>
                      <td data-label="Total" className="strong text-blue">{r.total}</td>
                      <td data-label="Prize">{r.prize > 0 ? <span className="text-green strong">{fmtNcc(r.prize)}</span> : <span className="muted">—</span>}</td>
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
