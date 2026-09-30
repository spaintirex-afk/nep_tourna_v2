import type { DB, Session, User } from './types'
import { apiGet } from './api'

/**
 * Client data layer.
 *
 * The server (Express + SQLite) is the single source of truth. This module
 * keeps a role-scoped snapshot of the DB in memory so the existing synchronous
 * `useDB()` reads across all pages keep working, and re-hydrates that snapshot
 * from the server after every mutation and on boot.
 *
 * Authentication lives in an httpOnly session cookie owned by the server; the
 * browser never stores credentials or trust-worthy role data. `getMe()` returns
 * the server-verified current user.
 */

const EMPTY: DB = {
  version: 3,
  users: [],
  wallets: [],
  transactions: [],
  txnCounter: 0,
  tournaments: [],
  registrations: [],
  matches: [],
  results: [],
  deposits: [],
  withdrawals: [],
  announcements: [],
  tickets: [],
  auditLogs: [],
  notifications: [],
  settings: {
    general: { appName: 'Nep Tourna', appDescription: '', supportEmail: '', contact: '' },
    social: { facebook: '', instagram: '', youtube: '', discord: '', twitter: '', tiktok: '' },
    wallet: { coinName: 'NCC Coin', coinSymbol: 'NCC', rate: 1, minDeposit: 0, maxDeposit: 0, minWithdraw: 0, maxWithdraw: 0 },
    payment: { paymentName: '', paymentId: '', instructions: '', depositEnabled: false },
    tournament: { defaultRules: '', allowRegistration: true, requireResultApproval: true, autoPrizeDistribution: false },
    maintenance: { enabled: false, message: '' },
  },
}

let db: DB = EMPTY
let me: User | null = null
let ready = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function getDB(): DB {
  return db
}
export function getMe(): User | null {
  return me
}
export function isReady(): boolean {
  return ready
}
export function subscribeDB(l: () => void): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

// Session is derived from the server-verified user; kept for store.ts parity.
export function getSession(): Session | null {
  return me ? { userId: me.id, loginAt: me.createdAt } : null
}
export function subscribeSession(l: () => void): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

interface StateResponse {
  ok: boolean
  me?: User | null
  state?: DB
  error?: string
}

/** Apply a state+me payload (from /api/state, /api/login or /api/register). */
function applyPayload(payload: StateResponse) {
  if (payload.state) db = payload.state
  me = payload.me ?? null
  ready = true
  emit()
}

/** Fetch the current scoped snapshot from the server. Safe to call anytime. */
export async function refresh(): Promise<void> {
  const res = (await apiGet('/api/state')) as StateResponse
  if (res.ok) applyPayload(res)
  else {
    // Not authenticated or server error — show empty/public state.
    me = null
    ready = true
    emit()
  }
}

/** Used by login/register which already return the fresh state. */
export function applyAuthResponse(payload: StateResponse): boolean {
  if (!payload || payload.ok !== true || !payload.state) return false
  applyPayload(payload)
  return true
}

export function clearSession() {
  me = null
  emit()
}

// Initial hydration.
void refresh()

// ---------- real-time sync ----------
// The server broadcasts a tiny "changed" ping after every mutation (from any
// user). We coalesce bursts and re-fetch our own role-scoped snapshot, so admin
// changes appear live for every connected player/staff tab without the server
// ever pushing sensitive state over the wire.
let es: EventSource | null = null
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
let pending: ReturnType<typeof setTimeout> | null = null

function scheduleRefresh() {
  if (pending !== null) return
  pending = setTimeout(() => {
    pending = null
    void refresh()
  }, 250)
}

export function connectRealtime() {
  if (es || typeof EventSource === 'undefined') return
  es = new EventSource(`${API_BASE}/api/events`, API_BASE ? { withCredentials: true } : undefined)
  es.addEventListener('changed', scheduleRefresh)
  es.addEventListener('hello', scheduleRefresh)
  // EventSource reconnects automatically on network errors.
}

connectRealtime()

// SSE gives instant updates when the browser is connected to the same server
// process. A lightweight polling fallback guarantees that a user still picks
// up global admin changes after reconnects, proxy buffering, or a deployment
// that does not preserve an SSE connection. The server remains the source of
// truth; this is never a local/browser data store.
const GLOBAL_SYNC_MS = 3000
setInterval(() => {
  if (document.visibilityState === 'hidden') return
  scheduleRefresh()
}, GLOBAL_SYNC_MS)
