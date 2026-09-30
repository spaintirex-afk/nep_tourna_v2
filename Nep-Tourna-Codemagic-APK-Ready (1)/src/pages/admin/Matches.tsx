import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDB } from '../../store'
import { Card, ConfirmDialog, EmptyState, Field, Modal, StatusBadge, useToast } from '../../components/ui'
import { deleteMatch, saveMatch, setMatchStatus, type ActionResult } from '../../lib/actions'
import { fmtDate, fmtDateTime, fmtTime } from '../../lib/format'
import type { Match, MatchStatus } from '../../lib/types'

const STATUSES: MatchStatus[] = ['scheduled', 'live', 'completed', 'cancelled']

interface FormState {
  id?: string
  name: string
  tournamentId: string
  date: string
  startTime: string
  map: string
  mode: string
  roomId: string
  roomPassword: string
  roomReleaseTime: string // datetime-local value
  status: MatchStatus
}

const emptyForm = (tournamentId = ''): FormState => ({
  name: '', tournamentId, date: '', startTime: '', map: '', mode: '', roomId: '', roomPassword: '', roomReleaseTime: '', status: 'scheduled',
})

function isoToLocalInput(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Matches() {
  const db = useDB()
  const toast = useToast()
  const [modal, setModal] = useState<FormState | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [toDelete, setToDelete] = useState<Match | null>(null)

  const run = async (fn: () => Promise<ActionResult>, okMsg: string) => {
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

  const tName = (id: string) => db.tournaments.find((t) => t.id === id)?.name ?? '—'

  const openCreate = () => {
    setErrors({})
    setModal(emptyForm(db.tournaments[0]?.id ?? ''))
  }

  const openEdit = (m: Match) => {
    setErrors({})
    setModal({
      id: m.id, name: m.name, tournamentId: m.tournamentId, date: m.date, startTime: m.startTime,
      map: m.map, mode: m.mode, roomId: m.roomId, roomPassword: m.roomPassword,
      roomReleaseTime: isoToLocalInput(m.roomReleaseTime), status: m.status,
    })
  }

  const onSave = async () => {
    if (!modal) return
    const e: Record<string, string> = {}
    if (!modal.name.trim()) e.name = 'Match name is required.'
    if (!modal.tournamentId) e.tournamentId = 'Please select a tournament.'
    if (!modal.date) e.date = 'Date is required.'
    setErrors(e)
    if (Object.keys(e).length > 0) return
    const ok = await run(
      async () =>
        await saveMatch({
          id: modal.id,
          name: modal.name.trim(),
          tournamentId: modal.tournamentId,
          date: modal.date,
          startTime: modal.startTime,
          map: modal.map.trim(),
          mode: modal.mode.trim(),
          roomId: modal.roomId.trim(),
          roomPassword: modal.roomPassword.trim(),
          roomReleaseTime: modal.roomReleaseTime ? new Date(modal.roomReleaseTime).toISOString() : '',
          status: modal.status,
        }),
      modal.id ? 'Match updated.' : 'Match created.',
    )
    if (ok) setModal(null)
  }

  const masked = (s: string) => (s ? '••••••' : '—')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Matches</h1>
          <div className="sub">{db.matches.length} matches · schedule rooms and control match lifecycle</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate} disabled={db.tournaments.length === 0}>+ Create Match</button>
      </div>

      {db.tournaments.length === 0 && (
        <div className="alert alert-info">Create a <Link to="/admin/tournaments/new" className="strong">tournament</Link> first — matches belong to a tournament.</div>
      )}

      <Card>
        {db.matches.length === 0 ? (
          <EmptyState icon="🎮" title="No matches yet" message="Create matches to set up rooms, schedules and live status." action={<button className="btn btn-primary" onClick={openCreate} disabled={db.tournaments.length === 0}>+ Create Match</button>} />
        ) : (
          <div className="table-wrap">
            <table className="table cards-mobile">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Tournament</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Map / Mode</th>
                  <th>Room ID / Pass</th>
                  <th>Release Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {db.matches.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Match" className="span2 strong truncate" style={{ maxWidth: 200 }}>{m.name}</td>
                    <td data-label="Tournament" className="truncate" style={{ maxWidth: 160 }}>{tName(m.tournamentId)}</td>
                    <td data-label="Date">{fmtDate(m.date)}</td>
                    <td data-label="Time">{fmtTime(m.startTime)}</td>
                    <td data-label="Map / Mode">{m.map || '—'}{m.mode ? ` · ${m.mode}` : ''}</td>
                    <td data-label="Room">
                      <span className="row" style={{ gap: 6 }}>
                        <span className="mono">{revealed[m.id] ? `${m.roomId || '—'} / ${m.roomPassword || '—'}` : `${masked(m.roomId)} / ${masked(m.roomPassword)}`}</span>
                        <button className="btn-icon" style={{ padding: '2px 4px' }} title={revealed[m.id] ? 'Hide' : 'Reveal'} onClick={() => setRevealed((r) => ({ ...r, [m.id]: !r[m.id] }))}>
                          {revealed[m.id] ? '🙈' : '👁'}
                        </button>
                      </span>
                    </td>
                    <td data-label="Release">{m.roomReleaseTime ? fmtDateTime(m.roomReleaseTime) : <span className="muted">Visible now</span>}</td>
                    <td data-label="Status"><StatusBadge status={m.status} /></td>
                    <td data-label="Actions" className="span2">
                      <div className="row wrap" style={{ gap: 6 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => openEdit(m)}>Edit</button>
                        {m.status === 'scheduled' && (
                          <button className="btn btn-sm btn-danger" onClick={async () => await run(async () => await setMatchStatus(m.id, 'live'), `"${m.name}" is now LIVE. Players notified.`)}>Set Live</button>
                        )}
                        {m.status === 'live' && (
                          <button className="btn btn-sm btn-blue" onClick={async () => await run(async () => await setMatchStatus(m.id, 'completed'), `"${m.name}" marked completed.`)}>Complete</button>
                        )}
                        {m.status !== 'cancelled' && m.status !== 'completed' && (
                          <button className="btn btn-sm btn-outline" onClick={async () => await run(async () => await setMatchStatus(m.id, 'cancelled'), `"${m.name}" cancelled.`)}>Cancel</button>
                        )}
                        <button className="btn btn-sm btn-ghost text-red" onClick={() => setToDelete(m)}>Delete</button>
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
        title={modal?.id ? 'Edit Match' : 'Create Match'}
        wide
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={onSave}>{modal?.id ? 'Save Changes' : 'Create Match'}</button>
          </>
        }
      >
        {modal && (
          <div className="form-grid">
            <div className="full">
              <Field label="Match Name" required error={errors.name}>
                <input className={`input ${errors.name ? 'invalid' : ''}`} value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="e.g. Final — Match 1" />
              </Field>
            </div>
            <div className="full">
              <Field label="Tournament" required error={errors.tournamentId}>
                <select className={`select ${errors.tournamentId ? 'invalid' : ''}`} value={modal.tournamentId} onChange={(e) => setModal({ ...modal, tournamentId: e.target.value })}>
                  <option value="">Select a tournament…</option>
                  {db.tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Date" required error={errors.date}>
              <input className={`input ${errors.date ? 'invalid' : ''}`} type="date" value={modal.date} onChange={(e) => setModal({ ...modal, date: e.target.value })} />
            </Field>
            <Field label="Start Time">
              <input className="input" type="time" value={modal.startTime} onChange={(e) => setModal({ ...modal, startTime: e.target.value })} />
            </Field>
            <Field label="Map">
              <input className="input" value={modal.map} onChange={(e) => setModal({ ...modal, map: e.target.value })} placeholder="e.g. Bermuda" />
            </Field>
            <Field label="Mode">
              <input className="input" value={modal.mode} onChange={(e) => setModal({ ...modal, mode: e.target.value })} placeholder="e.g. Battle Royale" />
            </Field>
            <Field label="Room ID">
              <input className="input" value={modal.roomId} onChange={(e) => setModal({ ...modal, roomId: e.target.value })} />
            </Field>
            <Field label="Room Password">
              <input className="input" value={modal.roomPassword} onChange={(e) => setModal({ ...modal, roomPassword: e.target.value })} />
            </Field>
            <div className="full">
              <Field label="Room Release Time" hint="Players CANNOT see the room ID/password before this time. Leave empty to make room info visible immediately.">
                <input className="input" type="datetime-local" value={modal.roomReleaseTime} onChange={(e) => setModal({ ...modal, roomReleaseTime: e.target.value })} />
              </Field>
            </div>
            <div className="full">
              <Field label="Status">
                <select className="select" value={modal.status} onChange={(e) => setModal({ ...modal, status: e.target.value as MatchStatus })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await run(async () => await deleteMatch(toDelete.id), 'Match deleted.')
          setToDelete(null)
        }}
        title="Delete match?"
        danger
        confirmLabel="Delete Match"
        message={toDelete ? <div><p>Permanently delete <b>"{toDelete.name}"</b> ({tName(toDelete.tournamentId)})?</p><p className="mt8">This cannot be undone.</p></div> : ''}
      />
    </div>
  )
}
