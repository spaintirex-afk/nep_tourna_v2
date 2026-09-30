import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser, useDB } from '../../store'
import { Avatar, Card, ConfirmDialog, EmptyState, Field, Modal, StatusBadge, Tabs, useToast } from '../../components/ui'
import { reviewWithdrawal } from '../../lib/actions'
import { fmtDateTime, fmtNcc } from '../../lib/format'
import type { Withdrawal } from '../../lib/types'

type TabKey = 'pending' | 'approved' | 'paid' | 'rejected' | 'all'
type WdAction = 'approve' | 'paid' | 'reject'

export default function Withdrawals() {
  const db = useDB()
  const me = useCurrentUser()
  const toast = useToast()
  const [tab, setTab] = useState<TabKey>('pending')
  const [viewImg, setViewImg] = useState<Withdrawal | null>(null)
  const [confirmAct, setConfirmAct] = useState<{ w: Withdrawal; action: WdAction } | null>(null)
  const [rejectFor, setRejectFor] = useState<Withdrawal | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')

  const userOf = (uid: string) => db.users.find((u) => u.id === uid)
  const reviewerOf = (uid: string | undefined) => (uid ? db.users.find((u) => u.id === uid)?.fullName ?? uid : undefined)

  const counts = {
    pending: db.withdrawals.filter((w) => w.status === 'pending').length,
    approved: db.withdrawals.filter((w) => w.status === 'approved').length,
    paid: db.withdrawals.filter((w) => w.status === 'paid').length,
    rejected: db.withdrawals.filter((w) => w.status === 'rejected').length,
    all: db.withdrawals.length,
  }

  const rows = useMemo(
    () => db.withdrawals.filter((w) => tab === 'all' || w.status === tab),
    [db.withdrawals, tab],
  )

  const act = async (w: Withdrawal, action: WdAction, reason?: string) => {
    if (!me) return
    try {
      const r = await reviewWithdrawal(me.id, w.id, action, reason)
      if (r.ok) {
        const label = action === 'approve' ? 'approved' : action === 'paid' ? 'marked as paid' : 'rejected'
        toast.push('success', `Withdrawal of ${fmtNcc(w.amount)} for ${userOf(w.userId)?.fullName ?? 'player'} ${label}.`)
      } else {
        toast.push('error', r.error)
      }
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Action failed.')
    }
  }

  const doConfirm = async () => {
    if (!confirmAct) return
    await act(confirmAct.w, confirmAct.action, confirmAct.action === 'reject' ? rejectReason.trim() : undefined)
    setConfirmAct(null)
    setRejectFor(null)
    setRejectReason('')
  }

  const tabs: { id: string; label: string; count: number }[] = [
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'approved', label: 'Approved', count: counts.approved },
    { id: 'paid', label: 'Paid', count: counts.paid },
    { id: 'rejected', label: 'Rejected', count: counts.rejected },
    { id: 'all', label: 'All', count: counts.all },
  ]

  const actionLabel = actionLabelFor(confirmAct?.action)
  function actionLabelFor(a?: WdAction) {
    return a === 'approve' ? 'Approve withdrawal?' : a === 'paid' ? 'Mark as paid?' : a === 'reject' ? 'Reject withdrawal?' : ''
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Withdrawal Requests</h1>
          <div className="sub">Review, approve and pay out player withdrawals</div>
        </div>
      </div>

      <div className="alert alert-info">
        ℹ️ <b>Reservation semantics:</b> while a withdrawal is pending or approved, the amount is <b>reserved</b> (moved from the player's available balance to pending) so it cannot be double-spent. Rejecting a request <b>returns the coins</b> to the player's available balance. Marking as paid finalizes the payout.
      </div>

      <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as TabKey)} />

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon="⬆️" title={`No ${tab === 'all' ? '' : tab} withdrawals`} message={tab === 'pending' ? 'No withdrawal requests awaiting review.' : 'Withdrawal requests will appear here.'} />
        ) : (
          <div className="table-wrap">
            <table className="table cards-mobile">
              <thead>
                <tr>
                  <th>ID</th><th>Player</th><th>Amount</th><th>Method</th><th>Account</th><th>Note</th><th>Image</th><th>Requested</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => {
                  const u = userOf(w.userId)
                  return (
                    <tr key={w.id}>
                      <td data-label="ID" className="mono">{w.id}</td>
                      <td data-label="Player" className="span2">
                        {u ? (
                          <Link to={`/admin/players/${u.id}`} className="row" style={{ gap: 8 }}>
                            <Avatar name={u.fullName} color={u.avatarColor} size="avatar-sm" />
                            <span style={{ minWidth: 0 }}>
                              <span className="strong truncate" style={{ display: 'block', maxWidth: 140 }}>{u.fullName}</span>
                              <span className="muted small">@{u.username}</span>
                            </span>
                          </Link>
                        ) : <span className="muted">{w.userId}</span>}
                      </td>
                      <td data-label="Amount" className="strong text-red">{fmtNcc(w.amount)}</td>
                      <td data-label="Method">{w.method}</td>
                      <td data-label="Account" className="mono truncate" style={{ maxWidth: 150 }}>{w.account}</td>
                      <td data-label="Note" className="muted truncate" style={{ maxWidth: 130 }}>{w.note || '—'}</td>
                      <td data-label="Image">
                        {w.image ? (
                          <img src={w.image} alt="Withdrawal attachment" style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)' }} onClick={() => setViewImg(w)} />
                        ) : <span className="muted">—</span>}
                      </td>
                      <td data-label="Requested">{fmtDateTime(w.createdAt)}</td>
                      <td data-label="Status">
                        <StatusBadge status={w.status} />
                        {w.status === 'rejected' && w.rejectReason && <span className="text-red small" style={{ display: 'block' }}>{w.rejectReason}</span>}
                        {w.status !== 'pending' && w.reviewedAt && (
                          <span className="muted small" style={{ display: 'block' }}>{reviewerOf(w.reviewedBy)} · {fmtDateTime(w.reviewedAt)}</span>
                        )}
                      </td>
                      <td data-label="Actions" className="span2">
                        {(w.status === 'pending' || w.status === 'approved') ? (
                          <span className="row wrap" style={{ gap: 6 }}>
                            {w.status === 'pending' && (
                              <button className="btn btn-sm btn-success" onClick={() => setConfirmAct({ w, action: 'approve' })}>Approve</button>
                            )}
                            <button className="btn btn-sm btn-blue" onClick={() => setConfirmAct({ w, action: 'paid' })}>Mark Paid</button>
                            <button className="btn btn-sm btn-danger" onClick={() => { setRejectFor(w); setRejectReason(''); setRejectError('') }}>Reject</button>
                          </span>
                        ) : (
                          <span className="muted small">{w.status === 'paid' ? '💰 Paid out' : '✕ Rejected'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Image viewer */}
      <Modal open={viewImg !== null} onClose={() => setViewImg(null)} title={`Attachment — ${viewImg?.id ?? ''}`}>
        {viewImg?.image && <img src={viewImg.image} alt="Withdrawal attachment" style={{ width: '100%', borderRadius: 10 }} />}
      </Modal>

      {/* Reject reason modal */}
      <Modal
        open={rejectFor !== null && confirmAct === null}
        onClose={() => setRejectFor(null)}
        title="Reject withdrawal"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setRejectFor(null)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (!rejectReason.trim()) { setRejectError('A reason is required to reject a withdrawal.'); return }
                if (rejectFor) setConfirmAct({ w: rejectFor, action: 'reject' })
              }}
            >
              Continue
            </button>
          </>
        }
      >
        {rejectFor && (
          <>
            <div className="alert alert-warn">
              Rejecting <b>{fmtNcc(rejectFor.amount)}</b> requested by <b>{userOf(rejectFor.userId)?.fullName}</b> (@{userOf(rejectFor.userId)?.username}). The reserved coins will be returned to their available balance.
            </div>
            <Field label="Rejection Reason" required error={rejectError}>
              <textarea className={`textarea ${rejectError ? 'invalid' : ''}`} value={rejectReason} onChange={(e) => { setRejectReason(e.target.value); setRejectError('') }} placeholder="e.g. Account details do not match the registered name." />
            </Field>
          </>
        )}
      </Modal>

      {/* Final confirmation for every action */}
      <ConfirmDialog
        open={confirmAct !== null}
        onClose={() => { setConfirmAct(null) }}
        onConfirm={doConfirm}
        title={actionLabel}
        danger={confirmAct?.action === 'reject'}
        confirmLabel={confirmAct?.action === 'approve' ? 'Approve' : confirmAct?.action === 'paid' ? 'Mark as Paid' : 'Reject & Refund Coins'}
        message={
          confirmAct ? (
            <div>
              <p>
                {confirmAct.action === 'approve' && <>Approve the withdrawal of <b>{fmtNcc(confirmAct.w.amount)}</b> for <b>{userOf(confirmAct.w.userId)?.fullName}</b> (@{userOf(confirmAct.w.userId)?.username})?</>}
                {confirmAct.action === 'paid' && <>Mark <b>{fmtNcc(confirmAct.w.amount)}</b> as <b>PAID</b> to <b>{userOf(confirmAct.w.userId)?.fullName}</b> via {confirmAct.w.method} ({confirmAct.w.account})? The reserved coins are finalized as withdrawn.</>}
                {confirmAct.action === 'reject' && <>Reject <b>{fmtNcc(confirmAct.w.amount)}</b> for <b>{userOf(confirmAct.w.userId)?.fullName}</b>? <span className="text-green">The reserved coins return to their balance.</span><br />Reason: <b>{rejectReason.trim()}</b></>}
              </p>
            </div>
          ) : ''
        }
      />
    </div>
  )
}
