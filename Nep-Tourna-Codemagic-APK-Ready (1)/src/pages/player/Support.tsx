import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCurrentUser, useDB } from '../../store'
import { createTicket } from '../../lib/actions'
import { readFileAsDataURL, timeAgo } from '../../lib/format'
import {
  Card,
  EmptyState,
  Field,
  Modal,
  SkeletonTable,
  StatusBadge,
  useFakeLoading,
  useToast,
} from '../../components/ui'
import type { TicketCategory } from '../../lib/types'

const CATEGORIES: TicketCategory[] = ['deposit', 'withdrawal', 'tournament', 'account', 'technical', 'other']

export default function Support() {
  const db = useDB()
  const user = useCurrentUser()
  const navigate = useNavigate()
  const toast = useToast()
  const loading = useFakeLoading([], 400)
  const fileRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<TicketCategory>('other')
  const [message, setMessage] = useState('')
  const [attachment, setAttachment] = useState<string | undefined>(undefined)
  const [errors, setErrors] = useState<{ subject?: string; message?: string }>({})
  const [busy, setBusy] = useState(false)

  const tickets = useMemo(
    () =>
      db.tickets
        .filter((t) => t.userId === user?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.tickets, user?.id],
  )

  const reset = () => {
    setSubject('')
    setCategory('other')
    setMessage('')
    setAttachment(undefined)
    setErrors({})
    if (fileRef.current) fileRef.current.value = ''
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.push('error', 'Please choose an image file (PNG/JPG).')
      return
    }
    try {
      setAttachment(await readFileAsDataURL(f))
    } catch {
      toast.push('error', 'Could not read that file.')
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: { subject?: string; message?: string } = {}
    if (!subject.trim()) errs.subject = 'Subject is required.'
    if (!message.trim()) errs.message = 'Please describe your issue.'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    if (!user) return

    setBusy(true)
    const res = await createTicket(user.id, subject, category, message, attachment)
    setBusy(false)
    if (res.ok && res.id) {
      toast.push('success', 'Ticket created — our support team will reply soon.')
      setOpen(false)
      reset()
      navigate(`/support/${res.id}`)
    } else if (!res.ok) {
      toast.push('error', res.error)
    }
  }

  const lastActivity = (msgs: { createdAt: string }[]) =>
    msgs.length > 0 ? msgs.map((m) => m.createdAt).sort().reverse()[0] : undefined

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Support</h1>
          <div className="sub">Need help? Open a ticket and our team will get back to you</div>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>🎫 New Ticket</button>
      </div>

      <Card>
        {loading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : tickets.length === 0 ? (
          <EmptyState
            icon="🎧"
            title="No support tickets"
            message="Questions about deposits, withdrawals, tournaments or your account? Open a ticket and we'll help."
            action={
              <button className="btn btn-sm btn-primary mt8" onClick={() => setOpen(true)}>
                Create your first ticket
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table cards-mobile">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Messages</th>
                  <th>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td data-label="Subject" className="span2">
                      <Link to={`/support/${t.id}`} className="strong text-blue">{t.subject}</Link>
                      <div className="small mono muted">{t.id}</div>
                    </td>
                    <td data-label="Category"><StatusBadge status={t.category} label={t.category.replace(/_/g, ' ')} /></td>
                    <td data-label="Status"><StatusBadge status={t.status} /></td>
                    <td data-label="Messages">💬 {t.messages.length}</td>
                    <td data-label="Last Activity" className="small muted">
                      {timeAgo(lastActivity(t.messages) ?? t.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          reset()
        }}
        title="New Support Ticket"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => { setOpen(false); reset() }} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={onSubmit} disabled={busy}>
              {busy ? 'Creating…' : 'Create Ticket'}
            </button>
          </>
        }
      >
        <form onSubmit={onSubmit}>
          <Field label="Subject" required error={errors.subject}>
            <input
              className={`input ${errors.subject ? 'invalid' : ''}`}
              placeholder="Brief summary of your issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Field>
          <Field label="Category" required>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}</option>
              ))}
            </select>
          </Field>
          <Field label="Message" required error={errors.message} hint="Include transaction IDs, tournament names or screenshots where possible.">
            <textarea
              className={`textarea ${errors.message ? 'invalid' : ''}`}
              placeholder="Describe your issue in detail…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
          <Field label="Attachment (optional)">
            <input ref={fileRef} type="file" accept="image/*" className="input" onChange={onFile} />
            {attachment && (
              <div className="row mt8">
                <img src={attachment} alt="Attachment preview" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                <button type="button" className="btn btn-sm btn-ghost text-red" onClick={() => { setAttachment(undefined); if (fileRef.current) fileRef.current.value = '' }}>
                  ✕ Remove
                </button>
              </div>
            )}
          </Field>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy} style={{ display: 'none' }}>
            Create Ticket
          </button>
        </form>
      </Modal>
    </div>
  )
}
