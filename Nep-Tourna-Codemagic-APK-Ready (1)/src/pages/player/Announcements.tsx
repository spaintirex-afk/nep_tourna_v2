import { useMemo } from 'react'
import { useDB } from '../../store'
import { fmtDate } from '../../lib/format'
import { Card, EmptyState, SkeletonCards, StatusBadge, useFakeLoading } from '../../components/ui'

const TYPE_ICON: Record<string, string> = {
  general: '📢',
  tournament: '🏆',
  maintenance: '🛠️',
  payment: '💳',
  important: '❗',
}

export default function Announcements() {
  const db = useDB()
  const loading = useFakeLoading([], 350)

  const items = useMemo(
    () =>
      db.announcements
        .filter((a) => a.status === 'published')
        .sort((a, b) => b.publishDate.localeCompare(a.publishDate)),
    [db.announcements],
  )

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <h1>Announcements</h1>
          <div className="sub">News, updates and important notices from the Nep Tourna team</div>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon="📢"
            title="No announcements"
            message="There are no published announcements right now. Check back soon!"
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {items.map((a) => (
            <Card key={a.id}>
              <div
                className="card-pad"
                style={a.priority === 'high' ? { borderLeft: '4px solid var(--red)' } : undefined}
              >
                <div className="row wrap between mb8" style={{ gap: 8 }}>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{TYPE_ICON[a.type] ?? '📢'}</span>
                    <h3 style={{ fontSize: 16.5, fontWeight: 800 }}>{a.title}</h3>
                    <StatusBadge status={a.type} />
                    {a.priority === 'high' && <StatusBadge status="high" label="Important" />}
                  </div>
                  <span className="small muted">{fmtDate(a.publishDate)}</span>
                </div>
                {a.image && (
                  <img
                    src={a.image}
                    alt={a.title}
                    style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 10, marginBottom: 12 }}
                  />
                )}
                <p style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>{a.message}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
