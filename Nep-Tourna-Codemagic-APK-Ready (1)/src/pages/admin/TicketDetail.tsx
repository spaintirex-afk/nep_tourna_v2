import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCurrentUser, useDB } from '../../store'
import { Avatar, Card, CardHead, EmptyState, StatusBadge, useToast } from '../../components/ui'
import { replyTicket, setTicketStatus } from '../../lib/actions'
import { fmtDateTime, timeAgo } from '../../lib/format'
import type { TicketStatus } from '../../lib/types'

const STATUSES: TicketStatus[] = ['open', 'in_progress', 'waiting', 'resolved', 'closed']

export default function TicketDetail() {
  const { id } = useParams()
  const db = useDB()
  const me = useCurrentUser()
  const toast = useToast()
  const [reply, setReply] = useState('')
  const [replyError, setReplyError] = useState('')

  const ticket = db.tickets.find((t) => t.id === id)
  const user = ticket ? db.users.find((u) => u.id === ticket.userId) : undefined

  if (!ticket) {
    return (
      <div className="page">
        <EmptyState icon="🎧" title="Ticket not found" message="This ticket may have been removed." action={<Link to="/admin/tickets" className="btn btn-primary">Back to Tickets</Link>} />
      </div>
    )
  }

  const onSend = async () => {
    if (!reply.trim()) {
      setReplyError('Message cannot be empty.')
      return
    }
    if (!me) return
    try {
      const r = await replyTicket(ticket.id, me.id, reply.trim())
      if (r.ok) {
        toast.push('success', 'Reply sent.')
        setReply('')
        setReplyError('')
      } else {
        toast.push('error', r.error)
      }
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Action failed.')
    }
  }

  const onStatus = async (s: TicketStatus) => {
    try {
      const r = await setTicketStatus(ticket.id, s)
      if (r.ok) toast.push('success', `Ticket marked as ${s.replace(/_/g, ' ')}.`)
      else toast.push('error', r.error)
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Action failed.')
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{ticket.subject}</h1>
          <div className="sub">
            <span className="mono">{ticket.id}</span> · opened {fmtDateTime(ticket.createdAt)} · <StatusBadge status={ticket.status} />
          </div>
        </div>
        <Link to="/admin/tickets" className="btn btn-outline">← Back to Tickets</Link>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHead title="Conversation" sub={`${ticket.messages.length} messages`} />
          <div className="chat">
            {ticket.messages.map((m) => (
              <div key={m.id} className={`msg ${m.authorRole === 'admin' ? 'admin' : 'player'}`}>
                <div className="m-meta">
                  {m.authorName} {m.authorRole === 'admin' ? '(Admin)' : ''} · {timeAgo(m.createdAt)}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.message}</div>
                {m.attachment && (
                  <img src={m.attachment} alt="Attachment" style={{ marginTop: 8, maxWidth: 200, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }} />
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: '0 18px 18px' }}>
            <textarea
              className={`textarea ${replyError ? 'invalid' : ''}`}
              placeholder="Type your reply as admin…"
              value={reply}
              onChange={(e) => { setReply(e.target.value); setReplyError('') }}
            />
            {replyError && <div className="err text-red small mt8">⚠ {replyError}</div>}
            <div className="row between mt8">
              <span className="muted small">Replying as {me?.fullName ?? 'admin'}</span>
              <button className="btn btn-primary" onClick={onSend}>Send Reply ➤</button>
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 18 }}>
          <Card pad>
            <CardHead title="Player" />
            {user ? (
              <div style={{ paddingTop: 12 }}>
                <div className="row" style={{ gap: 12 }}>
                  <Avatar name={user.fullName} color={user.avatarColor} />
                  <div style={{ minWidth: 0 }}>
                    <div className="strong truncate">{user.fullName}</div>
                    <div className="muted small">@{user.username}</div>
                  </div>
                </div>
                <div className="divider" />
                <dl className="kv">
                  <dt>Email</dt><dd className="truncate">{user.email}</dd>
                  <dt>Status</dt><dd><StatusBadge status={user.status} /></dd>
                </dl>
                <Link to={`/admin/players/${user.id}`} className="btn btn-sm btn-outline btn-block mt16">View Player Profile</Link>
              </div>
            ) : (
              <div className="muted" style={{ paddingTop: 12 }}>Unknown user ({ticket.userId})</div>
            )}
          </Card>

          <Card pad>
            <CardHead title="Ticket Details" />
            <div style={{ paddingTop: 12 }}>
              <dl className="kv">
                <dt>Category</dt><dd><StatusBadge status={ticket.category} label={ticket.category} /></dd>
                <dt>Created</dt><dd>{fmtDateTime(ticket.createdAt)}</dd>
                <dt>Messages</dt><dd>{ticket.messages.length}</dd>
              </dl>
              <div className="divider" />
              <label className="small strong muted" style={{ display: 'block', marginBottom: 6 }}>Change status</label>
              <select className="select" value={ticket.status} onChange={(e) => onStatus(e.target.value as TicketStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
