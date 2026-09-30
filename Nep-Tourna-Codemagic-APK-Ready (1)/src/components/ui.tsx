import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { initials } from '../lib/format'

// ---------- Toast ----------

export interface ToastItem {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}

const ToastCtx = createContext<{ push: (type: ToastItem['type'], message: string) => void }>({ push: () => {} })
export const useToast = () => useContext(ToastCtx)

let toastId = 0
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const push = useCallback((type: ToastItem['type'], message: string) => {
    const id = ++toastId
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  const icons = { success: '✅', error: '⛔', info: 'ℹ️' }
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="t-ico">{icons[t.type]}</span>
            <span>{t.message}</span>
            <button className="t-close" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>✕</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- Badge ----------

const STATUS_STYLE: Record<string, string> = {
  upcoming: 'badge-blue',
  registration_open: 'badge-green',
  registration_closed: 'badge-amber',
  live: 'badge-red',
  completed: 'badge-navy',
  cancelled: 'badge-gray',
  pending: 'badge-amber',
  approved: 'badge-blue',
  rejected: 'badge-red',
  completed_txn: 'badge-green',
  paid: 'badge-green',
  draft: 'badge-gray',
  submitted: 'badge-sky',
  published: 'badge-green',
  open: 'badge-green',
  in_progress: 'badge-blue',
  waiting: 'badge-amber',
  resolved: 'badge-green',
  closed: 'badge-gray',
  active: 'badge-green',
  suspended: 'badge-red',
  joined: 'badge-blue',
  scheduled: 'badge-blue',
  high: 'badge-red',
  normal: 'badge-blue',
  low: 'badge-gray',
  general: 'badge-blue',
  tournament: 'badge-violet',
  maintenance: 'badge-amber',
  payment: 'badge-green',
  important: 'badge-red',
  deposit: 'badge-green',
  withdrawal: 'badge-amber',
  tournament_entry: 'badge-violet',
  prize: 'badge-green',
  refund: 'badge-sky',
  adjustment: 'badge-gray',
  player: 'badge-blue',
  admin: 'badge-red',
  coin_manager: 'badge-green',
  tournament_maker: 'badge-violet',
  cancelled_reg: 'badge-gray',
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = STATUS_STYLE[status] ?? 'badge-gray'
  const text = label ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return <span className={`badge ${cls}`}>{text}</span>
}

export function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={`badge badge-plain badge-${color}`}>{children}</span>
}

// ---------- Card ----------

export function Card({ children, className = '', pad = false }: { children: React.ReactNode; className?: string; pad?: boolean }) {
  return <div className={`card ${pad ? 'card-pad ' : ''}${className}`}>{children}</div>
}

export function CardHead({ title, sub, action }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card-head">
      <div>
        <h3>{title}</h3>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {action}
    </div>
  )
}

// ---------- Avatar ----------

export function Avatar({ name, color, size = '' }: { name: string; color: string; size?: '' | 'avatar-sm' | 'avatar-lg' }) {
  return <div className={`avatar ${size}`} style={{ background: color }}>{initials(name)}</div>
}

// ---------- Modal ----------

export function Modal({
  open, onClose, title, children, footer, wide = false,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- Confirm dialog ----------

export function ConfirmDialog({
  open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, busy = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: React.ReactNode
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Processing…' : confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{message}</div>
    </Modal>
  )
}

// ---------- Empty state ----------

export function EmptyState({ icon = '📭', title, message, action }: { icon?: string; title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="e-ico">{icon}</div>
      <h4>{title}</h4>
      {message && <p>{message}</p>}
      {action}
    </div>
  )
}

// ---------- Stat card ----------

export function StatCard({
  icon, label, value, bg = 'var(--blue-soft)', color = 'var(--blue)', onClick,
}: {
  icon: string
  label: string
  value: React.ReactNode
  bg?: string
  color?: string
  onClick?: () => void
}) {
  return (
    <div className="stat-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="stat-ico" style={{ background: bg, color }}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

// ---------- Form field ----------

export function Field({
  label, error, hint, children, required = false,
}: {
  label?: string
  error?: string
  hint?: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <div className="field">
      {label && <label>{label}{required && <span className="text-red"> *</span>}</label>}
      {children}
      {hint && !error && <div className="hint">{hint}</div>}
      {error && <div className="err">⚠ {error}</div>}
    </div>
  )
}

// ---------- Pagination ----------

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null
  const nums: (number | '…')[] = []
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }
  return (
    <div className="pagination">
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>‹ Prev</button>
      {nums.map((n, i) =>
        n === '…' ? <span key={`e${i}`} className="muted" style={{ padding: '0 4px' }}>…</span> : (
          <button key={n} className={n === page ? 'active' : ''} onClick={() => onChange(n)}>{n}</button>
        ),
      )}
      <button disabled={page === pages} onClick={() => onChange(page + 1)}>Next ›</button>
    </div>
  )
}

export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [items.length, pageSize])
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const clamped = Math.min(page, pages)
  return { page: clamped, pages, slice: items.slice((clamped - 1) * pageSize, clamped * pageSize), setPage }
}

// ---------- Skeleton ----------

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton" style={{ height: 16 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="t-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ overflow: 'hidden' }}>
          <div className="skeleton" style={{ height: 108, borderRadius: 0 }} />
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div className="skeleton" style={{ height: 18, width: '70%' }} />
            <div className="skeleton" style={{ height: 13, width: '90%' }} />
            <div className="skeleton" style={{ height: 13, width: '50%' }} />
            <div className="skeleton" style={{ height: 36, width: '100%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- Simulated loading hook (skeletons) ----------

export function useFakeLoading(deps: unknown[] = [], ms = 350): boolean {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), ms)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return loading
}

// ---------- Tabs ----------

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={`tab ${active === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count !== undefined && <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>({t.count})</span>}
        </button>
      ))}
    </div>
  )
}
