import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser, useDB, useWallet } from '../../store'
import { fmtDate, fmtNcc, fmtRupees } from '../../lib/format'
import {
  Card,
  EmptyState,
  Pagination,
  SkeletonTable,
  StatCard,
  StatusBadge,
  useFakeLoading,
  usePagination,
} from '../../components/ui'
import type { TxnStatus, TxnType } from '../../lib/types'

const TYPE_OPTIONS: { value: TxnType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'tournament_entry', label: 'Tournament Entry' },
  { value: 'prize', label: 'Prize' },
  { value: 'refund', label: 'Refund' },
  { value: 'adjustment', label: 'Adjustment' },
]

const STATUS_OPTIONS: { value: TxnStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

function isCredit(type: TxnType, description: string): boolean {
  if (type === 'prize' || type === 'refund' || type === 'deposit') return true
  if (type === 'adjustment') return !description.includes('(−')
  return false
}

export default function Wallet() {
  const db = useDB()
  const user = useCurrentUser()
  const wallet = useWallet(user?.id)
  const loading = useFakeLoading([], 400)
  const [typeFilter, setTypeFilter] = useState<TxnType | ''>('')
  const [statusFilter, setStatusFilter] = useState<TxnStatus | ''>('')

  const s = db.settings.wallet

  const txns = useMemo(
    () =>
      db.transactions
        .filter((t) => t.userId === user?.id)
        .filter((t) => (typeFilter ? t.type === typeFilter : true))
        .filter((t) => (statusFilter ? t.status === statusFilter : true))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.transactions, user?.id, typeFilter, statusFilter],
  )

  const { page, pages, slice, setPage } = usePagination(txns, 10)

  const available = wallet?.available ?? 0
  const pending = wallet?.pending ?? 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My Wallet</h1>
          <div className="sub">{s.coinName} balance, transactions and payouts</div>
        </div>
        <div className="row">
          <Link to="/deposit" className="btn btn-primary">💰 Deposit</Link>
          <Link to="/withdraw" className="btn btn-outline">🏧 Withdraw</Link>
        </div>
      </div>

      <div className="wallet-hero mb24">
        <div className="wh-label">Available Balance</div>
        <div className="wh-amount">
          {fmtNcc(available, s.coinSymbol)}
          <small>≈ {fmtRupees(available * s.rate)}</small>
        </div>
        <div className="wh-sub">
          1 {s.coinSymbol} = {fmtRupees(s.rate)}
          {pending > 0 && (
            <> · <span style={{ color: '#ffd166', fontWeight: 700 }}>{fmtNcc(pending, s.coinSymbol)} reserved by pending withdrawals</span></>
          )}
        </div>
        <div className="wh-actions">
          <Link to="/deposit" className="btn btn-primary">💰 Deposit</Link>
          <Link to="/withdraw" className="btn btn-outline">🏧 Withdraw</Link>
        </div>
      </div>

      <div className="stat-grid mb24">
        <StatCard
          icon="⬇️"
          label="Total Deposited"
          value={fmtNcc(wallet?.totalDeposited ?? 0, s.coinSymbol)}
          bg="var(--green-soft)"
          color="var(--green)"
        />
        <StatCard
          icon="⬆️"
          label="Total Withdrawn"
          value={fmtNcc(wallet?.totalWithdrawn ?? 0, s.coinSymbol)}
          bg="var(--amber-soft)"
          color="var(--amber)"
        />
        <StatCard
          icon="🎟️"
          label="Tournament Spending"
          value={fmtNcc(wallet?.totalSpent ?? 0, s.coinSymbol)}
          bg="var(--violet-soft)"
          color="var(--violet)"
        />
      </div>

      <Card>
        <div className="card-head">
          <div>
            <h3>Transaction History</h3>
            <div className="sub">{txns.length} transaction{txns.length === 1 ? '' : 's'}</div>
          </div>
        </div>

        <div className="filters" style={{ padding: '14px 16px 0' }}>
          <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TxnType | '')}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TxnStatus | '')}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : txns.length === 0 ? (
          <EmptyState
            icon="👛"
            title="No transactions yet"
            message="Your deposits, entry fees, prizes and withdrawals will appear here."
            action={<Link to="/deposit" className="btn btn-sm btn-primary mt8">Make your first deposit</Link>}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table cards-mobile">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th className="num">Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((t) => {
                    const credit = isCredit(t.type, t.description)
                    const dead = t.status === 'rejected' || t.status === 'cancelled'
                    return (
                      <tr key={t.id} style={dead ? { opacity: 0.55 } : undefined}>
                        <td data-label="ID" className="mono">{t.id}</td>
                        <td data-label="Type"><StatusBadge status={t.type} /></td>
                        <td data-label="Amount" className={`num strong ${dead ? 'muted' : credit ? 'text-green' : 'text-red'}`}>
                          {credit ? '+' : '−'}{fmtNcc(t.amount, s.coinSymbol)}
                        </td>
                        <td data-label="Status"><StatusBadge status={t.status} /></td>
                        <td data-label="Date">{fmtDate(t.createdAt)}</td>
                        <td data-label="Description" className="span2 small muted">{t.description}</td>
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
    </div>
  )
}
