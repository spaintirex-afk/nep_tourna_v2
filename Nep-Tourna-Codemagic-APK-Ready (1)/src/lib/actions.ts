import { apiPost } from './api'
import { applyAuthResponse, clearSession, refresh } from './db'
import type {
  Announcement,
  AnnouncementStatus,
  Match,
  MatchStatus,
  ResultEntry,
  ResultStatus,
  Role,
  Settings,
  TicketCategory,
  TicketStatus,
  Tournament,
  TournamentStatus,
} from './types'

/**
 * Client action layer.
 *
 * Every function keeps the exact name and argument list the pages already use,
 * but the work now happens on the server (Express + SQLite) inside a
 * transaction with real authorization. The first `userId`/`adminId` argument is
 * retained only for call-site compatibility — the server identifies the actor
 * from the httpOnly session cookie and ignores any client-supplied identity.
 *
 * After each successful mutation we re-hydrate the scoped snapshot via
 * refresh() so every subscribed page updates.
 */

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

function toResult(res: { ok: boolean; id?: string; error?: string }): ActionResult {
  return res.ok ? { ok: true, id: res.id } : { ok: false, error: res.error || 'Action failed.' }
}

async function act(path: string, body: unknown, skipRefresh = false): Promise<ActionResult> {
  const res = await apiPost(path, body)
  if (res.ok && !skipRefresh) await refresh()
  return toResult(res as { ok: boolean; id?: string; error?: string })
}

// ---------- validation helper (kept client-side for instant feedback) ----------

export function passwordIssues(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(pw)) return 'Password must contain an uppercase letter.'
  if (!/[a-z]/.test(pw)) return 'Password must contain a lowercase letter.'
  if (!/[0-9]/.test(pw)) return 'Password must contain a number.'
  return null
}

// ---------- Auth ----------

export interface RegisterInput {
  fullName: string
  username: string
  email: string
  password: string
  confirmPassword: string
  phone: string
  ffUid?: string
  ffIgn?: string
}

export async function register(input: RegisterInput): Promise<ActionResult> {
  const res = await apiPost('/api/register', input)
  if (res.ok) {
    applyAuthResponse(res as never)
    return { ok: true, id: res.id as string | undefined }
  }
  return { ok: false, error: (res.error as string) || 'Registration failed.' }
}

export async function login(email: string, password: string, remember: boolean, adminOnly = false): Promise<ActionResult> {
  const res = await apiPost('/api/login', { email, password, remember, adminOnly })
  if (res.ok) {
    applyAuthResponse(res as never)
    return { ok: true, id: res.id as string | undefined }
  }
  return { ok: false, error: (res.error as string) || 'Invalid email or password.' }
}

export async function logout(): Promise<void> {
  await apiPost('/api/logout', {})
  clearSession()
  await refresh()
}

export async function resetPassword(email: string, newPassword: string): Promise<ActionResult> {
  return act('/api/reset-password', { email, newPassword }, true)
}

export async function updateProfile(_userId: string, patch: { fullName?: string; phone?: string; ffUid?: string; ffIgn?: string }): Promise<ActionResult> {
  return act('/api/profile/update', patch)
}

export async function changePassword(_userId: string, current: string, next: string): Promise<ActionResult> {
  return act('/api/password/change', { current, next }, true)
}

// ---------- Tournaments ----------

export async function createTournament(input: Omit<Tournament, 'id' | 'createdAt' | 'status'> & { status?: TournamentStatus }): Promise<ActionResult> {
  return act('/api/tournaments/create', input)
}

export async function updateTournament(id: string, patch: Partial<Tournament>): Promise<ActionResult> {
  return act('/api/tournaments/update', { id, patch })
}

export async function setTournamentStatus(id: string, status: TournamentStatus): Promise<ActionResult> {
  return act('/api/tournaments/status', { id, status })
}

export async function cancelTournament(id: string, refund = true): Promise<ActionResult> {
  return act('/api/tournaments/cancel', { id, refund })
}

export async function deleteTournament(id: string): Promise<ActionResult> {
  return act('/api/tournaments/delete', { id })
}

