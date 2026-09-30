import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser, useDB } from '../../store'
import { fmtDateTime, fmtNcc, fmtRupees } from '../../lib/format'
import { Card, EmptyState, Modal, SkeletonTable, StatusBadge, useFakeLoading } from '../../components/ui'
import type { ReviewStatus } from '../../lib/types'

const STATUS_OPTIONS: { value: ReviewStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

export default function Deposits() {
  const db = useDB()
  const user = useCurrentUser()
  const loading = useFakeLoading([], 400)
  const [filter, setFilter] = useState<ReviewStatus | ''>('')
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(null)

  const s = db.settings.wallet

  const deposits = useMemo(
    () =>
      db.deposits
        .filter((d) => d.userId === user?.id)
        .filter((d) => (filter ? d.status === filter : true))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.deposits, user?.id, filter],
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Deposit History</h1>
          <div className="sub">All your NCC Coin deposit requests and their review status</div>
        </div>
        <Link to="/deposit" className="btn btn-primary">💰 New Deposit</Link>
      </div>

      <Card>
        <div className="filters" style={{ padding: '14px 16px 0' }}>
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as ReviewStatus | '')}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="small muted">{deposits.length} request{deposits.length === 1 ? '' : 's'}</span>
        </div>

        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : deposits.length === 0 ? (
          <EmptyState
            icon="⬇️"
            title="No deposits yet"
            message="Deposit NCC Coins to enter paid tournaments. Requests are reviewed by an admin."
            action={<Link to="/deposit" className="btn btn-sm btn-primary mt8">Make a deposit</Link>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table cards-mobile">
              <thead>
                <tr>
                  <th>ID</th>
                  <th className="num">Amount</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Screenshot</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((d) => (
                  <tr key={d.id}>
                    <td data-label="ID" className="mono">{d.id}</td>
                    <td data-label="Amount" className="num strong text-green">
                      +{fmtNcc(d.amount, s.coinSymbol)}
                      <div className="small muted">≈ {fmtRupees(d.amount * s.rate)}</div>
                    </td>
                    <td data-label="Reference" className="mono small">
                      {d.reference}
                      {d.note && <div className="muted" style={{ fontFamily: 'var(--font)' }}>📝 {d.note}</div>}
                    </td>
                    <td data-label="Status"><StatusBadge status={d.status} /></td>
                    <td data-label="Date" className="small">{fmtDateTime(d.createdAt)}</td>
                    <td data-label="Screenshot">
                      {d.screenshot ? (
                        <img
                          src={d.screenshot}
                          alt="Deposit screenshot"
                          style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
                          onClick={() => setPreview({ src: d.screenshot!, label: `Deposit ${d.id} — ${fmtNcc(d.amount, s.coinSymbol)}` })}
                        />
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                    <td data-label="Reason" className="small">
                      {d.rejectReason ? <span className="text-red">{d.rejectReason}</span> : <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={preview !== null} onClose={() => setPreview(null)} title={preview?.label ?? 'Screenshot'}>
        {preview && <img src={preview.src} alt="Deposit screenshot" style={{ width: '100%', borderRadius: 10 }} />}
      </Modal>
    </div>
  )
}
