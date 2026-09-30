import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDB } from '../../store'
import { Avatar, Card, CardHead, EmptyState, Pagination, StatCard, StatusBadge, usePagination } from '../../components/ui'
import { fmtDateTime, fmtNcc } from '../../lib/format'
import type { TxnStatus, TxnType } from '../../lib/types'

const TXN_TYPES: TxnType[] = ['deposit', 'withdrawal', 'tournament_entry', 'prize', 'refund', 'adjustment']
const TXN_STATUSES: TxnStatus[] = ['pending', 'approved', 'rejected', 'completed', 'cancelled']

export default function WalletManagement() {
  const db = useDB()
  const [search, setSearch] = useState('')
  const [playerSearch, setPlayerSearch] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const circulation = db.wallets.reduce((s, w) => s + w.available + w.pending, 0)
  const approvedDeposits = db.deposits.filter((d) => d.status === 'approved').reduce((s, d) => s + d.amount, 0)
  const paidWithdrawals = db.withdrawals.filter((w) => w.status === 'paid').reduce((s, w) => s + w.amount, 0)
  const pendingDep = db.deposits.filter((d) => d.status === 'pending')
  const pendingWd = db.withdrawals.filter((w) => w.status === 'pending')
  const revenue = db.transactions.filter((t) => t.type === 'tournament_entry' && t.status === 'completed').reduce((s, t) => s + t.amount, 0)
  const prizesOut = db.transactions.filter((t) => t.type === 'prize' && t.status === 'completed').reduce((s, t) => s + t.amount, 0)

  const userName = (uid: string) => db.users.find((u) => u.id === uid)

  const filteredTxns = useMemo(() => {
    const q = search.trim().toLowerCase()
    return db.transactions
      .filter((t) => {
        if (type && t.type !== type) return false
        if (status && t.status !== status) return false
        if (from && new Date(t.createdAt) < new Date(`${from}T00:00:00`)) return false
        if (to && new Date(t.createdAt) > new Date(`${to}T23:59:59`)) return false
        if (q) {
          const u = userName(t.userId)
          const hay = `${u?.fullName ?? ''} ${u?.username ?? ''} ${t.description}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.transactions, db.users, search, type, status, from, to])

  const { page, pages, slice, setPage } = usePagination(filteredTxns, 12)

  const quickPlayers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase()
    if (!q) return []
    return db.users
      .filter((u) => u.role === 'player' && (`${u.fullName} ${u.username} ${u.email}`.toLowerCase().includes(q)))
      .slice(0, 6)
  }, [db.users, playerSearch])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>NCC Wallet Management</h1>
          <div className="sub">Coin circulation, revenue flows and every player transaction</div>
        </div>
      </div>

      <div className="stat-grid mb24">
        <StatCard icon="🪙" label="NCC in Circulation" value={fmtNcc(circulation)} bg="var(--amber-soft)" color="var(--amber)" />
        <StatCard icon="⬇️" label="Total Deposits (approved)" value={fmtNcc(approvedDeposits)} bg="var(--green-soft)" color="var(--green)" />
        <StatCard icon="⬆️" label="Total Withdrawals (paid)" value={fmtNcc(paidWithdrawals)} bg="var(--red-soft)" color="var(--red)" />
        <StatCard icon="⏳" label="Pending Deposits" value={`${pendingDep.length} · ${fmtNcc(pendingDep.reduce((s, d) => s + d.amount, 0))}`} />
        <StatCard icon="⏳" label="Pending Withdrawals" value={`${pendingWd.length} · ${fmtNcc(pendingWd.reduce((s, w) => s + w.amount, 0))}`} bg="var(--violet-soft)" color="var(--violet)" />
        <StatCard icon="🎟️" label="Tournament Revenue" value={fmtNcc(revenue)} bg="var(--blue-soft)" color="var(--blue)" />
        <StatCard icon="🏆" label="Prize Distribution" value={fmtNcc(prizesOut)} bg="var(--green-soft)" color="var(--green)" />
      </div>

      <Card className="mb24">
        <CardHead title="Quick Player Lookup" sub="Search players to jump to their wallet" />
        <div style={{ padding: 16 }}>
          <div className="search-input" style={{ maxWidth: 360 }}>
            <input className="input" placeholder="Search players by name / username / email…" value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} />
          </div>
          {playerSearch.trim() && quickPlayers.length === 0 && <div className="muted small mt8">No players match "{playerSearch}".</div>}
          {quickPlayers.length > 0 && (
            <div className="mt16">
              {quickPlayers.map((u) => {
                const w = db.wallets.find((x) => x.userId === u.id)
                return (
                  <Link key={u.id} to={`/admin/players/${u.id}`} className="row between" style={{ padding: '9px 4px', borderBottom: '1px solid #f0f2f7' }}>
                    <span className="row" style={{ gap: 10, minWidth: 0 }}>
                      <Avatar name={u.fullName} color={u.avatarColor} size="avatar-sm" />
                      <span style={{ minWidth: 0 }}>
                        <span className="truncate strong" style={{ display: 'block', fontSize: 13.5 }}>{u.fullName}</span>
                        <span className="muted small">@{u.username}</span>
                      </span>
                    </span>
                    <span className="row" style={{ gap: 8 }}>
                      <span className="strong text-blue">{fmtNcc(w?.available ?? 0)}</span>
                      {(w?.pending ?? 0) > 0 && <span className="text-amber small">+{fmtNcc(w!.pending)} pending</span>}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHead title="Global Transactions" sub={`${filteredTxns.length} matching records`} />
        <div className="filters" style={{ padding: '14px 16px 0' }}>
          <div className="search-input">
            <input className="input" placeholder="Search player / description…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {TXN_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {TXN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="input" type="date" style={{ width: 'auto' }} value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
          <input className="input" type="date" style={{ width: 'auto' }} value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
        </div>
        {filteredTxns.length === 0 ? (
          <EmptyState icon="💸" title="No transactions found" message="Adjust the filters or wait for activity." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table cards-mobile">
                <thead>
                  <tr><th>ID</th><th>Player</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th><th>Description</th></tr>
                </thead>
                <tbody>
                  {slice.map((t) => {
                    const u = userName(t.userId)
                    return (
                      <tr key={t.id}>
                        <td data-label="ID" className="mono">{t.id}</td>
                        <td data-label="Player" className="span2">
                          {u ? (
                            <Link to={`/admin/players/${u.id}`} className="row text-blue" style={{ gap: 8 }}>
                              <Avatar name={u.fullName} color={u.avatarColor} size="avatar-sm" />
                              <span className="strong truncate" style={{ maxWidth: 140 }}>{u.fullName}</span>
                            </Link>
                          ) : (
                            <span className="muted">{t.userId}</span>
                          )}
                        </td>
                        <td data-label="Type"><StatusBadge status={t.type} /></td>
                        <td data-label="Amount" className="strong">{fmtNcc(t.amount)}</td>
                        <td data-label="Status"><StatusBadge status={t.status} /></td>
                        <td data-label="Date">{fmtDateTime(t.createdAt)}</td>
                        <td data-label="Description" className="span2 muted">{t.description}</td>
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
