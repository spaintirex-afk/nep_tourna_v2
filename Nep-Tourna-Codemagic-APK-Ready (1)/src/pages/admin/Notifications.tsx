import { useMemo } from 'react'
import { useDB } from '../../store'
import { Card, CardHead, EmptyState, useToast } from '../../components/ui'
import { markAllNotificationsRead, markNotificationRead } from '../../lib/actions'
import { timeAgo } from '../../lib/format'

const TYPE_ICONS: Record<string, string> = {
  registration: '👤',
  deposit: '⬇️',
  withdrawal: '⬆️',
  result: '🏅',
  ticket: '🎧',
  announcement: '📢',
  tournament: '🏆',
  match: '🎮',
  prize: '🏆',
  refund: '↩️',
  wallet: '👛',
  account: '🔐',
}

const TYPE_BG: Record<string, string> = {
  deposit: 'var(--green-soft)',
  withdrawal: 'var(--amber-soft)',
  result: 'var(--blue-soft)',
  ticket: 'var(--red-soft)',
  registration: 'var(--violet-soft)',
}

export default function Notifications() {
  const db = useDB()
  const toast = useToast()

  const items = useMemo(
    () => db.notifications.filter((n) => n.userId === 'admins').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.notifications],
  )
  const unread = items.filter((n) => !n.read).length

  const onMarkAll = async () => {
    await markAllNotificationsRead('admin-inbox')
    toast.push('success', 'All notifications marked as read.')
  }

  const onClick = async (id: string, read: boolean) => {
    if (!read) await markNotificationRead(id)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Admin Notifications</h1>
          <div className="sub">{unread > 0 ? `${unread} unread` : 'All caught up'} · platform events and alerts</div>
        </div>
        <button className="btn btn-outline" onClick={onMarkAll} disabled={unread === 0}>✓ Mark all read</button>
      </div>

      <Card>
        <CardHead title="Inbox" sub="Newest first" />
        {items.length === 0 ? (
          <EmptyState icon="🔔" title="No notifications" message="Deposits, withdrawals, tickets and result submissions will notify you here." />
        ) : (
          <div>
            {items.map((n) => (
              <div
                key={n.id}
                className={`notif-item ${n.read ? '' : 'unread'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onClick(n.id, n.read)}
                title={n.read ? undefined : 'Mark as read'}
              >
                <div className="n-ico" style={{ background: TYPE_BG[n.type] ?? 'var(--blue-soft)' }}>
                  {TYPE_ICONS[n.type] ?? '🔔'}
                </div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="strong" style={{ fontSize: 13.5 }}>{n.title}</span>
                    {!n.read && <span className="badge badge-plain badge-red" style={{ fontSize: 10 }}>NEW</span>}
                  </div>
                  <div className="muted small">{n.message}</div>
                </div>
                <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{timeAgo(n.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
