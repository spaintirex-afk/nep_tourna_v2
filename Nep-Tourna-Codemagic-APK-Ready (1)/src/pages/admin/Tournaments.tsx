import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDB } from '../../store'
import { Card, ConfirmDialog, EmptyState, Pagination, StatusBadge, usePagination, useToast } from '../../components/ui'
import { cancelTournament, deleteTournament, setTournamentStatus, type ActionResult } from '../../lib/actions'
import { fmtDate, fmtNcc, fmtTime } from '../../lib/format'
import type { Tournament, TournamentStatus } from '../../lib/types'

const STATUSES: TournamentStatus[] = ['upcoming', 'registration_open', 'registration_closed', 'live', 'completed', 'cancelled']

export default function Tournaments() {
  const db = useDB()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [confirm, setConfirm] = useState<{ t: Tournament; kind: 'cancel' | 'delete' } | null>(null)

  const run = async (fn: () => Promise<ActionResult>, okMsg: string) => {
    try {
      const r = await fn()
      if (r.ok) toast.push('success', okMsg)
      else toast.push('error', r.error)
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Action failed.')
    }
  }

  const joinedCount = (tId: string) => db.registrations.filter((r) => r.tournamentId === tId && r.status === 'joined').length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return db.tournaments.filter((t) => (!q || t.name.toLowerCase().includes(q)) && (!status || t.status === status))
  }, [db.tournaments, search, status])

  const { page, pages, slice, setPage } = usePagination(filtered, 8)

  const doConfirm = async () => {
    if (!confirm) return
    if (confirm.kind === 'cancel') await run(async () => await cancelTournament(confirm.t.id, true), `Tournament "${confirm.t.name}" cancelled. Entry fees refunded.`)
    else await run(async () => await deleteTournament(confirm.t.id), `Tournament "${confirm.t.name}" deleted.`)
    setConfirm(null)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Tournaments</h1>
          <div className="sub">{db.tournaments.length} total · manage events, registration and lifecycle</div>
        </div>
        <Link to="/admin/tournaments/new" className="btn btn-primary">+ Create Tournament</Link>
      </div>

      <div className="filters">
        <div className="search-input">
          <input className="input" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon="🏆"
            title="No tournaments found"
            message={search || status ? 'Try adjusting your search or filters.' : 'Create your first tournament to get started.'}
            action={!search && !status ? <Link to="/admin/tournaments/new" className="btn btn-primary">+ Create Tournament</Link> : undefined}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table cards-mobile">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Game / Type</th>
                    <th>Entry Fee</th>
                    <th>Prize Pool</th>
                    <th>Date &amp; Time</th>
                    <th>Slots</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((t) => {
                    const joined = joinedCount(t.id)
                    return (
                      <tr key={t.id}>
                        <td data-label="Name" className="span2">
                          <div className="strong truncate" style={{ maxWidth: 220 }}>{t.name}</div>
                        </td>
                        <td data-label="Game / Type">{t.game} · {t.type}</td>
                        <td data-label="Entry Fee">{t.entryFee > 0 ? fmtNcc(t.entryFee) : <span className="muted">Free</span>}</td>
                        <td data-label="Prize Pool"><span className="text-green strong">{fmtNcc(t.prizePool)}</span></td>
                        <td data-label="Date & Time">{fmtDate(t.date)} · {fmtTime(t.startTime)}</td>
                        <td data-label="Slots">
                          <span className={joined >= t.maxPlayers ? 'text-red strong' : ''}>{joined}</span> / {t.maxPlayers}
                        </td>
                        <td data-label="Status"><StatusBadge status={t.status} /></td>
                        <td data-label="Actions" className="span2">
                          <div className="row wrap" style={{ gap: 6 }}>
                            <Link to={`/admin/tournaments/${t.id}/edit`} className="btn btn-sm btn-outline">Edit</Link>
                            {t.status === 'registration_open' ? (
                              <button className="btn btn-sm btn-outline" onClick={async () => await run(async () => await setTournamentStatus(t.id, 'registration_closed'), 'Registration closed.')}>Close Reg</button>
                            ) : (
                              t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'live' && (
                                <button className="btn btn-sm btn-success" onClick={async () => await run(async () => await setTournamentStatus(t.id, 'registration_open'), 'Registration opened.')}>Open Reg</button>
                              )
                            )}
                            {t.status !== 'live' && t.status !== 'completed' && t.status !== 'cancelled' && (
                              <button className="btn btn-sm btn-danger" onClick={async () => await run(async () => await setTournamentStatus(t.id, 'live'), `"${t.name}" is now LIVE.`)}>Go Live</button>
                            )}
                            {t.status === 'live' && (
                              <button className="btn btn-sm btn-blue" onClick={async () => await run(async () => await setTournamentStatus(t.id, 'completed'), `"${t.name}" marked completed.`)}>Complete</button>
                            )}
                            {t.status !== 'cancelled' && t.status !== 'completed' && (
                              <button className="btn btn-sm btn-outline" onClick={() => setConfirm({ t, kind: 'cancel' })}>Cancel</button>
                            )}
                            {joined === 0 && (
                              <button className="btn btn-sm btn-ghost text-red" onClick={() => setConfirm({ t, kind: 'delete' })}>Delete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onChange={setPage} />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={confirm?.kind === 'cancel'}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        title="Cancel tournament?"
        danger
        confirmLabel="Cancel Tournament"
        message={
          confirm?.kind === 'cancel' ? (
            <div>
              <p>You are about to cancel <b>"{confirm.t.name}"</b>.</p>
              {joinedCount(confirm.t.id) > 0 && confirm.t.entryFee > 0 && (
                <p className="mt8">
                  ⚠ The <b>{joinedCount(confirm.t.id)}</b> joined player(s) will each receive an automatic refund of{' '}
                  <b>{fmtNcc(confirm.t.entryFee)}</b> to their wallets.
                </p>
              )}
              <p className="mt8">This cannot be undone.</p>
            </div>
          ) : ''
        }
      />

      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        title="Delete tournament?"
        danger
        confirmLabel="Delete Forever"
        message={
          confirm?.kind === 'delete' ? (
            <div>
              <p>Permanently delete <b>"{confirm.t.name}"</b> and all of its matches?</p>
              <p className="mt8">This action cannot be undone.</p>
            </div>
          ) : ''
        }
      />
    </div>
  )
}
