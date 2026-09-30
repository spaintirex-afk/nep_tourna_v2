import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDB } from '../../store'
import { Card, CardHead, ConfirmDialog, EmptyState, StatusBadge, Badge, useToast } from '../../components/ui'
import { distributePrizes, saveResultDraft, setResultStatus, type ActionResult } from '../../lib/actions'
import { fmtNcc } from '../../lib/format'
import type { ResultEntry } from '../../lib/types'

type WorkflowAction = 'submitted' | 'approved' | 'published' | 'distribute'

export default function ResultDetail() {
  const { matchId } = useParams()
  const db = useDB()
  const toast = useToast()
  const [entries, setEntries] = useState<ResultEntry[]>([])
  const [confirm, setConfirm] = useState<WorkflowAction | null>(null)
  const [addUserId, setAddUserId] = useState('')

  const match = db.matches.find((m) => m.id === matchId)
  const result = match ? db.results.find((r) => r.matchId === match.id) : undefined
  const tournament = match ? db.tournaments.find((t) => t.id === match.tournamentId) : undefined

  const registered = useMemo(() => {
    if (!tournament) return []
    return db.registrations
      .filter((r) => r.tournamentId === tournament.id && r.status === 'joined')
      .map((r) => db.users.find((u) => u.id === r.userId))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
  }, [db.registrations, db.users, tournament])

  const editable = !result || result.status === 'draft'
  const status = result?.status ?? 'none'

  // (Re)initialize rows from the saved result, or from registrations when none exists.
  useEffect(() => {
    if (!match || !tournament) return
    if (result) {
      setEntries(result.entries.map((e) => ({ ...e })))
    } else {
      setEntries(
        db.registrations
          .filter((r) => r.tournamentId === tournament.id && r.status === 'joined')
          .map((r) => {
            const u = db.users.find((x) => x.id === r.userId)
            return {
              userId: r.userId,
              playerName: u?.fullName ?? 'Unknown',
              ffUid: u?.ffUid ?? '',
              kills: 0,
              placement: 0,
              points: 0,
              bonus: 0,
              total: 0,
              prize: 0,
            } satisfies ResultEntry
          }),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id, result?.id, result?.status])

  if (!match || !tournament) {
    return (
      <div className="page">
        <EmptyState icon="🏅" title="Match not found" message="This match may have been deleted." action={<Link to="/admin/results" className="btn btn-primary">Back to Results</Link>} />
      </div>
    )
  }

  const prizeForPlacement = (placement: number) => tournament.prizes.find((p) => p.rank === placement)?.amount ?? 0

  const patch = (idx: number, p: Partial<ResultEntry>) => {
    setEntries((prev) =>
      prev.map((e, i) => {
        if (i !== idx) return e
        const next = { ...e, ...p }
        if (p.placement !== undefined) next.prize = prizeForPlacement(p.placement)
        next.total = (Number(next.points) || 0) + (Number(next.bonus) || 0)
        return next
      }),
    )
  }

  const num = (v: string) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }

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

  const onSaveDraft = async () => {
    if (entries.length === 0) {
      toast.push('error', 'Add at least one player row before saving.')
      return
    }
    const cleaned = entries.map((e) => ({ ...e, total: (Number(e.points) || 0) + (Number(e.bonus) || 0) }))
    await run(async () => await saveResultDraft(match.id, cleaned), `Draft saved (${cleaned.length} players).`)
  }

  const winners = entries.filter((e) => e.prize > 0).sort((a, b) => a.placement - b.placement)

  const doConfirm = async () => {
    if (!confirm) return
    if (confirm === 'distribute') {
      if (result) await run(async () => await distributePrizes(result.id), `Prizes distributed to ${winners.length} winner(s).`)
    } else {
      await run(async () => await setResultStatus(match.id, confirm), `Result marked as ${confirm}.`)
    }
    setConfirm(null)
  }

  const canAdd = registered.filter((u) => !entries.some((e) => e.userId === u.id))
  const sorted = [...entries].sort((a, b) => (a.placement || 999) - (b.placement || 999))

  const workflowBtn = (label: string, action: WorkflowAction, enabled: boolean, cls: string) => (
    <button className={`btn btn-sm ${cls}`} disabled={!enabled} onClick={() => setConfirm(action)}>{label}</button>
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{match.name}</h1>
          <div className="sub">
            <Link to="/admin/tournaments" className="text-blue">{tournament.name}</Link>
            {' · '}Result:{' '}
            {result ? <StatusBadge status={result.status} /> : <Badge color="gray">None</Badge>}
          </div>
        </div>
        <Link to="/admin/results" className="btn btn-outline">← Back to Results</Link>
      </div>

      <div className="alert alert-info">
        Workflow: <b>Draft → Submitted → Approved → Published</b>. Entries are editable only in Draft. Publishing notifies all joined players and completes the match.
      </div>

      {result?.prizesDistributed && (
        <div className="alert alert-success">🏆 Prizes for this match have been distributed to the winners' wallets.</div>
      )}

      <Card className="mb24">
        <CardHead
          title={editable ? 'Result Entries (editable)' : `Result Entries (${status})`}
          sub={editable ? 'Total = Placement Pts + Bonus (auto). Prize prefills from the tournament prize slots.' : 'This result is locked — only Draft results can be edited.'}
          action={
            editable ? (
              <button className="btn btn-sm btn-primary" onClick={onSaveDraft}>💾 Save Draft</button>
            ) : undefined
          }
        />

        {entries.length === 0 ? (
          <EmptyState icon="📋" title="No entries" message={editable ? 'Add registered players below to start recording results.' : 'This result has no entries.'} />
        ) : (
          <div className="table-wrap">
            <table className="table cards-mobile">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>FF UID</th>
                  <th>Kills</th>
                  <th>Placement</th>
                  <th>Placement Pts</th>
                  <th>Bonus</th>
                  <th>Total</th>
                  <th>Prize (NCC)</th>
                  {editable && <th></th>}
                </tr>
              </thead>
              <tbody>
                {(editable ? entries : sorted).map((e, idx) => (
                  <tr key={e.userId}>
                    <td data-label="Player" className="strong">{e.playerName}</td>
                    {editable ? (
                      <>
                        <td data-label="FF UID"><input className="input" style={{ minWidth: 110, padding: '6px 9px' }} value={e.ffUid} onChange={(ev) => patch(idx, { ffUid: ev.target.value })} /></td>
                        <td data-label="Kills"><input className="input" style={{ width: 74, padding: '6px 9px' }} type="number" min={0} value={String(e.kills)} onChange={(ev) => patch(idx, { kills: num(ev.target.value) })} /></td>
                        <td data-label="Placement"><input className="input" style={{ width: 74, padding: '6px 9px' }} type="number" min={0} value={String(e.placement)} onChange={(ev) => patch(idx, { placement: num(ev.target.value) })} /></td>
                        <td data-label="Placement Pts"><input className="input" style={{ width: 84, padding: '6px 9px' }} type="number" min={0} value={String(e.points)} onChange={(ev) => patch(idx, { points: num(ev.target.value) })} /></td>
                        <td data-label="Bonus"><input className="input" style={{ width: 84, padding: '6px 9px' }} type="number" min={0} value={String(e.bonus)} onChange={(ev) => patch(idx, { bonus: num(ev.target.value) })} /></td>
                        <td data-label="Total" className="strong text-blue">{e.total}</td>
                        <td data-label="Prize"><input className="input" style={{ width: 94, padding: '6px 9px' }} type="number" min={0} value={String(e.prize)} onChange={(ev) => patch(idx, { prize: num(ev.target.value) })} /></td>
                        <td data-label="">
                          <button className="btn btn-sm btn-ghost text-red" title="Remove row" onClick={() => setEntries((prev) => prev.filter((_, i) => i !== idx))}>✕</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td data-label="FF UID" className="mono">{e.ffUid || '—'}</td>
                        <td data-label="Kills">{e.kills}</td>
                        <td data-label="Placement">{e.placement === 1 ? '🥇' : e.placement === 2 ? '🥈' : e.placement === 3 ? '🥉' : ''} #{e.placement}</td>
                        <td data-label="Placement Pts">{e.points}</td>
                        <td data-label="Bonus">{e.bonus}</td>
                        <td data-label="Total" className="strong text-blue">{e.total}</td>
                        <td data-label="Prize">{e.prize > 0 ? <span className="text-green strong">{fmtNcc(e.prize)}</span> : <span className="muted">—</span>}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editable && (
          <div style={{ padding: 16 }} className="row wrap">
            <select className="select" style={{ width: 'auto', minWidth: 220 }} value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
              <option value="">Add a registered player…</option>
              {canAdd.map((u) => <option key={u.id} value={u.id}>{u.fullName} (@{u.username})</option>)}
            </select>
            <button
              className="btn btn-sm btn-outline"
              disabled={!addUserId}
              onClick={() => {
                const u = db.users.find((x) => x.id === addUserId)
                if (!u) return
                setEntries((prev) => [...prev, { userId: u.id, playerName: u.fullName, ffUid: u.ffUid ?? '', kills: 0, placement: 0, points: 0, bonus: 0, total: 0, prize: 0 }])
                setAddUserId('')
              }}
            >
              + Add Row
            </button>
            {canAdd.length === 0 && <span className="muted small">All registered players are already in the table.</span>}
          </div>
        )}
      </Card>

      <Card pad>
        <CardHead title="Workflow" sub="Advance the result through review stages" />
        <div className="row wrap" style={{ gap: 10, paddingTop: 4 }}>
          {workflowBtn('📤 Submit for Approval', 'submitted', status === 'draft', 'btn-blue')}
          {workflowBtn('✅ Approve', 'approved', status === 'submitted', 'btn-success')}
          {workflowBtn('📢 Publish', 'published', status === 'approved', 'btn-primary')}
          <button
            className="btn btn-sm btn-outline"
            disabled={!result || result.prizesDistributed || !['approved', 'published'].includes(status) || winners.length === 0}
            onClick={() => setConfirm('distribute')}
          >
            🏆 Distribute Prizes {winners.length > 0 && `(${fmtNcc(winners.reduce((s, w) => s + w.prize, 0))})`}
          </button>
        </div>
        {!result && <div className="muted small mt8">Save a draft first to unlock the workflow.</div>}
        {result && !result.prizesDistributed && winners.length === 0 && ['approved', 'published'].includes(status) && (
          <div className="muted small mt8">No entry has a prize amount greater than zero.</div>
        )}
      </Card>

      <ConfirmDialog
        open={confirm === 'submitted'}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        title="Submit result?"
        confirmLabel="Submit"
        message={<p>Submit the result of <b>"{match.name}"</b> for approval? It will be locked from editing until it returns to draft.</p>}
      />
      <ConfirmDialog
        open={confirm === 'approved'}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        title="Approve result?"
        confirmLabel="Approve"
        message={<p>Approve the result of <b>"{match.name}"</b>? After approval it can be published and prizes distributed.</p>}
      />
      <ConfirmDialog
        open={confirm === 'published'}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        title="Publish result?"
        confirmLabel="Publish"
        message={<p>Publish the result of <b>"{match.name}"</b>? All joined players will be notified, the match will be marked completed, and the leaderboard will update.</p>}
      />
      <ConfirmDialog
        open={confirm === 'distribute'}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        title="Distribute prizes?"
        danger
        confirmLabel={`Distribute ${fmtNcc(winners.reduce((s, w) => s + w.prize, 0))}`}
        message={
          <div>
            <p>The following NCC amounts will be credited to winners' wallets. <b>This cannot be undone.</b></p>
            <ul style={{ margin: '10px 0 0 18px' }}>
              {winners.map((w) => (
                <li key={w.userId}><b>{w.playerName}</b> — rank #{w.placement} — <b className="text-green">{fmtNcc(w.prize)}</b></li>
              ))}
            </ul>
          </div>
        }
      />
    </div>
  )
}
