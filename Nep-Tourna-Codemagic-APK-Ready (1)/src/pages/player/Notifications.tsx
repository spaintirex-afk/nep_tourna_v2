import { useMemo } from 'react'
import { useCurrentUser, useDB } from '../../store'
import { markAllNotificationsRead, markNotificationRead } from '../../lib/actions'
import { timeAgo } from '../../lib/format'
import { Card, EmptyState, SkeletonTable, useFakeLoading, useToast } from '../../components/ui'

const ICONS: Record<string, { ico: string; bg: string; color: string }> = {
  tournament: { ico: '🏆', bg: 'var(--blue-soft)', color: 'var(--blue)' },
  match: { ico: '🎮', bg: 'var(--violet-soft)', color: 'var(--violet)' },
  result: { ico: '🏅', bg: 'var(--green-soft)', color: 'var(--green)' },
  prize: { ico: '🏆', bg: 'var(--amber-soft)', color: 'var(--amber)' },
  deposit: { ico: '⬇️', bg: 'var(--green-soft)', color: 'var(--green)' },
  withdrawal: { ico: '⬆️', bg: 'var(--amber-soft)', color: 'var(--amber)' },
  refund: { ico: '↩️', bg: '#e0f2fe', color: '#0369a1' },
  wallet: { ico: '👛', bg: 'var(--blue-soft)', color: 'var(--blue)' },
  ticket: { ico: '🎧', bg: 'var(--red-soft)', color: 'var(--red)' },
  announcement: { ico: '📢', bg: 'var(--blue-soft)', color: 'var(--blue)' },
  account: { ico: '👤', bg: '#f2f4f7', color: 'var(--text-2)' },
  registration: { ico: '📝', bg: 'var(--green-soft)', color: 'var(--green)' },
}

export default function Notifications() {
  const db = useDB()
  const user = useCurrentUser()
  const toast = useToast()
  const loading = useFakeLoading([], 350)

  const items = useMemo(
    () =>
      db.notifications
        .filter((n) => n.userId === user?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.notifications, user?.id],
  )

  const unread = items.filter((n) => !n.read).length

  const onMarkAll = async () => {
    if (!user) return
    await markAllNotificationsRead(user.id)
    toast.push('success', 'All notifications marked as read.')
  }

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <div className="sub">
            {unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'You are all caught up'}
          </div>
        </div>
        <button className="btn btn-outline" onClick={onMarkAll} disabled={unread === 0}>
          ✓ Mark all read
        </button>
      </div>

      <Card>
        {loading ? (
          <SkeletonTable rows={5} cols={2} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="No notifications"
            message="Tournament updates, results, prizes and wallet activity will show up here."
          />
        ) : (
          items.map((n) => {
            const style = ICONS[n.type] ?? { ico: '🔔', bg: 'var(--blue-soft)', color: 'var(--blue)' }
            return (
              <div
                key={n.id}
                className={`notif-item ${n.read ? '' : 'unread'}`}
                style={{ cursor: n.read ? 'default' : 'pointer' }}
                onClick={async () => {
                  if (!n.read) await markNotificationRead(n.id)
                }}
                title={n.read ? undefined : 'Click to mark as read'}
              >
                <div className="n-ico" style={{ background: style.bg, color: style.color }}>{style.ico}</div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row between" style={{ gap: 8 }}>
                    <span className="strong">{n.title}</span>
                    <span className="small muted" style={{ whiteSpace: 'nowrap' }}>{timeAgo(n.createdAt)}</span>
                  </div>
                  <div className="small" style={{ color: 'var(--text-2)' }}>{n.message}</div>
                </div>
                {!n.read && <span className="dot" style={{ position: 'static', flexShrink: 0, marginTop: 6 }} />}
              </div>
            )
          })
        )}
      </Card>
    </div>
  )
}
