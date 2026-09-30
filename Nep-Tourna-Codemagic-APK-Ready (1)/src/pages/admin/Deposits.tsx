import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser, useDB } from '../../store'
import { Avatar, Card, ConfirmDialog, EmptyState, Field, Modal, StatusBadge, Tabs, useToast } from '../../components/ui'
import { reviewDeposit } from '../../lib/actions'
import { fmtDateTime, fmtNcc } from '../../lib/format'
import type { Deposit } from '../../lib/types'

type TabKey = 'pending' | 'approved' | 'rejected' | 'all'

export default function Deposits() {
  const db = useDB()
  const me = useCurrentUser()
  const toast = useToast()
  const [tab, setTab] = useState<TabKey>('pending')
  const [viewShot, setViewShot] = useState<Deposit | null>(null)
  const [toApprove, setToApprove] = useState<Deposit | null>(null)
  const [toReject, setToReject] = useState<Deposit | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')

  const userOf = (uid: string) => db.users.find((u) => u.id === uid)
  const walletOf = (uid: string) => db.wallets.find((w) => w.userId === uid)
  const reviewerOf = (uid: string | undefined) => (uid ? db.users.find((u) => u.id === uid)?.fullName ?? uid : undefined)

  const counts = {
    pending: db.deposits.filter((d) => d.status === 'pending').length,
    approved: db.deposits.filter((d) => d.status === 'approved').length,
    rejected: db.deposits.filter((d) => d.status === 'rejected').length,
    all: db.deposits.length,
  }

  const rows = useMemo(
    () => db.deposits.filter((d) => tab === 'all' || d.status === tab),
    [db.deposits, tab],
  )

  const act = async (d: Deposit, approve: boolean, reason?: string) => {
    if (!me) return
    try {
      const r = await reviewDeposit(me.id, d.id, approve, reason)
      if (r.ok) toast.push('success', approve ? `Deposit of ${fmtNcc(d.amount)} approved for ${userOf(d.userId)?.fullName ?? 'player'}.` : 'Deposit rejected.')
      else toast.push('error', r.error)
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Action failed.')
    }
  }

  const tabs: { id: string; label: string; count: number }[] = [
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'approved', label: 'Approved', count: counts.approved },
    { id: 'rejected', label: 'Rejected', count: counts.rejected },
    { id: 'all', label: 'All', count: counts.all },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Deposit Requests</h1>
          <div className="sub">Verify payments and credit NCC coins to player wallets</div>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as TabKey)} />

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon="⬇️" title={`No ${tab === 'all' ? '' : tab} deposits`} message={tab === 'pending' ? 'Nothing to review right now — you are all caught up!' : 'Deposit requests will appear here.'} />
        ) : (
          <div className="table-wrap">
            <table className="table cards-mobile">
              <thead>
                <tr>
                  <th>ID</th><th>Player</th><th>Amount</th><th>Reference</th><th>Note</th><th>Screenshot</th><th>Submitted</th><th>Status</th><th>Actions / Review</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const u = userOf(d.userId)
                  const w = walletOf(d.userId)
                  return (
                    <tr key={d.id}>
                      <td data-label="ID" className="mono">{d.id}</td>
                      <td data-label="Player" className="span2">
                        {u ? (
                          <Link to={`/admin/players/${u.id}`} className="row" style={{ gap: 8 }}>
                            <Avatar name={u.fullName} color={u.avatarColor} size="avatar-sm" />
                            <span style={{ minWidth: 0 }}>
                              <span className="strong truncate" style={{ display: 'block', maxWidth: 140 }}>{u.fullName}</span>
                              <span className="muted small">@{u.username}</span>
                            </span>
                          </Link>
                        ) : <span className="muted">{d.userId}</span>}
                      </td>
                      <td data-label="Amount" className="strong text-green">{fmtNcc(d.amount)}</td>
                      <td data-label="Reference" className="mono">{d.reference}</td>
                      <td data-label="Note" className="muted truncate" style={{ maxWidth: 150 }}>{d.note || '—'}</td>
                      <td data-label="Screenshot">
                        {d.screenshot ? (
                          <img
                            src={d.screenshot}
                            alt="Deposit screenshot"
                            style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)' }}
                            onClick={() => setViewShot(d)}
                          />
                        ) : <span className="muted">—</span>}
                      </td>
                      <td data-label="Submitted">{fmtDateTime(d.createdAt)}</td>
                      <td data-label="Status"><StatusBadge status={d.status} /></td>
                      <td data-label="Actions" className="span2">
                        {d.status === 'pending' ? (
                          <span className="row wrap" style={{ gap: 6 }}>
                            <button className="btn btn-sm btn-success" onClick={() => setToApprove(d)}>Approve</button>
                            <button className="btn btn-sm btn-danger" onClick={() => { setToReject(d); setRejectReason(''); setRejectError('') }}>Reject</button>
                          </span>
                        ) : (
                          <span className="small muted">
                            {d.status === 'approved' ? '✓' : '✕'} by <b>{reviewerOf(d.reviewedBy) ?? '—'}</b> · {fmtDateTime(d.reviewedAt)}
                            {d.rejectReason && <span className="text-red" style={{ display: 'block' }}>Reason: {d.rejectReason}</span>}
                          </span>
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

      {/* Screenshot viewer */}
      <Modal open={viewShot !== null} onClose={() => setViewShot(null)} title={`Screenshot — ${viewShot?.reference ?? ''}`}>
        {viewShot?.screenshot && <img src={viewShot.screenshot} alt="Deposit screenshot" style={{ width: '100%', borderRadius: 10 }} />}
      </Modal>

      {/* Approve confirm */}
      <ConfirmDialog
        open={toApprove !== null}
        onClose={() => setToApprove(null)}
        onConfirm={async () => { if (toApprove) await act(toApprove, true); setToApprove(null) }}
        title="Approve deposit?"
        confirmLabel="Approve & Credit"
        message={
          toApprove ? (
            <div>
              <p>Credit <b>{fmtNcc(toApprove.amount)}</b> to <b>{userOf(toApprove.userId)?.fullName ?? toApprove.userId}</b> (@{userOf(toApprove.userId)?.username})?</p>
              <p className="mt8">Resulting balance: <b>{fmtNcc((walletOf(toApprove.userId)?.available ?? 0) + toApprove.amount)}</b></p>
              <p className="mt8 muted small">Reference: {toApprove.reference}</p>
            </div>
          ) : ''
        }
      />

      {/* Reject modal (reason required) */}
      <Modal
        open={toReject !== null}
        onClose={() => setToReject(null)}
        title="Reject deposit"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setToReject(null)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                if (!rejectReason.trim()) { setRejectError('A reason is required to reject a deposit.'); return }
                if (toReject) await act(toReject, false, rejectReason.trim())
                setToReject(null)
              }}
            >
              Reject Deposit
            </button>
          </>
        }
      >
        {toReject && (
          <>
            <div className="alert alert-warn">
              Rejecting <b>{fmtNcc(toReject.amount)}</b> from <b>{userOf(toReject.userId)?.fullName}</b> (@{userOf(toReject.userId)?.username}). The player will be notified with your reason.
            </div>
            <Field label="Rejection Reason" required error={rejectError}>
              <textarea className={`textarea ${rejectError ? 'invalid' : ''}`} value={rejectReason} onChange={(e) => { setRejectReason(e.target.value); setRejectError('') }} placeholder="e.g. Screenshot does not match the reference number." />
            </Field>
          </>
        )}
      </Modal>
    </div>
  )
}
