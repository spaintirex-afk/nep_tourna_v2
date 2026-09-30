import { db, uid, nextTxnId, nowIso } from './db.js'

// ---------- generic row mappers ----------
const jsonRow = (table) => db.prepare(`SELECT data FROM ${table}`).all().map((r) => JSON.parse(r.data))

// ---------- users ----------
export function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE id=?').get(id) || null
}
export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(email) || null
}
export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username=?').get(username) || null
}
export function allUsers() {
  return db.prepare('SELECT * FROM users ORDER BY createdAt ASC').all()
}
/** User object safe to send to a browser (never includes passwordHash). */
export function publicUser(u) {
  if (!u) return null
  const { passwordHash, ...rest } = u
  return rest
}

// ---------- wallets ----------
export function getWallet(userId) {
  return db.prepare('SELECT * FROM wallets WHERE userId=?').get(userId) || null
}
export function ensureWallet(userId) {
  let w = getWallet(userId)
  if (!w) {
    db.prepare('INSERT INTO wallets (userId,available,pending,totalDeposited,totalWithdrawn,totalSpent) VALUES (?,0,0,0,0,0)').run(userId)
    w = getWallet(userId)
  }
  return w
}
/**
 * Apply a partial delta to a wallet. MUST be called inside a db.transaction.
 * Enforces the no-negative-available invariant.
 */
export function applyWallet(userId, patch) {
  const w = ensureWallet(userId)
  const next = {
    available: patch.available !== undefined ? patch.available : w.available,
    pending: patch.pending !== undefined ? patch.pending : w.pending,
    totalDeposited: patch.totalDeposited !== undefined ? patch.totalDeposited : w.totalDeposited,
    totalWithdrawn: patch.totalWithdrawn !== undefined ? patch.totalWithdrawn : w.totalWithdrawn,
    totalSpent: patch.totalSpent !== undefined ? patch.totalSpent : w.totalSpent,
  }
  if (next.available < 0) throw new Error('Insufficient balance.')
  if (next.pending < 0) next.pending = 0
  db.prepare(`UPDATE wallets SET available=@available,pending=@pending,totalDeposited=@totalDeposited,totalWithdrawn=@totalWithdrawn,totalSpent=@totalSpent WHERE userId=@userId`)
    .run({ ...next, userId })
  return next
}

// ---------- transactions ----------
export function addTxn(userId, amount, type, status, description) {
  const { id } = nextTxnId()
  db.prepare('INSERT INTO transactions (id,userId,amount,type,status,createdAt,description) VALUES (?,?,?,?,?,?,?)')
    .run(id, userId, amount, type, status, nowIso(), description)
  return id
}
export function setTxnStatus(id, status) {
  if (!id) return
  db.prepare('UPDATE transactions SET status=? WHERE id=?').run(status, id)
}

// ---------- audit ----------
export function addAudit(actor, action, target, description, category, ip) {
  const log = {
    id: uid('al'),
    timestamp: nowIso(),
    actorId: actor?.id ?? 'system',
    actorName: actor?.fullName ?? 'System',
    action, target, description, category,
    ip: ip || undefined,
  }
  db.prepare('INSERT INTO audit_logs (id,timestamp,category,data) VALUES (?,?,?,?)')
    .run(log.id, log.timestamp, log.category, JSON.stringify(log))
  return log
}

// ---------- notifications ----------
export function notify(userId, title, message, type) {
  const n = { id: uid('nt'), userId, title, message, type, read: false, createdAt: nowIso() }
  db.prepare('INSERT INTO notifications (id,userId,read,createdAt,data) VALUES (?,?,0,?,?)')
    .run(n.id, n.userId, n.createdAt, JSON.stringify(n))
  return n
}
export function notifyAdmins(title, message, type) {
  return notify('admins', title, message, type)
}
/** Broadcast a notification to every active player (one row each, so read-state is per-player). */
export function notifyAllPlayers(title, message, type) {
  const players = db.prepare("SELECT id FROM users WHERE role='player' AND status='active'").all()
  for (const p of players) notify(p.id, title, message, type)
  return players.length
}

