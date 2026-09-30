import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDB } from '../../store'
import { Avatar, Card, EmptyState, StatusBadge } from '../../components/ui'
import { fmtDateTime, timeAgo } from '../../lib/format'
import type { TicketCategory, TicketStatus } from '../../lib/types'

const STATUSES: TicketStatus[] = ['open', 'in_progress', 'waiting', 'resolved', 'closed']
const CATEGORIES: TicketCategory[] = ['deposit', 'withdrawal', 'tournament', 'account', 'technical', 'other']

export default function Tickets() {
  const db = useDB()
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')

  const lastActivity = (msgs: { createdAt: string }[]) =>
    msgs.length > 0 ? msgs[msgs.length - 1].createdAt : undefined

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return db.tickets.filter((t) => {
      if (status && t.status !== status) return false
      if (category && t.category !== category) return false
      if (q) {
        const u = db.users.find((x) => x.id === t.userId)
        const hay = `${t.subject} ${u?.fullName ?? ''} ${u?.username ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [db.tickets, db.users, status, category, search])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Support Tickets</h1>
          <div className="sub">{db.tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length} open · {db.tickets.length} total</div>
        </div>
      </div>

      <div className="filters">
        <div className="search-input">
          <input className="input" placeholder="Search subject or player…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon="🎧"
            title="No tickets found"
            message={search || status || category ? 'No tickets match the current filters.' : 'Player support tickets will appear here.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="table cards-mobile">
              <thead>
                <tr><th>ID</th><th>Player</th><th>Subject</th><th>Category</th><th>Status</th><th>Messages</th><th>Last Activity</th><th>Created</th></tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const u = db.users.find((x) => x.id === t.userId)
                  const la = lastActivity(t.messages)
                  return (
                    <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/tickets/${t.id}`)}>
                      <td data-label="ID" className="mono">{t.id}</td>
                      <td data-label="Player" className="span2">
                        {u ? (
                          <span className="row" style={{ gap: 8 }}>
                            <Avatar name={u.fullName} color={u.avatarColor} size="avatar-sm" />
                            <span style={{ minWidth: 0 }}>
                              <span className="strong truncate" style={{ display: 'block', maxWidth: 140 }}>{u.fullName}</span>
                              <span className="muted small">@{u.username}</span>
                            </span>
                          </span>
                        ) : <span className="muted">{t.userId}</span>}
                      </td>
                      <td data-label="Subject" className="span2 truncate" style={{ maxWidth: 240 }}>{t.subject}</td>
                      <td data-label="Category"><StatusBadge status={t.category} label={t.category} /></td>
                      <td data-label="Status"><StatusBadge status={t.status} /></td>
                      <td data-label="Messages">💬 {t.messages.length}</td>
                      <td data-label="Last Activity">{la ? timeAgo(la) : '—'}</td>
                      <td data-label="Created">{fmtDateTime(t.createdAt)}</td>
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
