import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCurrentUser, useDB, useWallet } from '../../store'
import { Avatar, Card, CardHead, ConfirmDialog, EmptyState, Field, Modal, StatusBadge, Tabs, useToast } from '../../components/ui'
import { adjustBalance, setPlayerStatus } from '../../lib/actions'
import { fmtDate, fmtDateTime, fmtNcc } from '../../lib/format'

export default function PlayerDetails() {
  const { id } = useParams()
  const db = useDB()
  const me = useCurrentUser()
  const toast = useToast()
  const wallet = useWallet(id)

  const user = db.users.find((u) => u.id === id)
  const [tab, setTab] = useState('txns')
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<'add' | 'deduct'>('add')
  const [reason, setReason] = useState('')
  const [adjustError, setAdjustError] = useState<Record<string, string>>({})
  const [confirmAdjust, setConfirmAdjust] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState(false)

  const txns = useMemo(() => db.transactions.filter((t) => t.userId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.transactions, id])
  const deposits = useMemo(() => db.deposits.filter((d) => d.userId === id), [db.deposits, id])
  const withdrawals = useMemo(() => db.withdrawals.filter((w) => w.userId === id), [db.withdrawals, id])
  const joined = useMemo(
    () =>
      db.registrations
        .filter((r) => r.userId === id)
        .map((r) => ({ reg: r, tournament: db.tournaments.find((t) => t.id === r.tournamentId) }))
        .filter((x) => Boolean(x.tournament)),
    [db.registrations, db.tournaments, id],
  )

  if (!user || user.role !== 'player') {
    return (
      <div className="page">
        <EmptyState icon="👤" title="Player not found" message="This user does not exist or is not a player." action={<Link to="/admin/players" className="btn btn-primary">Back to Players</Link>} />
      </div>
    )
  }

  const amt = Number(amount)
  const signed = direction === 'add' ? Math.abs(amt) || 0 : -(Math.abs(amt) || 0)
  const newBalance = (wallet?.available ?? 0) + signed

  const validateAdjust = (): boolean => {
    const e: Record<string, string> = {}
    if (!Number.isFinite(amt) || amt <= 0) e.amount = 'Enter a positive amount.'
    if (!reason.trim()) e.reason = 'A reason is required for manual adjustments.'
    if (direction === 'deduct' && amt > (wallet?.available ?? 0)) e.amount = `Cannot deduct more than the available balance (${fmtNcc(wallet?.available ?? 0)}).`
    setAdjustError(e)
    return Object.keys(e).length === 0
  }

  const doAdjust = async () => {
    if (!me) return
    try {
      const r = await adjustBalance(me.id, user.id, signed, reason.trim())
      if (r.ok) {
        toast.push('success', `Balance adjusted: ${signed > 0 ? '+' : '−'}${fmtNcc(Math.abs(signed))} for ${user.fullName}.`)
        setAdjustOpen(false)
        setConfirmAdjust(false)
        setAmount('')
        setReason('')
        setDirection('add')
      } else {
        toast.push('error', r.error)
      }
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Action failed.')
    }
  }

  const doToggleStatus = async () => {
    if (!me) return
    const next = user.status === 'active' ? 'suspended' : 'active'
    try {
      const r = await setPlayerStatus(me.id, user.id, next)
      if (r.ok) toast.push('success', next === 'suspended' ? `${user.fullName} suspended.` : `${user.fullName} reactivated.`)
      else toast.push('error', r.error)
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Action failed.')
    }
    setConfirmStatus(false)
  }

  const tabs = [
    { id: 'txns', label: 'Transactions', count: txns.length },
    { id: 'deposits', label: 'Deposits', count: deposits.length },
    { id: 'withdrawals', label: 'Withdrawals', count: withdrawals.length },
    { id: 'tournaments', label: 'Tournaments', count: joined.length },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Player Details</h1>
          <div className="sub">Profile, wallet and activity for {user.fullName}</div>
        </div>
        <Link to="/admin/players" className="btn btn-outline">← Back to Players</Link>
      </div>

      <div className="grid-2 mb24">
        <Card pad>
          <div className="row" style={{ gap: 14 }}>
            <Avatar name={user.fullName} color={user.avatarColor} size="avatar-lg" />
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{user.fullName}</div>
              <div className="muted">@{user.username}</div>
              <div className="row wrap mt8" style={{ gap: 6 }}>
                <StatusBadge status={user.role} />
                <StatusBadge status={user.status} />
              </div>
            </div>
            <button className={`btn btn-sm ${user.status === 'active' ? 'btn-danger' : 'btn-success'}`} onClick={() => setConfirmStatus(true)}>
              {user.status === 'active' ? 'Suspend' : 'Activate'}
            </button>
          </div>
          <div className="divider" />
          <dl className="kv">
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Phone</dt><dd>{user.phone || '—'}</dd>
            <dt>FF UID</dt><dd className="mono">{user.ffUid || '—'}</dd>
            <dt>FF IGN</dt><dd>{user.ffIgn || '—'}</dd>
            <dt>Member since</dt><dd>{fmtDate(user.createdAt)}</dd>
          </dl>
        </Card>

        <Card pad>
          <CardHead title="Wallet" sub="NCC coin balances and lifetime totals" action={<button className="btn btn-sm btn-blue" onClick={() => setAdjustOpen(true)}>Adjust Balance</button>} />
          <div style={{ paddingTop: 12 }}>
            <div className="row wrap" style={{ gap: 22 }}>
              <div>
                <div className="muted small">Available</div>
                <div style={{ fontSize: 24, fontWeight: 800 }} className="text-blue">{fmtNcc(wallet?.available ?? 0)}</div>
              </div>
              <div>
                <div className="muted small">Pending (reserved)</div>
                <div style={{ fontSize: 18, fontWeight: 800 }} className="text-amber">{fmtNcc(wallet?.pending ?? 0)}</div>
              </div>
            </div>
            <div className="divider" />
            <dl className="kv">
              <dt>Total Deposited</dt><dd className="text-green">{fmtNcc(wallet?.totalDeposited ?? 0)}</dd>
              <dt>Total Withdrawn</dt><dd className="text-red">{fmtNcc(wallet?.totalWithdrawn ?? 0)}</dd>
              <dt>Total Spent</dt><dd>{fmtNcc(wallet?.totalSpent ?? 0)}</dd>
            </dl>
          </div>
        </Card>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <Card>
        {tab === 'txns' && (
          txns.length === 0 ? <EmptyState icon="💸" title="No transactions" message="This player has no wallet transactions yet." /> : (
            <div className="table-wrap">
              <table className="table cards-mobile">
                <thead><tr><th>ID</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th><th>Description</th></tr></thead>
                <tbody>
                  {txns.map((t) => (
                    <tr key={t.id}>
                      <td data-label="ID" className="mono">{t.id}</td>
                      <td data-label="Type"><StatusBadge status={t.type} /></td>
                      <td data-label="Amount" className="strong">{fmtNcc(t.amount)}</td>
                      <td data-label="Status"><StatusBadge status={t.status} /></td>
                      <td data-label="Date">{fmtDateTime(t.createdAt)}</td>
                      <td data-label="Description" className="span2 muted">{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {tab === 'deposits' && (
          deposits.length === 0 ? <EmptyState icon="⬇️" title="No deposits" message="This player has not requested any deposits." /> : (
            <div className="table-wrap">
              <table className="table cards-mobile">
                <thead><tr><th>ID</th><th>Amount</th><th>Reference</th><th>Status</th><th>Submitted</th><th>Reviewed</th></tr></thead>
                <tbody>
                  {deposits.map((d) => (
                    <tr key={d.id}>
                      <td data-label="ID" className="mono">{d.id}</td>
                      <td data-label="Amount" className="strong">{fmtNcc(d.amount)}</td>
                      <td data-label="Reference" className="mono">{d.reference}</td>
                      <td data-label="Status"><StatusBadge status={d.status} /></td>
                      <td data-label="Submitted">{fmtDateTime(d.createdAt)}</td>
                      <td data-label="Reviewed">{d.reviewedAt ? fmtDateTime(d.reviewedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {tab === 'withdrawals' && (
          withdrawals.length === 0 ? <EmptyState icon="⬆️" title="No withdrawals" message="This player has not requested any withdrawals." /> : (
            <div className="table-wrap">
              <table className="table cards-mobile">
                <thead><tr><th>ID</th><th>Amount</th><th>Method</th><th>Account</th><th>Status</th><th>Requested</th></tr></thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td data-label="ID" className="mono">{w.id}</td>
                      <td data-label="Amount" className="strong">{fmtNcc(w.amount)}</td>
                      <td data-label="Method">{w.method}</td>
                      <td data-label="Account" className="mono truncate" style={{ maxWidth: 160 }}>{w.account}</td>
                      <td data-label="Status"><StatusBadge status={w.status} /></td>
                      <td data-label="Requested">{fmtDateTime(w.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {tab === 'tournaments' && (
          joined.length === 0 ? <EmptyState icon="🏆" title="No tournaments joined" message="This player has not joined any tournaments." /> : (
            <div className="table-wrap">
              <table className="table cards-mobile">
                <thead><tr><th>Tournament</th><th>Registration</th><th>Joined At</th><th>Tournament Status</th></tr></thead>
                <tbody>
                  {joined.map(({ reg, tournament }) => (
                    <tr key={reg.id}>
                      <td data-label="Tournament" className="span2 strong truncate" style={{ maxWidth: 240 }}>{tournament!.name}</td>
                      <td data-label="Registration"><StatusBadge status={reg.status} /></td>
                      <td data-label="Joined At">{fmtDateTime(reg.joinedAt)}</td>
                      <td data-label="Tournament Status"><StatusBadge status={tournament!.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Card>

      {/* Adjust balance modal */}
      <Modal
        open={adjustOpen && !confirmAdjust}
        onClose={() => { setAdjustOpen(false); setAdjustError({}) }}
        title={`Adjust Balance — ${user.fullName}`}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => { setAdjustOpen(false); setAdjustError({}) }}>Cancel</button>
            <button className="btn btn-primary" onClick={() => { if (validateAdjust()) setConfirmAdjust(true) }}>Review</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="full">
            <Field label="Direction">
              <div className="row" style={{ gap: 18 }}>
                <label className="checkbox"><input type="radio" name="dir" checked={direction === 'add'} onChange={() => setDirection('add')} /> Add</label>
                <label className="checkbox"><input type="radio" name="dir" checked={direction === 'deduct'} onChange={() => setDirection('deduct')} /> Deduct</label>
              </div>
            </Field>
          </div>
          <div className="full">
            <Field label="Amount (NCC)" required error={adjustError.amount}>
              <input className={`input ${adjustError.amount ? 'invalid' : ''}`} type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 100" />
            </Field>
          </div>
          <div className="full">
            <Field label="Reason" required error={adjustError.reason} hint="Shown to the player in their notification and recorded in the audit log.">
              <input className={`input ${adjustError.reason ? 'invalid' : ''}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Compensation for cancelled match" />
            </Field>
          </div>
          <div className="full">
            <div className={`alert ${newBalance < 0 ? 'alert-error' : 'alert-info'}`}>
              New balance: <b>{fmtNcc(newBalance)}</b> ({fmtNcc(wallet?.available ?? 0)} {signed >= 0 ? '+' : '−'} {fmtNcc(Math.abs(signed))})
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmAdjust}
        onClose={() => setConfirmAdjust(false)}
        onConfirm={doAdjust}
        title="Confirm balance adjustment"
        danger={direction === 'deduct'}
        confirmLabel={`${signed > 0 ? 'Add' : 'Deduct'} ${fmtNcc(Math.abs(signed))}`}
        message={
          <div>
            <p>
              {direction === 'add' ? 'Add' : 'Deduct'} <b>{fmtNcc(Math.abs(signed))}</b> {direction === 'add' ? 'to' : 'from'} the wallet of{' '}
              <b>{user.fullName}</b> (@{user.username}).
            </p>
            <p className="mt8">New balance: <b>{fmtNcc(newBalance)}</b></p>
            <p className="mt8">Reason: <b>{reason.trim()}</b></p>
          </div>
        }
      />

      <ConfirmDialog
        open={confirmStatus}
        onClose={() => setConfirmStatus(false)}
        onConfirm={doToggleStatus}
        title={user.status === 'active' ? 'Suspend player?' : 'Activate player?'}
        danger={user.status === 'active'}
        confirmLabel={user.status === 'active' ? 'Suspend' : 'Activate'}
        message={
          user.status === 'active' ? (
            <p>Suspend <b>{user.fullName}</b> (@{user.username})? They will lose access until reactivated.</p>
          ) : (
            <p>Reactivate <b>{user.fullName}</b> (@{user.username})? Full access restored immediately.</p>
          )
        }
      />
    </div>
  )
}