// ---------- tournaments ----------
export function allTournaments() {
  return db.prepare('SELECT data FROM tournaments ORDER BY createdAt DESC').all().map((r) => JSON.parse(r.data))
}
export function getTournament(id) {
  const r = db.prepare('SELECT data FROM tournaments WHERE id=?').get(id)
  return r ? JSON.parse(r.data) : null
}
export function saveTournament(t) {
  const exists = db.prepare('SELECT id FROM tournaments WHERE id=?').get(t.id)
  if (exists) db.prepare('UPDATE tournaments SET data=?, name=? WHERE id=?').run(JSON.stringify(t), t.name, t.id)
  else db.prepare('INSERT INTO tournaments (id,data,createdAt,name) VALUES (?,?,?,?)').run(t.id, JSON.stringify(t), t.createdAt, t.name)
}

// ---------- registrations ----------
export function joinedCount(tournamentId) {
  return db.prepare("SELECT COUNT(*) AS c FROM registrations WHERE tournamentId=? AND status='joined'").get(tournamentId).c
}
export function joinedRegs(tournamentId) {
  return db.prepare("SELECT * FROM registrations WHERE tournamentId=? AND status='joined'").all(tournamentId)
}
export function hasJoined(tournamentId, userId) {
  return !!db.prepare("SELECT id FROM registrations WHERE tournamentId=? AND userId=? AND status='joined'").get(tournamentId, userId)
}

// ---------- matches ----------
export function allMatches() {
  return db.prepare('SELECT data FROM matches').all().map((r) => JSON.parse(r.data))
}
export function getMatch(id) {
  const r = db.prepare('SELECT data FROM matches WHERE id=?').get(id)
  return r ? JSON.parse(r.data) : null
}
export function saveMatchRow(m) {
  const exists = db.prepare('SELECT id FROM matches WHERE id=?').get(m.id)
  if (exists) db.prepare('UPDATE matches SET tournamentId=?, data=? WHERE id=?').run(m.tournamentId, JSON.stringify(m), m.id)
  else db.prepare('INSERT INTO matches (id,tournamentId,data) VALUES (?,?,?)').run(m.id, m.tournamentId, JSON.stringify(m))
}
export function deleteMatchRow(id) {
  db.prepare('DELETE FROM matches WHERE id=?').run(id)
}

// ---------- results ----------
export function allResults() {
  return db.prepare('SELECT data FROM results').all().map((r) => JSON.parse(r.data))
}
export function getResult(id) {
  const r = db.prepare('SELECT data FROM results WHERE id=?').get(id)
  return r ? JSON.parse(r.data) : null
}
export function getResultByMatch(matchId) {
  const r = db.prepare('SELECT data FROM results WHERE matchId=?').get(matchId)
  return r ? JSON.parse(r.data) : null
}
export function saveResult(res) {
  const exists = db.prepare('SELECT id FROM results WHERE id=?').get(res.id)
  if (exists) db.prepare('UPDATE results SET matchId=?,tournamentId=?,data=? WHERE id=?').run(res.matchId, res.tournamentId, JSON.stringify(res), res.id)
  else db.prepare('INSERT INTO results (id,matchId,tournamentId,data) VALUES (?,?,?,?)').run(res.id, res.matchId, res.tournamentId, JSON.stringify(res))
}

// ---------- settings ----------
export function getSettings() {
  const r = db.prepare('SELECT data FROM settings WHERE id=1').get()
  return r ? JSON.parse(r.data) : null
}
export function saveSettings(s) {
  db.prepare('INSERT INTO settings (id,data) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(s))
}

// ---------- simple collection readers (JSON payload tables) ----------
export const allDeposits = () => db.prepare('SELECT data FROM deposits ORDER BY createdAt DESC').all().map((r) => JSON.parse(r.data))
export const allWithdrawals = () => db.prepare('SELECT data FROM withdrawals ORDER BY createdAt DESC').all().map((r) => JSON.parse(r.data))
export const allAnnouncements = () => db.prepare('SELECT data FROM announcements ORDER BY createdAt DESC').all().map((r) => JSON.parse(r.data))
export const allTickets = () => db.prepare('SELECT data FROM tickets ORDER BY createdAt DESC').all().map((r) => JSON.parse(r.data))
export const allAuditLogs = () => db.prepare('SELECT data FROM audit_logs ORDER BY timestamp DESC').all().map((r) => JSON.parse(r.data))
export const allNotifications = () => db.prepare('SELECT data FROM notifications ORDER BY createdAt DESC').all().map((r) => JSON.parse(r.data))
export const allTransactions = () => db.prepare('SELECT * FROM transactions ORDER BY createdAt DESC').all()
export const allRegistrations = () => db.prepare('SELECT * FROM registrations ORDER BY joinedAt DESC').all()
export const allWallets = () => db.prepare('SELECT * FROM wallets').all()

export { jsonRow }