export async function joinTournament(_userId: string, tournamentId: string): Promise<ActionResult> {
  return act('/api/tournaments/join', { tournamentId })
}

export async function cancelRegistration(_userId: string, tournamentId: string): Promise<ActionResult> {
  return act('/api/tournaments/leave', { tournamentId })
}

// ---------- Deposits ----------

export async function requestDeposit(_userId: string, amount: number, reference: string, note: string, screenshot?: string): Promise<ActionResult> {
  return act('/api/deposits/request', { amount, reference, note, screenshot })
}

export async function reviewDeposit(_adminId: string, depositId: string, approve: boolean, rejectReason?: string): Promise<ActionResult> {
  return act('/api/deposits/review', { depositId, approve, rejectReason })
}

// ---------- Withdrawals ----------

export async function requestWithdrawal(_userId: string, amount: number, method: string, account: string, note: string, image?: string): Promise<ActionResult> {
  return act('/api/withdrawals/request', { amount, method, account, note, image })
}

export async function reviewWithdrawal(_adminId: string, withdrawalId: string, action: 'approve' | 'reject' | 'paid', rejectReason?: string): Promise<ActionResult> {
  return act('/api/withdrawals/review', { withdrawalId, action, rejectReason })
}

// ---------- Wallet management ----------

export async function adjustBalance(_adminId: string, userId: string, delta: number, reason: string): Promise<ActionResult> {
  return act('/api/wallet/adjust', { userId, delta, reason })
}

// ---------- Player management ----------

export async function setPlayerStatus(_adminId: string, userId: string, status: 'active' | 'suspended'): Promise<ActionResult> {
  return act('/api/players/status', { userId, status })
}

export async function setUserRole(_adminId: string, userId: string, role: Role): Promise<ActionResult> {
  return act('/api/players/role', { userId, role })
}

// ---------- Matches ----------

export async function saveMatch(input: Omit<Match, 'id'> & { id?: string }): Promise<ActionResult> {
  return act('/api/matches/save', input)
}

export async function setMatchStatus(id: string, status: MatchStatus): Promise<ActionResult> {
  return act('/api/matches/status', { id, status })
}

export async function deleteMatch(id: string): Promise<ActionResult> {
  return act('/api/matches/delete', { id })
}

// ---------- Results ----------

export async function saveResultDraft(matchId: string, entries: ResultEntry[]): Promise<ActionResult> {
  return act('/api/results/draft', { matchId, entries })
}

export async function setResultStatus(matchId: string, status: ResultStatus): Promise<ActionResult> {
  return act('/api/results/status', { matchId, status })
}

export async function distributePrizes(resultId: string): Promise<ActionResult> {
  return act('/api/results/distribute', { resultId })
}

// ---------- Announcements ----------

export async function saveAnnouncement(input: Omit<Announcement, 'id' | 'createdAt'> & { id?: string }): Promise<ActionResult> {
  return act('/api/announcements/save', input)
}

export async function setAnnouncementStatus(id: string, status: AnnouncementStatus): Promise<ActionResult> {
  return act('/api/announcements/status', { id, status })
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  return act('/api/announcements/delete', { id })
}

// ---------- Support tickets ----------

export async function createTicket(_userId: string, subject: string, category: TicketCategory, message: string, attachment?: string): Promise<ActionResult> {
  return act('/api/tickets/create', { subject, category, message, attachment })
}

export async function replyTicket(ticketId: string, _authorId: string, message: string, attachment?: string): Promise<ActionResult> {
  return act('/api/tickets/reply', { ticketId, message, attachment })
}

export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<ActionResult> {
  return act('/api/tickets/status', { ticketId, status })
}

// ---------- Settings ----------

export async function updateSettings<K extends keyof Settings>(_adminId: string, section: K, patch: Partial<Settings[K]>): Promise<ActionResult> {
  return act('/api/settings/update', { section, patch })
}

// ---------- Notifications ----------

export async function markNotificationRead(id: string): Promise<void> {
  await apiPost('/api/notifications/read', { id })
  await refresh()
}

export async function markAllNotificationsRead(_userId: string): Promise<void> {
  await apiPost('/api/notifications/read-all', {})
  await refresh()
}
