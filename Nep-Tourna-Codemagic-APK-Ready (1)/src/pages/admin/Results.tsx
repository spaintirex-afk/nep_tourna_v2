import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDB } from '../../store'
import { Card, EmptyState, StatusBadge, Badge } from '../../components/ui'
import { fmtDate, fmtTime } from '../../lib/format'

type FilterKey = 'all' | 'none' | 'draft' | 'submitted' | 'approved' | 'published'

export default function Results() {
  const db = useDB()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterKey>('all')

  const rows = useMemo(
    () =>
      db.matches.map((m) => {
        const result = db.results.find((r) => r.matchId === m.id)
        return { match: m, result, tournament: db.tournaments.find((t) => t.id === m.tournamentId)?.name ?? '—' }
      }),
    [db.matches, db.results, db.tournaments],
  )

  const statusOf = (r: (typeof rows)[number]['result']): FilterKey => r?.status ?? 'none'
  const filtered = rows.filter((r) => filter === 'all' || statusOf(r.result) === filter)

  const counts = {
    all: rows.length,
    none: rows.filter((r) => statusOf(r.result) === 'none').length,
    draft: rows.filter((r) => statusOf(r.result) === 'draft').length,
    submitted: rows.filter((r) => statusOf(r.result) === 'submitted').length,
    approved: rows.filter((r) => statusOf(r.result) === 'approved').length,
    published: rows.filter((r) => statusOf(r.result) === 'published').length,
  } as Record<FilterKey, number>

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Match Results</h1>
          <div className="sub">Enter scores, run the approval workflow and distribute prizes</div>
        </div>
      </div>

      <div className="filters">
        {(['all', 'none', 'draft', 'submitted', 'approved', 'published'] as FilterKey[]).map((k) => (
          <button key={k} className={`tab ${filter === k ? 'active' : ''}`} style={{ borderBottom: filter === k ? '2.5px solid var(--blue-electric)' : '2.5px solid transparent' }} onClick={() => setFilter(k)}>
            {k === 'none' ? 'No Result' : k[0].toUpperCase() + k.slice(1)} <span className="muted small">({counts[k]})</span>
          </button>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon="🏅" title="No matches here" message={rows.length === 0 ? 'Create matches first — results are attached to matches.' : 'No matches match this result filter.'} />
        ) : (
          <div className="table-wrap">
            <table className="table cards-mobile">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Tournament</th>
                  <th>Date &amp; Time</th>
                  <th>Match Status</th>
                  <th>Result Status</th>
                  <th>Prizes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ match, result, tournament }) => (
                  <tr key={match.id}>
                    <td data-label="Match" className="span2 strong truncate" style={{ maxWidth: 220 }}>{match.name}</td>
                    <td data-label="Tournament" className="truncate" style={{ maxWidth: 180 }}>{tournament}</td>
                    <td data-label="Date & Time">{fmtDate(match.date)} · {fmtTime(match.startTime)}</td>
                    <td data-label="Match Status"><StatusBadge status={match.status} /></td>
                    <td data-label="Result Status">
                      {result ? <StatusBadge status={result.status} /> : <Badge color="gray">None</Badge>}
                    </td>
                    <td data-label="Prizes">
                      {!result ? (
                        <span className="muted">—</span>
                      ) : result.prizesDistributed ? (
                        <span className="text-green strong">✓ Distributed</span>
                      ) : result.entries.some((e) => e.prize > 0) ? (
                        <span className="text-amber strong">Pending</span>
                      ) : (
                        <span className="muted">No prizes</span>
                      )}
                    </td>
                    <td data-label="Action" className="span2">
                      <button className="btn btn-sm btn-blue" onClick={() => navigate(`/admin/results/${match.id}`)}>Manage Results</button>
                    </td>
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
