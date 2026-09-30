import { useMemo, useState } from 'react'
import { useDB } from '../../store'
import { Card, EmptyState, Pagination, usePagination } from '../../components/ui'
import { fmtDateTime } from '../../lib/format'
import type { AuditLog } from '../../lib/types'

const CATEGORIES: AuditLog['category'][] = ['auth', 'tournament', 'player', 'finance', 'result', 'content', 'settings']

export default function AuditLogs() {
  const db = useDB()
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [category, setCategory] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const distinctActions = useMemo(() => [...new Set(db.auditLogs.map((l) => l.action))].sort(), [db.auditLogs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return db.auditLogs.filter((l) => {
      if (action && l.action !== action) return false
      if (category && l.category !== category) return false
      if (from && new Date(l.timestamp) < new Date(`${from}T00:00:00`)) return false
      if (to && new Date(l.timestamp) > new Date(`${to}T23:59:59`)) return false
      if (q && !`${l.actorName} ${l.target} ${l.description}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [db.auditLogs, search, action, category, from, to])

  const { page, pages, slice, setPage } = usePagination(filtered, 15)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Audit Logs</h1>
          <div className="sub">{db.auditLogs.length} recorded events · newest first</div>
        </div>
      </div>

      <div className="alert alert-warn">
        🔒 Audit logs are <b>append-only</b>. Entries are recorded automatically by every significant action and cannot be edited or deleted — this trail is your source of truth for disputes.
      </div>

      <div className="filters">
        <div className="search-input">
          <input className="input" placeholder="Search actor, target or description…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {distinctActions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="input" type="date" style={{ width: 'auto' }} value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
        <input className="input" type="date" style={{ width: 'auto' }} value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon="📜" title="No log entries found" message="Try adjusting your search or filters." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table cards-mobile">
                <thead>
                  <tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Target</th><th>Description</th><th>Category</th><th>IP</th></tr>
                </thead>
                <tbody>
                  {slice.map((l) => (
                    <tr key={l.id}>
                      <td data-label="Timestamp" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(l.timestamp)}</td>
                      <td data-label="Actor" className="strong">{l.actorName}</td>
                      <td data-label="Action"><span className="badge badge-plain badge-navy">{l.action}</span></td>
                      <td data-label="Target" className="truncate" style={{ maxWidth: 180 }}>{l.target}</td>
                      <td data-label="Description" className="span2 muted">{l.description}</td>
                      <td data-label="Category"><span className="badge badge-plain badge-gray">{l.category}</span></td>
                      <td data-label="IP" className="mono muted">{l.ip ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  )
}
