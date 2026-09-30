import { useState } from 'react'
import { useDB } from '../../store'
import { Badge, Card, ConfirmDialog, EmptyState, Field, Modal, StatusBadge, useToast } from '../../components/ui'
import { deleteAnnouncement, saveAnnouncement, setAnnouncementStatus, type ActionResult } from '../../lib/actions'
import { fmtDate, readFileAsDataURL, timeAgo } from '../../lib/format'
import type { Announcement, AnnouncementStatus, AnnouncementType, Priority } from '../../lib/types'

const TYPES: AnnouncementType[] = ['general', 'tournament', 'maintenance', 'payment', 'important']
const PRIORITIES: Priority[] = ['low', 'normal', 'high']
const STATUSES: AnnouncementStatus[] = ['draft', 'published', 'unpublished']

interface FormState {
  id?: string
  title: string
  message: string
  type: AnnouncementType
  priority: Priority
  publishDate: string
  image: string
  status: AnnouncementStatus
}

const emptyForm = (): FormState => ({
  title: '', message: '', type: 'general', priority: 'normal', publishDate: new Date().toISOString().slice(0, 10), image: '', status: 'draft',
})

export default function Announcements() {
  const db = useDB()
  const toast = useToast()
  const [modal, setModal] = useState<FormState | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toDelete, setToDelete] = useState<Announcement | null>(null)

  const run = async (fn: () => Promise<ActionResult>, okMsg: string): Promise<boolean> => {
    try {
      const r = await fn()
      if (r.ok) toast.push('success', okMsg)
      else toast.push('error', r.error)
      return r.ok
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Action failed.')
      return false
    }
  }

  const openEdit = (a: Announcement) => {
    setErrors({})
    setModal({ id: a.id, title: a.title, message: a.message, type: a.type, priority: a.priority, publishDate: a.publishDate, image: a.image ?? '', status: a.status })
  }

  const onSave = async () => {
    if (!modal) return
    const e: Record<string, string> = {}
    if (!modal.title.trim()) e.title = 'Title is required.'
    if (!modal.message.trim()) e.message = 'Message is required.'
    if (!modal.publishDate) e.publishDate = 'Publish date is required.'
    setErrors(e)
    if (Object.keys(e).length > 0) return
    const ok = await run(
      async () =>
        await saveAnnouncement({
          id: modal.id,
          title: modal.title.trim(),
          message: modal.message.trim(),
          type: modal.type,
          priority: modal.priority,
          publishDate: modal.publishDate,
          image: modal.image || undefined,
          status: modal.status,
        }),
      modal.id ? 'Announcement updated.' : 'Announcement created.',
    )
    if (ok) setModal(null)
  }

  const onImage = async (f: File | undefined) => {
    if (!f || !modal) return
    try {
      setModal({ ...modal, image: await readFileAsDataURL(f) })
    } catch {
      toast.push('error', 'Could not read the image file.')
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Announcements</h1>
          <div className="sub">{db.announcements.length} total · broadcast news to all players</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setErrors({}); setModal(emptyForm()) }}>+ New Announcement</button>
      </div>

      <Card>
        {db.announcements.length === 0 ? (
          <EmptyState icon="📢" title="No announcements yet" message="Publish news, event updates and maintenance notices to players." action={<button className="btn btn-primary" onClick={() => setModal(emptyForm())}>+ New Announcement</button>} />
        ) : (
          <div className="table-wrap">
            <table className="table cards-mobile">
              <thead>
                <tr><th>Title</th><th>Type</th><th>Priority</th><th>Publish Date</th><th>Status</th><th>Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {db.announcements.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Title" className="span2">
                      <div className="row" style={{ gap: 10 }}>
                        {a.image && <img src={a.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />}
                        <div style={{ minWidth: 0 }}>
                          <div className="strong truncate" style={{ maxWidth: 240 }}>{a.title}</div>
                          <div className="muted small truncate" style={{ maxWidth: 240 }}>{a.message}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Type"><Badge color={a.type === 'important' ? 'red' : a.type === 'tournament' ? 'violet' : a.type === 'maintenance' ? 'amber' : a.type === 'payment' ? 'green' : 'blue'}>{a.type}</Badge></td>
                    <td data-label="Priority"><StatusBadge status={a.priority} /></td>
                    <td data-label="Publish Date">{fmtDate(a.publishDate)}</td>
                    <td data-label="Status"><StatusBadge status={a.status} /></td>
                    <td data-label="Created">{timeAgo(a.createdAt)}</td>
                    <td data-label="Actions" className="span2">
                      <div className="row wrap" style={{ gap: 6 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => openEdit(a)}>Edit</button>
                        {a.status === 'published' ? (
                          <button className="btn btn-sm btn-outline" onClick={async () => await run(async () => await setAnnouncementStatus(a.id, 'unpublished'), 'Announcement unpublished.')}>Unpublish</button>
                        ) : (
                          <button className="btn btn-sm btn-success" onClick={async () => await run(async () => await setAnnouncementStatus(a.id, 'published'), 'Announcement published — visible to players instantly.')}>Publish</button>
                        )}
                        <button className="btn btn-sm btn-ghost text-red" onClick={() => setToDelete(a)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Edit Announcement' : 'New Announcement'}
        wide
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={onSave}>{modal?.id ? 'Save Changes' : 'Create'}</button>
          </>
        }
      >
        {modal && (
          <>
            <div className="alert alert-info">📢 Published announcements appear <b>instantly</b> on player dashboards and in their notifications.</div>
            <div className="form-grid">
              <div className="full">
                <Field label="Title" required error={errors.title}>
                  <input className={`input ${errors.title ? 'invalid' : ''}`} value={modal.title} onChange={(e) => setModal({ ...modal, title: e.target.value })} placeholder="e.g. Weekly Squad Cup starts Friday!" />
                </Field>
              </div>
              <div className="full">
                <Field label="Message" required error={errors.message}>
                  <textarea className={`textarea ${errors.message ? 'invalid' : ''}`} value={modal.message} onChange={(e) => setModal({ ...modal, message: e.target.value })} placeholder="Write the announcement body…" />
                </Field>
              </div>
              <Field label="Type">
                <select className="select" value={modal.type} onChange={(e) => setModal({ ...modal, type: e.target.value as AnnouncementType })}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select className="select" value={modal.priority} onChange={(e) => setModal({ ...modal, priority: e.target.value as Priority })}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Publish Date" required error={errors.publishDate}>
                <input className={`input ${errors.publishDate ? 'invalid' : ''}`} type="date" value={modal.publishDate} onChange={(e) => setModal({ ...modal, publishDate: e.target.value })} />
              </Field>
              <Field label="Status">
                <select className="select" value={modal.status} onChange={(e) => setModal({ ...modal, status: e.target.value as AnnouncementStatus })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <div className="full">
                <Field label="Image (optional)">
                  <input className="input" type="file" accept="image/*" onChange={(e) => onImage(e.target.files?.[0])} />
                </Field>
                {modal.image && (
                  <div className="row mt8" style={{ gap: 12 }}>
                    <img src={modal.image} alt="Preview" style={{ width: 160, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                    <button className="btn btn-sm btn-outline text-red" onClick={() => setModal({ ...modal, image: '' })}>Remove</button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await run(async () => await deleteAnnouncement(toDelete.id), 'Announcement deleted.'); setToDelete(null) }}
        title="Delete announcement?"
        danger
        confirmLabel="Delete"
        message={toDelete ? <div><p>Permanently delete <b>"{toDelete.title}"</b>?</p><p className="mt8">Players who already saw it will not get it back. This cannot be undone.</p></div> : ''}
      />
    </div>
  )
}
