import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser, useDB } from '../../store'
import { fmtDateTime, fmtNcc, fmtRupees } from '../../lib/format'
import { Card, EmptyState, SkeletonTable, StatusBadge, useFakeLoading } from '../../components/ui'

export default function Withdrawals() {
  const db = useDB()
  const user = useCurrentUser()
  const loading = useFakeLoading([], 400)

  const s = db.settings.wallet

  const withdrawals = useMemo(
    () =>
      db.withdrawals
        .filter((w) => w.userId === user?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.withdrawals, user?.id],
  )

  const pendingTotal = withdrawals
    .filter((w) => w.status === 'pending' || w.status === 'approved')
    .reduce((sum, w) => sum + w.amount, 0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Withdrawal History</h1>
          <div className="sub">
            Your payout requests
            {pendingTotal > 0 && <> · <span className="text-amber strong">{fmtNcc(pendingTotal, s.coinSymbol)} currently reserved</span></>}
          </div>
        </div>
        <Link to="/withdraw" className="btn btn-primary">🏧 New Withdrawal</Link>
      </div>

      <Card>
        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : withdrawals.length === 0 ? (
          <EmptyState
            icon="⬆️"
            title="No withdrawals yet"
            message="Cash out your NCC Coins to eSewa, Khalti or your bank account."
            action={<Link to="/withdraw" className="btn btn-sm btn-primary mt8">Request a withdrawal</Link>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table cards-mobile">
              <thead>
                <tr>
                  <th>ID</th>
                  <th className="num">Amount</th>
                  <th>Method</th>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td data-label="ID" className="mono">{w.id}</td>
                    <td data-label="Amount" className="num strong text-red">
                      −{fmtNcc(w.amount, s.coinSymbol)}
                      <div className="small muted">≈ {fmtRupees(w.amount * s.rate)}</div>
                    </td>
                    <td data-label="Method"><span className="badge badge-plain badge-blue">{w.method}</span></td>
                    <td data-label="Account" className="mono small">{w.account}</td>
                    <td data-label="Status"><StatusBadge status={w.status} /></td>
                    <td data-label="Date" className="small">{fmtDateTime(w.createdAt)}</td>
                    <td data-label="Reason" className="small">
                      {w.rejectReason ? <span className="text-red">{w.rejectReason}</span> : <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
