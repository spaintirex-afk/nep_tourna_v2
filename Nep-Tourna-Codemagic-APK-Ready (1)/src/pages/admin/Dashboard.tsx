import { Link } from 'react-router-dom'
import { useDB } from '../../store'
import { Card, CardHead, StatCard, StatusBadge, EmptyState, SkeletonTable, useFakeLoading } from '../../components/ui'
import { fmtDate, fmtNcc, timeAgo } from '../../lib/format'

const ACTIVE_STATUSES = ['upcoming', 'registration_open', 'registration_closed', 'live']

export default function Dashboard() {
  const db = useDB()
  const loading = useFakeLoading([])

  const players = db.users.filter((u) => u.role === 'player')
  const active = db.tournaments.filter((t) => ACTIVE_STATUSES.includes(t.status))
  const completed = db.tournaments.filter((t) => t.status === 'completed')
  const live = db.tournaments.filter((t) => t.status === 'live')
  const upcoming = db.tournaments.filter((t) => ['upcoming', 'registration_open', 'registration_closed'].includes(t.status))

  const circulation = db.wallets.reduce((s, w) => s + w.available + w.pending, 0)
  const pendingDep = db.deposits.filter((d) => d.status === 'pending')
  const pendingWd = db.withdrawals.filter((w) => w.status === 'pending')
  const openTickets = db.tickets.filter((t) => t.status === 'open' || t.status === 'in_progress')

  const approvedDeposits = db.deposits.filter((d) => d.status === 'approved').reduce((s, d) => s + d.amount, 0)
  const paidWithdrawals = db.withdrawals.filter((w) => w.status === 'paid').reduce((s, w) => s + w.amount, 0)
  const revenue = db.transactions.filter((t) => t.type === 'tournament_entry' && t.status === 'completed').reduce((s, t) => s + t.amount, 0)
  const prizesOut = db.transactions.filter((t) => t.type === 'prize' && t.status === 'completed').reduce((s, t) => s + t.amount, 0)

  const resultsAwaiting = db.results.filter((r) => r.status === 'submitted').length
  const recentLogs = db.auditLogs.slice(0, 8)

  const listRow = (t: (typeof db.tournaments)[number]) => (
    <Link key={t.id} to="/admin/tournaments" className="row between" style={{ padding: '9px 2px', borderBottom: '1px solid #f0f2f7' }}>
      <div style={{ minWidth: 0 }}>
        <div className="truncate strong" style={{ fontSize: 13.5 }}>{t.name}</div>
        <div className="muted small">{fmtDate(t.date)} · {t.startTime}</div>
      </div>
      <StatusBadge status={t.status} />
    </Link>
  )

  const pendingRow = (label: string, count: number, to: string, icon: string) => (
    <Link key={label} to={to} className="row between" style={{ padding: '10px 2px', borderBottom: '1px solid #f0f2f7' }}>
      <span className="row" style={{ gap: 8, fontSize: 13.5, fontWeight: 600 }}>
        <span>{icon}</span> {label}
      </span>
      <span className={`badge ${count > 0 ? 'badge-red' : 'badge-gray'}`}>{count}</span>
    </Link>
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Admin Dashboard</h1>
          <div className="sub">Platform overview — players, tournaments and NCC circulation</div>
        </div>
        <Link to="/admin/tournaments/new" className="btn btn-primary">+ Create Tournament</Link>
      </div>

      {loading ? (
        <Card>
          <SkeletonTable rows={6} cols={4} />
        </Card>
      ) : (
        <>
          <div className="stat-grid mb24">
            <StatCard icon="👥" label="Total Players" value={players.length} />
            <StatCard icon="🏆" label="Active Tournaments" value={active.length} bg="var(--red-soft)" color="var(--red)" />
            <StatCard icon="✅" label="Completed Tournaments" value={completed.length} bg="var(--green-soft)" color="var(--green)" />
            <StatCard icon="🪙" label="NCC in Circulation" value={fmtNcc(circulation)} bg="var(--amber-soft)" color="var(--amber)" />
            <StatCard icon="⬇️" label="Pending Deposits" value={pendingDep.length} bg="var(--blue-soft)" color="var(--blue)" />
            <StatCard icon="⬆️" label="Pending Withdrawals" value={pendingWd.length} bg="var(--violet-soft)" color="var(--violet)" />
            <StatCard icon="🎧" label="Open Support Tickets" value={openTickets.length} bg="var(--red-soft)" color="var(--red)" />
          </div>

          <div className="grid-2 mb24">
            <Card>
              <CardHead title="Tournament Overview" sub="Upcoming, live and completed events" action={<Link to="/admin/tournaments" className="btn btn-sm btn-outline">View all</Link>} />
              <div style={{ padding: '10px 20px 16px' }}>
                {live.length > 0 && (
                  <>
                    <div className="muted small strong mb8">🔴 LIVE NOW</div>
                    {live.map(listRow)}
                  </>
                )}
                <div className="muted small strong" style={{ margin: '12px 0 8px' }}>UPCOMING</div>
                {upcoming.length === 0 ? <div className="muted small">No upcoming tournaments.</div> : upcoming.slice(0, 4).map(listRow)}
                <div className="muted small strong" style={{ margin: '12px 0 8px' }}>RECENTLY COMPLETED</div>
                {completed.length === 0 ? <div className="muted small">No completed tournaments yet.</div> : completed.slice(0, 3).map(listRow)}
              </div>
            </Card>

            <Card>
              <CardHead title="Financial Overview" sub="NCC coin flows across the platform" action={<Link to="/admin/wallet" className="btn btn-sm btn-outline">Wallet</Link>} />
              <div style={{ padding: 20 }}>
                <dl className="kv">
                  <dt>Total Approved Deposits</dt>
                  <dd className="text-green">{fmtNcc(approvedDeposits)}</dd>
                  <dt>Total Paid Withdrawals</dt>
                  <dd className="text-red">{fmtNcc(paidWithdrawals)}</dd>
                  <dt>Tournament Revenue (entry fees)</dt>
                  <dd className="text-blue">{fmtNcc(revenue)}</dd>
                  <dt>Prizes Distributed</dt>
                  <dd className="text-amber">{fmtNcc(prizesOut)}</dd>
                  <dt>NCC in Circulation</dt>
                  <dd>{fmtNcc(circulation)}</dd>
                </dl>
              </div>
            </Card>
          </div>

          <div className="grid-2">
            <Card>
              <CardHead title="Pending Actions" sub="Items that need your attention" />
              <div style={{ padding: '8px 20px 16px' }}>
                {pendingRow('Deposit approvals', pendingDep.length, '/admin/deposits', '⬇️')}
                {pendingRow('Withdrawal approvals', pendingWd.length, '/admin/withdrawals', '⬆️')}
                {pendingRow('Results awaiting approval', resultsAwaiting, '/admin/results', '🏅')}
                {pendingRow('Open support tickets', openTickets.length, '/admin/tickets', '🎧')}
              </div>
            </Card>

            <Card>
              <CardHead title="Recent Activity" sub="Latest audit log entries" action={<Link to="/admin/audit-logs" className="btn btn-sm btn-outline">All logs</Link>} />
              {recentLogs.length === 0 ? (
                <EmptyState icon="📜" title="No activity yet" message="Audit log entries will appear here." />
              ) : (
                <div style={{ padding: '8px 20px 16px' }}>
                  {recentLogs.map((l) => (
                    <div key={l.id} className="row between" style={{ padding: '8px 2px', borderBottom: '1px solid #f0f2f7', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="truncate" style={{ fontSize: 13.5 }}>
                          <b>{l.action}</b> <span className="muted">· {l.target}</span>
                        </div>
                        <div className="muted small truncate">{l.actorName}</div>
                      </div>
                      <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{timeAgo(l.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
