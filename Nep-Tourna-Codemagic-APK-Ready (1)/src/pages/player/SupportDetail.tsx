import { useMemo, useRef, useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCurrentUser, useDB } from '../../store'
import { replyTicket } from '../../lib/actions'
import { timeAgo } from '../../lib/format'
import { Card, CardHead, EmptyState, StatusBadge, useToast } from '../../components/ui'

export default function SupportDetail() {
  const { id } = useParams()
  const db = useDB()
  const user = useCurrentUser()
  const toast = useToast()
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const ticket = db.tickets.find((t) => t.id === id)

  const messages = useMemo(() => ticket?.messages ?? [], [ticket])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages.length])

  if (!ticket || (user && ticket.userId !== user.id)) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1>Support Ticket</h1>
            <div className="sub">Ticket details</div>
          </div>
        </div>
        <Card>
          <EmptyState
            icon="🔒"
            title="Ticket not found"
            message="This ticket doesn't exist or you don't have permission to view it."
            action={<Link to="/support" className="btn btn-sm btn-primary mt8">← Back to support</Link>}
          />
        </Card>
      </div>
    )
  }

  const onSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!reply.trim() || !user) return
    setBusy(true)
    const res = await replyTicket(ticket.id, user.id, reply)
    setBusy(false)
    if (res.ok) {
      setReply('')
      toast.push('success', 'Reply sent.')
    } else {
      toast.push('error', res.error)
    }
  }

  const closed = ticket.status === 'closed' || ticket.status === 'resolved'

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <h1>
            <Link to="/support" className="muted" style={{ fontWeight: 600 }}>Support</Link> / {ticket.subject}
          </h1>
          <div className="sub mono">{ticket.id} · opened {timeAgo(ticket.createdAt)}</div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <StatusBadge status={ticket.category} label={ticket.category.replace(/_/g, ' ')} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      <Card className="mb16">
        <CardHead
          title="Conversation"
          sub={`${ticket.messages.length} message${ticket.messages.length === 1 ? '' : 's'}`}
        />
        <div className="chat" ref={chatRef}>
          {ticket.messages.map((m) => {
            const mine = user && m.authorId === user.id
            return (
              <div key={m.id} className={`msg ${mine ? 'player' : 'admin'}`}>
                <div className="m-meta">
                  {mine ? 'You' : `${m.authorName} · Admin`} · {timeAgo(m.createdAt)}
                </div>
                <div style={{ whiteSpace: 'pre-line' }}>{m.message}</div>
                {m.attachment && (
                  <img
                    src={m.attachment}
                    alt="Attachment"
                    style={{ maxWidth: 180, borderRadius: 8, marginTop: 8, border: '1px solid rgba(0,0,0,0.12)' }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {closed ? (
        <div className="alert alert-success">
          ✅ This ticket is <b>{ticket.status}</b>. If you still need help, open a new ticket from the{' '}
          <Link to="/support" className="strong">support page</Link>.
        </div>
      ) : (
        <Card>
          <form onSubmit={onSend} className="card-pad">
            <div className="field" style={{ marginBottom: 10 }}>
              <textarea
                className="textarea"
                style={{ minHeight: 70 }}
                placeholder="Write your reply…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
            </div>
            <div className="row between">
              <span className="small muted">Support usually replies within a few hours.</span>
              <button type="submit" className="btn btn-primary" disabled={busy || !reply.trim()}>
                {busy ? 'Sending…' : '➤ Send Reply'}
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
