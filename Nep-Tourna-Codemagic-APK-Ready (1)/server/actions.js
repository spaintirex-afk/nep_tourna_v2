import { db, uid, nowIso, hashPassword, verifyPassword } from './db.js'
import { canAccessArea, isStaff, ROLE_LABELS } from './permissions.js'
import * as R from './repo.js'

// Thrown for expected, user-facing failures. The HTTP layer maps these to 200
// with { ok:false, error } (matching the client's ActionResult contract) or to
// 401/403 for auth problems.
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}
const fail = (m) => { throw new AppError(m) }

function requireUser(actor) {
  if (!actor) throw new AppError('You must be logged in.', 401)
  return actor
}
function requireAdmin(actor) {
  const u = requireUser(actor)
  if (u.role !== 'admin') throw new AppError('Admin access required.', 403)
  return u
}
function requireStaff(actor) {
  const u = requireUser(actor)
  if (!isStaff(u.role)) throw new AppError('Staff access required.', 403)
  return u
}
function requireArea(actor, area) {
  const u = requireStaff(actor)
  if (!canAccessArea(u.role, area)) throw new AppError(`Your role (${ROLE_LABELS[u.role]}) cannot perform this action.`, 403)
  return u
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function passwordIssues(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(pw)) return 'Password must contain an uppercase letter.'
  if (!/[a-z]/.test(pw)) return 'Password must contain a lowercase letter.'
  if (!/[0-9]/.test(pw)) return 'Password must contain a number.'
  return null
}
const AVATAR_COLORS = ['#e63946', '#1d4ed8', '#0ea5e9', '#7c3aed', '#059669', '#d97706']
const str = (v, max = 100000) => (typeof v === 'string' && v.length <= max ? v : null)

// ================= AUTH =================

export function register(input = {}) {
  const fullName = (input.fullName || '').trim()
  const username = (input.username || '').trim().toLowerCase()
  const email = (input.email || '').trim().toLowerCase()
  if (!fullName) fail('Full name is required.')
  if (!/^[a-z0-9_]{3,20}$/.test(username)) fail('Username must be 3–20 characters (letters, numbers, underscore).')
  if (!EMAIL_RE.test(email)) fail('Please enter a valid email address.')
  const pwIssue = passwordIssues(input.password)
  if (pwIssue) fail(pwIssue)
  if (input.password !== input.confirmPassword) fail('Passwords do not match.')
  if (!(input.phone || '').trim()) fail('Phone number is required.')
  if (R.getUserByEmail(email)) fail('An account with this email already exists.')
  if (R.getUserByUsername(username)) fail('This username is already taken.')

  const id = uid('u')
  const user = {
    id, fullName, username, email,
    phone: input.phone.trim(),
    ffUid: (input.ffUid || '').trim() || null,
    ffIgn: (input.ffIgn || '').trim() || null,
    role: 'player', status: 'active', createdAt: nowIso(),
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  }
  db.transaction(() => {
    db.prepare(`INSERT INTO users (id,fullName,username,email,passwordHash,phone,ffUid,ffIgn,role,status,createdAt,avatarColor)
      VALUES (@id,@fullName,@username,@email,@passwordHash,@phone,@ffUid,@ffIgn,@role,@status,@createdAt,@avatarColor)`)
      .run({ ...user, passwordHash: hashPassword(input.password) })
    R.ensureWallet(id)
    R.addAudit(user, 'Player Registered', user.username, `New player registered: ${user.email}`, 'player')
    R.notifyAdmins('New player registration', `${user.fullName} (@${user.username}) just registered.`, 'registration')
  })()
  return { id }
}

export function login({ email, password, adminOnly = false }) {
  const user = R.getUserByEmail((email || '').trim())
  if (!user || !verifyPassword(password || '', user.passwordHash)) fail('Invalid email or password.')
  if (user.status === 'suspended') fail('This account has been suspended. Contact support.')
  if (adminOnly && !isStaff(user.role)) fail('This account does not have staff access.')
  R.addAudit(user, 'Login', user.username, `${adminOnly ? 'Admin panel' : 'Player'} login`, 'auth')
  return { id: user.id }
}

export function changePassword(actor, { current, next }) {
  const user = requireUser(actor)
  if (!verifyPassword(current || '', user.passwordHash)) fail('Current password is incorrect.')
  const issue = passwordIssues(next)
  if (issue) fail(issue)
  db.prepare('UPDATE users SET passwordHash=? WHERE id=?').run(hashPassword(next), user.id)
  R.addAudit(user, 'Password Changed', user.username, 'Password changed', 'auth')
  return {}
}

export function resetPassword({ email, newPassword }) {
  const issue = passwordIssues(newPassword)
  if (issue) fail(issue)
  const user = R.getUserByEmail((email || '').trim())
  if (!user) fail('No account found with this email.')
  db.prepare('UPDATE users SET passwordHash=? WHERE id=?').run(hashPassword(newPassword), user.id)
  R.addAudit(user, 'Password Reset', user.username, 'Password reset via recovery flow', 'auth')
  return {}
}

export function updateProfile(actor, { fullName, phone, ffUid, ffIgn }) {
  const user = requireUser(actor)
  if (fullName !== undefined && !fullName.trim()) fail('Full name cannot be empty.')
  db.prepare('UPDATE users SET fullName=?, phone=?, ffUid=?, ffIgn=? WHERE id=?').run(
    fullName !== undefined ? fullName.trim() : user.fullName,
    phone !== undefined ? phone.trim() : user.phone,
    ffUid !== undefined ? (ffUid.trim() || null) : user.ffUid,
    ffIgn !== undefined ? (ffIgn.trim() || null) : user.ffIgn,
    user.id,
  )
  return {}
}

// ================= TOURNAMENTS (staff) =================

export function createTournament(actor, input) {
  const admin = requireArea(actor, 'tournaments')
  const name = (input.name || '').trim()
  if (!name) fail('Tournament name is required.')
  if (input.entryFee < 0) fail('Entry fee cannot be negative.')
  if (input.maxPlayers < 2) fail('Maximum players must be at least 2.')
  if (!input.date) fail('Tournament date is required.')
  if (R.allTournaments().some((t) => t.name.trim().toLowerCase() === name.toLowerCase()))
    fail('A tournament with this name already exists.')
  const t = {
    id: uid('t'), name,
    description: str(input.description) || '',
    game: str(input.game) || 'Free Fire',
    type: str(input.type) || 'Solo',
    entryFee: Number(input.entryFee) || 0,
    prizePool: Number(input.prizePool) || 0,
    maxPlayers: Number(input.maxPlayers) || 2,
    date: input.date, startTime: str(input.startTime) || '',
    regDeadline: str(input.regDeadline) || '',
    roomId: str(input.roomId) || undefined, roomPassword: str(input.roomPassword) || undefined,
    map: str(input.map) || undefined, mode: str(input.mode) || undefined,
    rules: str(input.rules) || undefined, banner: str(input.banner, 5_000_000) || '',
    status: input.status || 'upcoming',
    prizes: Array.isArray(input.prizes) ? input.prizes : [],
    createdAt: nowIso(),
  }
  db.transaction(() => {
    R.saveTournament(t)
    R.addAudit(admin, 'Tournament Created', t.name, `Created tournament "${t.name}" (entry ${t.entryFee} NCC, prize pool ${t.prizePool} NCC)`, 'tournament')
    const open = t.status === 'registration_open'
    R.notifyAllPlayers(
      open ? `Registration open: ${t.name}` : `New tournament: ${t.name}`,
      `${t.type} · ${t.game}. Entry ${t.entryFee} NCC, prize pool ${t.prizePool} NCC on ${t.date}${t.startTime ? ' at ' + t.startTime : ''}. ${open ? 'Join now from the Tournaments page!' : 'Registration opens soon — stay tuned.'}`,
      'tournament',
    )
  })()
  return { id: t.id }
}

export function updateTournament(actor, { id, patch }) {
  const admin = requireArea(actor, 'tournaments')
  const t = R.getTournament(id)
  if (!t) fail('Tournament not found.')
  if (patch.name && R.allTournaments().some((x) => x.id !== id && x.name.trim().toLowerCase() === patch.name.trim().toLowerCase()))
    fail('Another tournament with this name already exists.')
  const { id: _i, createdAt: _c, ...safe } = patch
  const updated = { ...t, ...safe }
  db.transaction(() => {
    R.saveTournament(updated)
    R.addAudit(admin, 'Tournament Updated', t.name, `Updated tournament "${t.name}"`, 'tournament')
    const relevant = ['upcoming', 'registration_open', 'live'].includes(updated.status)
    if (relevant) {
      R.notifyAllPlayers('Tournament updated', `"${updated.name}" details were updated. Entry ${updated.entryFee} NCC · ${updated.date}${updated.startTime ? ' at ' + updated.startTime : ''}. Check the tournament page for the latest info.`, 'tournament')
    } else {
      for (const reg of R.joinedRegs(id)) R.notify(reg.userId, 'Tournament updated', `"${updated.name}" details were updated. Check the tournament page for the latest info.`, 'tournament')
    }
  })()
  return {}
}

export function setTournamentStatus(actor, { id, status }) {
  const admin = requireArea(actor, 'tournaments')
  const t = R.getTournament(id)
  if (!t) fail('Tournament not found.')
  db.transaction(() => {
    R.saveTournament({ ...t, status })
    R.addAudit(admin, 'Tournament Updated', t.name, `Status changed to "${status.replace(/_/g, ' ')}"`, 'tournament')
    if (status === 'registration_open' && t.status !== 'registration_open') {
      R.notifyAllPlayers(`Registration open: ${t.name}`, `You can now join "${t.name}". Entry ${t.entryFee} NCC, prize pool ${t.prizePool} NCC. Head to the Tournaments page to secure your slot!`, 'tournament')
    } else if (status === 'live' && t.status !== 'live') {
      R.notifyAllPlayers(`${t.name} is LIVE!`, `"${t.name}" has started. Registered players — check the match room details now.`, 'match')
    }
  })()
  return {}
}

export function cancelTournament(actor, { id, refund = true }) {
  const admin = requireArea(actor, 'tournaments')
  const t = R.getTournament(id)
  if (!t) fail('Tournament not found.')
  db.transaction(() => {
    R.saveTournament({ ...t, status: 'cancelled' })
    R.addAudit(admin, 'Tournament Cancelled', t.name, `Cancelled tournament "${t.name}"${refund ? ' — entry fees refunded' : ''}`, 'tournament')
    const regs = R.joinedRegs(id)
    for (const r of regs) {
      if (refund && t.entryFee > 0) {
        R.addTxn(r.userId, t.entryFee, 'refund', 'completed', `Refund — ${t.name} cancelled`)
        const w = R.getWallet(r.userId)
        R.applyWallet(r.userId, { available: w.available + t.entryFee, totalSpent: Math.max(0, w.totalSpent - t.entryFee) })
        R.notify(r.userId, 'Tournament cancelled', `"${t.name}" was cancelled. ${t.entryFee} NCC entry fee refunded to your wallet.`, 'refund')
      } else {
        R.notify(r.userId, 'Tournament cancelled', `"${t.name}" was cancelled.`, 'tournament')
      }
    }
  })()
  return {}
}

export function deleteTournament(actor, { id }) {
  const admin = requireAdmin(actor)
  const t = R.getTournament(id)
  if (!t) fail('Tournament not found.')
  if (R.joinedCount(id) > 0) fail('Tournament has registered players. Cancel it instead to trigger refunds.')
  db.transaction(() => {
    db.prepare('DELETE FROM matches WHERE tournamentId=?').run(id)
    db.prepare('DELETE FROM tournaments WHERE id=?').run(id)
    R.addAudit(admin, 'Tournament Deleted', t.name, `Deleted tournament "${t.name}"`, 'tournament')
  })()
  return {}
}

// ================= JOINING (player) =================

export function joinTournament(actor, { tournamentId }) {
  const user = requireUser(actor)
  if (user.status === 'suspended') fail('Your account is suspended. Contact support.')

  // Re-read and validate everything inside the same SQLite transaction as the
  // registration insert. This prevents two users joining the final slot at
  // the same time and makes the player count globally consistent.
  db.transaction(() => {
    const t = R.getTournament(tournamentId)
    if (!t) fail('Tournament not found.')
    if (t.status !== 'registration_open') fail('Registration is not open for this tournament.')
    if (R.hasJoined(tournamentId, user.id)) fail('You have already joined this tournament.')
    if (R.joinedCount(tournamentId) >= t.maxPlayers) fail('This tournament is full.')

    const w = R.ensureWallet(user.id)
    if (w.available < t.entryFee) fail('Insufficient NCC Coins. Please deposit coins before joining.')

    if (t.entryFee > 0) {
      R.addTxn(user.id, t.entryFee, 'tournament_entry', 'completed', `Entry fee — ${t.name}`)
      const cur = R.getWallet(user.id)
      R.applyWallet(user.id, { available: cur.available - t.entryFee, totalSpent: cur.totalSpent + t.entryFee })
    }
    db.prepare('INSERT INTO registrations (id,tournamentId,userId,joinedAt,status) VALUES (?,?,?,?,?)')
      .run(uid('r'), tournamentId, user.id, nowIso(), 'joined')
    R.notify(user.id, 'Tournament joined', `You joined "${t.name}".${t.entryFee > 0 ? ` ${t.entryFee} NCC entry fee deducted.` : ''}`, 'tournament')
  })()
  return {}
}

export function cancelRegistration(actor, { tournamentId }) {
  const user = requireUser(actor)
  const reg = db.prepare("SELECT * FROM registrations WHERE tournamentId=? AND userId=? AND status='joined'").get(tournamentId, user.id)
  if (!reg) fail('You are not registered for this tournament.')
  const t = R.getTournament(tournamentId)
  db.transaction(() => {
    db.prepare("UPDATE registrations SET status='cancelled' WHERE id=?").run(reg.id)
    if (t && t.entryFee > 0) {
      R.addTxn(user.id, t.entryFee, 'refund', 'completed', `Refund — withdrew from ${t.name}`)
      const w = R.getWallet(user.id)
      R.applyWallet(user.id, { available: w.available + t.entryFee, totalSpent: Math.max(0, w.totalSpent - t.entryFee) })
      R.notify(user.id, 'Registration cancelled', `You left "${t.name}". ${t.entryFee} NCC refunded.`, 'refund')
    }
  })()
  return {}
}

// ================= DEPOSITS =================

export function requestDeposit(actor, { amount, reference, note, screenshot }) {
  const user = requireUser(actor)
  const s = R.getSettings()
  if (!s.payment.depositEnabled) fail('Deposits are currently disabled. Please try again later.')
  amount = Number(amount)
  if (!Number.isFinite(amount) || amount <= 0) fail('Please enter a valid positive amount.')
  if (amount < s.wallet.minDeposit) fail(`Minimum deposit is ${s.wallet.minDeposit} NCC.`)
  if (amount > s.wallet.maxDeposit) fail(`Maximum deposit is ${s.wallet.maxDeposit} NCC.`)
  if (!(reference || '').trim()) fail('Payment reference / transaction ID is required.')

  let depId
  db.transaction(() => {
    depId = uid('d')
    const dep = { id: depId, userId: user.id, amount, reference: reference.trim(), note: (note || '').trim() || undefined, screenshot: str(screenshot, 5_000_000) || undefined, status: 'pending', createdAt: nowIso() }
    const txnId = R.addTxn(user.id, amount, 'deposit', 'pending', `Deposit request — ₹${amount} (ref ${dep.reference})`)
    dep.txnId = txnId
    db.prepare('INSERT INTO deposits (id,userId,amount,status,createdAt,data) VALUES (?,?,?,?,?,?)').run(dep.id, dep.userId, dep.amount, dep.status, dep.createdAt, JSON.stringify(dep))
    R.notifyAdmins('New deposit request', `${user.fullName} requested ${amount} NCC deposit (ref ${dep.reference}).`, 'deposit')
  })()
  return { id: depId }
}

export function reviewDeposit(actor, { depositId, approve, rejectReason }) {
  const admin = requireArea(actor, 'deposits')
  const row = db.prepare('SELECT data FROM deposits WHERE id=?').get(depositId)
  if (!row) fail('Deposit not found.')
  const dep = JSON.parse(row.data)
  if (dep.status !== 'pending') fail('This deposit has already been reviewed.')
  if (!approve && !(rejectReason || '').trim()) fail('Please provide a reason for rejection.')
  const user = R.getUser(dep.userId)

  db.transaction(() => {
    const updated = { ...dep, status: approve ? 'approved' : 'rejected', reviewedAt: nowIso(), reviewedBy: admin.id, rejectReason: approve ? undefined : rejectReason }
    db.prepare('UPDATE deposits SET status=?, data=? WHERE id=?').run(updated.status, JSON.stringify(updated), depositId)
    R.setTxnStatus(dep.txnId, approve ? 'completed' : 'rejected')
    if (approve) {
      const w = R.getWallet(dep.userId)
      R.applyWallet(dep.userId, { available: w.available + dep.amount, totalDeposited: w.totalDeposited + dep.amount })
      R.notify(dep.userId, 'Deposit approved', `Your deposit of ${dep.amount} NCC was approved. Your balance has been updated.`, 'deposit')
    } else {
      R.notify(dep.userId, 'Deposit rejected', `Your deposit of ${dep.amount} NCC was rejected. Reason: ${rejectReason}`, 'deposit')
    }
    R.addAudit(admin, approve ? 'Deposit Approved' : 'Deposit Rejected', user?.username ?? dep.userId, `${approve ? 'Approved' : 'Rejected'} deposit of ${dep.amount} NCC (ref ${dep.reference})${approve ? '' : ` — ${rejectReason}`}`, 'finance')
  })()
  return {}
}

// ================= WITHDRAWALS =================

export function requestWithdrawal(actor, { amount, method, account, note, image }) {
  const user = requireUser(actor)
  const s = R.getSettings()
  amount = Number(amount)
  if (!Number.isFinite(amount) || amount <= 0) fail('Please enter a valid positive amount.')
  if (amount < s.wallet.minWithdraw) fail(`Minimum withdrawal is ${s.wallet.minWithdraw} NCC.`)
  if (amount > s.wallet.maxWithdraw) fail(`Maximum withdrawal is ${s.wallet.maxWithdraw} NCC.`)
  if (!(method || '').trim()) fail('Please select a payment method.')
  const hasAccount = (account || '').trim()
  const hasImage = str(image, 5_000_000)
  if (!hasAccount && !hasImage) fail('Add your payment QR image OR enter your account / payment number.')
  const w = R.ensureWallet(user.id)
  if (w.available < amount) fail(`Insufficient available balance. You can withdraw up to ${w.available} NCC.`)

  db.transaction(() => {
    // Reserve immediately (atomic) so the same coins cannot be double-spent.
    R.applyWallet(user.id, { available: w.available - amount, pending: w.pending + amount })
    const txnId = R.addTxn(user.id, amount, 'withdrawal', 'pending', `Withdrawal requested — ₹${amount} via ${method}`)
    const wd = { id: uid('w'), userId: user.id, amount, method: method.trim(), account: hasAccount || '', note: (note || '').trim() || undefined, image: hasImage || undefined, status: 'pending', createdAt: nowIso(), txnId }
    db.prepare('INSERT INTO withdrawals (id,userId,amount,status,createdAt,data) VALUES (?,?,?,?,?,?)').run(wd.id, wd.userId, wd.amount, wd.status, wd.createdAt, JSON.stringify(wd))
    R.notify(user.id, 'Withdrawal requested', `Your withdrawal of ${amount} NCC is pending admin review. The amount is reserved until processed.`, 'withdrawal')
    R.notifyAdmins('New withdrawal request', `${user.fullName} requested ${amount} NCC withdrawal via ${method}.`, 'withdrawal')
  })()
  return {}
}

export function reviewWithdrawal(actor, { withdrawalId, action, rejectReason }) {
  const admin = requireArea(actor, 'withdrawals')
  const row = db.prepare('SELECT data FROM withdrawals WHERE id=?').get(withdrawalId)
  if (!row) fail('Withdrawal not found.')
  const wd = JSON.parse(row.data)
  if (wd.status === 'paid') fail('This withdrawal is already paid.')
  if (wd.status === 'rejected') fail('This withdrawal was already rejected.')
  if (action === 'reject' && !(rejectReason || '').trim()) fail('Please provide a reason for rejection.')
  if (!['approve', 'reject', 'paid'].includes(action)) fail('Invalid action.')
  const user = R.getUser(wd.userId)

  db.transaction(() => {
    let updated
    if (action === 'reject') {
      const w = R.getWallet(wd.userId)
      R.applyWallet(wd.userId, { available: w.available + wd.amount, pending: Math.max(0, w.pending - wd.amount) })
      updated = { ...wd, status: 'rejected', reviewedAt: nowIso(), reviewedBy: admin.id, rejectReason }
      R.setTxnStatus(wd.txnId, 'rejected')
      R.notify(wd.userId, 'Withdrawal rejected', `Your withdrawal of ${wd.amount} NCC was rejected. Reason: ${rejectReason}. The reserved coins were returned to your balance.`, 'withdrawal')
      R.addAudit(admin, 'Withdrawal Rejected', user?.username ?? wd.userId, `Rejected withdrawal of ${wd.amount} NCC — ${rejectReason}`, 'finance')
    } else if (action === 'approve') {
      updated = { ...wd, status: 'approved', reviewedAt: nowIso(), reviewedBy: admin.id }
      R.notify(wd.userId, 'Withdrawal approved', `Your withdrawal of ${wd.amount} NCC was approved and will be paid shortly.`, 'withdrawal')
      R.addAudit(admin, 'Withdrawal Approved', user?.username ?? wd.userId, `Approved withdrawal of ${wd.amount} NCC via ${wd.method}`, 'finance')
    } else {
      const w = R.getWallet(wd.userId)
      R.applyWallet(wd.userId, { pending: Math.max(0, w.pending - wd.amount), totalWithdrawn: w.totalWithdrawn + wd.amount })
      updated = { ...wd, status: 'paid', reviewedAt: nowIso(), reviewedBy: admin.id }
      R.setTxnStatus(wd.txnId, 'completed')
      R.notify(wd.userId, 'Withdrawal paid', `Your withdrawal of ${wd.amount} NCC was paid to ${wd.method} (${wd.account}).`, 'withdrawal')
      R.addAudit(admin, 'Withdrawal Paid', user?.username ?? wd.userId, `Paid withdrawal of ${wd.amount} NCC via ${wd.method} to ${wd.account}`, 'finance')
    }
    db.prepare('UPDATE withdrawals SET status=?, data=? WHERE id=?').run(updated.status, JSON.stringify(updated), withdrawalId)
  })()
  return {}
}

// ================= WALLET MANAGEMENT (staff) =================

export function adjustBalance(actor, { userId, delta, reason }) {
  const admin = requireArea(actor, 'wallet')
  delta = Number(delta)
  if (!Number.isFinite(delta) || delta === 0) fail('Amount must be a non-zero number.')
  if (!(reason || '').trim()) fail('A reason is required for manual adjustments.')
  const user = R.getUser(userId)
  const w = R.ensureWallet(userId)
  if (!user) fail('Player or wallet not found.')
  if (delta < 0 && w.available + delta < 0) fail(`Cannot deduct more than the available balance (${w.available} NCC).`)
  db.transaction(() => {
    R.addTxn(userId, Math.abs(delta), 'adjustment', 'completed', `Admin adjustment (${delta > 0 ? '+' : '−'}${Math.abs(delta)} NCC) — ${reason.trim()}`)
    R.applyWallet(userId, { available: w.available + delta })
    R.notify(userId, 'Wallet adjustment', `An admin ${delta > 0 ? 'added' : 'deducted'} ${Math.abs(delta)} NCC ${delta > 0 ? 'to' : 'from'} your wallet. Reason: ${reason.trim()}`, 'wallet')
    R.addAudit(admin, 'Wallet Adjustment', user.username, `${delta > 0 ? 'Added' : 'Deducted'} ${Math.abs(delta)} NCC to/from ${user.username} — ${reason.trim()}`, 'finance')
  })()
  return {}
}

// ================= PLAYER MANAGEMENT (super admin) =================

export function setPlayerStatus(actor, { userId, status }) {
  const admin = requireAdmin(actor)
  const user = R.getUser(userId)
  if (!user) fail('Player not found.')
  if (isStaff(user.role)) fail('Staff accounts cannot be suspended here. Change their role to Player first.')
  db.transaction(() => {
    db.prepare('UPDATE users SET status=? WHERE id=?').run(status, userId)
    R.addAudit(admin, status === 'suspended' ? 'Player Suspended' : 'Player Activated', user.username, `Account ${status === 'suspended' ? 'suspended' : 'reactivated'}`, 'player')
    R.notify(userId, status === 'suspended' ? 'Account suspended' : 'Account reactivated', status === 'suspended' ? 'Your account has been suspended. Contact support for details.' : 'Your account is active again. Welcome back!', 'account')
  })()
  return {}
}

export function setUserRole(actor, { userId, role }) {
  const admin = requireAdmin(actor)
  if (admin.id === userId) fail('You cannot change your own role.')
  const user = R.getUser(userId)
  if (!user) fail('User not found.')
  if (!['player', 'coin_manager', 'tournament_maker', 'admin'].includes(role)) fail('Invalid role.')
  if (user.role === role) fail(`${user.fullName} already has the ${ROLE_LABELS[role]} role.`)
  db.transaction(() => {
    db.prepare('UPDATE users SET role=? WHERE id=?').run(role, userId)
    R.addAudit(admin, 'Role Changed', user.username, `Role changed from ${ROLE_LABELS[user.role]} to ${ROLE_LABELS[role]}`, 'player')
    R.notify(userId, 'Your role has changed', `Your account role is now ${ROLE_LABELS[role]}. ${isStaff(role) ? 'You can sign in to the admin panel with your usual email and password.' : 'You now have a standard player account.'}`, 'account')
  })()
  return {}
}

// ================= MATCHES (staff) =================

export function saveMatch(actor, input) {
  const admin = requireArea(actor, 'matches')
  if (!(input.name || '').trim()) fail('Match name is required.')
  if (!input.tournamentId) fail('Please select a tournament.')
  if (!R.getTournament(input.tournamentId)) fail('Tournament not found.')
  const m = {
    id: input.id || uid('m'), tournamentId: input.tournamentId, name: input.name.trim(),
    date: str(input.date) || '', startTime: str(input.startTime) || '', map: str(input.map) || '',
    mode: str(input.mode) || '', roomId: str(input.roomId) || '', roomPassword: str(input.roomPassword) || '',
    roomReleaseTime: str(input.roomReleaseTime) || '', status: input.status || 'scheduled',
  }
  db.transaction(() => {
    R.saveMatchRow(m)
    R.addAudit(admin, input.id ? 'Match Updated' : 'Match Created', m.name, `${input.id ? 'Updated' : 'Created'} match "${m.name}"`, 'tournament')
  })()
  return { id: m.id }
}

export function setMatchStatus(actor, { id, status }) {
  const admin = requireArea(actor, 'matches')
  const m = R.getMatch(id)
  if (!m) fail('Match not found.')
  db.transaction(() => {
    R.saveMatchRow({ ...m, status })
    R.addAudit(admin, 'Match Updated', m.name, `Match status changed to "${status}"`, 'tournament')
    if (status === 'live') {
      for (const r of R.joinedRegs(m.tournamentId)) R.notify(r.userId, 'Match starting!', `"${m.name}" is now LIVE. Room: ${m.roomId} / ${m.roomPassword}`, 'match')
    }
  })()
  return {}
}

export function deleteMatch(actor, { id }) {
  const admin = requireArea(actor, 'matches')
  db.transaction(() => {
    R.deleteMatchRow(id)
    R.addAudit(admin, 'Match Deleted', id, 'Deleted match', 'tournament')
  })()
  return {}
}

// ================= RESULTS (staff) =================

export function saveResultDraft(actor, { matchId, entries }) {
  const admin = requireArea(actor, 'results')
  const m = R.getMatch(matchId)
  if (!m) fail('Match not found.')
  if (!Array.isArray(entries)) fail('Entries must be an array.')
  db.transaction(() => {
    const existing = R.getResultByMatch(matchId)
    if (existing) {
      if (existing.status === 'published') return
      R.saveResult({ ...existing, entries, status: 'draft' })
    } else {
      R.saveResult({ id: uid('res'), matchId, tournamentId: m.tournamentId, status: 'draft', entries, createdAt: nowIso(), prizesDistributed: false })
    }
    R.addAudit(admin, 'Result Updated', m.name, `Saved result draft (${entries.length} players)`, 'result')
  })()
  return {}
}

export function setResultStatus(actor, { matchId, status }) {
  const admin = requireArea(actor, 'results')
  const r = R.getResultByMatch(matchId)
  const m = R.getMatch(matchId)
  if (!r || !m) fail('Result not found. Save a draft first.')
  if (r.entries.length === 0) fail('Cannot advance an empty result. Add player rows first.')
  const order = ['draft', 'submitted', 'approved', 'published']
  if (order.indexOf(status) <= order.indexOf(r.status)) fail(`Result is already "${r.status}".`)
  if (status === 'approved' && r.status !== 'submitted') fail('Result must be submitted before approval.')
  db.transaction(() => {
    const stamp = status === 'submitted' ? { submittedAt: nowIso() } : status === 'approved' ? { approvedAt: nowIso() } : { publishedAt: nowIso() }
    R.saveResult({ ...r, status, ...stamp })
    if (status === 'published') {
      R.saveMatchRow({ ...m, status: 'completed' })
      for (const rg of R.joinedRegs(r.tournamentId)) R.notify(rg.userId, 'Result published', `Results for "${m.name}" are published. Check the leaderboard!`, 'result')
    }
    if (status === 'submitted') R.notifyAdmins('Result awaiting approval', `Results for "${m.name}" were submitted and await approval.`, 'result')
    R.addAudit(admin, status === 'published' ? 'Result Published' : status === 'approved' ? 'Result Approved' : 'Result Submitted', m.name, `Result marked as "${status}"`, 'result')
  })()
  return {}
}

export function distributePrizes(actor, { resultId }) {
  const admin = requireArea(actor, 'results')
  const r = R.getResult(resultId)
  if (!r) fail('Result not found.')
  if (r.status !== 'published' && r.status !== 'approved') fail('Results must be approved/published before distributing prizes.')
  if (r.prizesDistributed) fail('Prizes were already distributed for this result.')
  const winners = r.entries.filter((e) => e.prize > 0)
  if (winners.length === 0) fail('No prize amounts configured in this result.')
  const t = R.getTournament(r.tournamentId)
  db.transaction(() => {
    R.saveResult({ ...r, prizesDistributed: true })
    for (const e of winners) {
      R.addTxn(e.userId, e.prize, 'prize', 'completed', `Prize — rank #${e.placement}, ${t?.name ?? 'tournament'}`)
      const w = R.getWallet(e.userId)
      if (w) R.applyWallet(e.userId, { available: w.available + e.prize })
      R.notify(e.userId, 'Prize received! 🏆', `You won ${e.prize} NCC (rank #${e.placement}) in ${t?.name ?? 'a tournament'}. Amount added to your wallet.`, 'prize')
    }
    R.addAudit(admin, 'Prize Distributed', t?.name ?? resultId, `Distributed ${winners.reduce((s, e) => s + e.prize, 0)} NCC to ${winners.length} winners`, 'finance')
  })()
  return {}
}

// ================= ANNOUNCEMENTS (super admin) =================

export function saveAnnouncement(actor, input) {
  const admin = requireAdmin(actor)
  if (!(input.title || '').trim()) fail('Title is required.')
  if (!(input.message || '').trim()) fail('Message is required.')
  const existing = input.id ? db.prepare('SELECT data FROM announcements WHERE id=?').get(input.id) : null
  const base = existing ? JSON.parse(existing.data) : { id: uid('a'), createdAt: nowIso() }
  const a = { ...base, title: input.title.trim(), message: input.message.trim(), image: str(input.image, 5_000_000) || undefined, priority: input.priority || 'normal', type: input.type || 'general', publishDate: input.publishDate || nowIso(), status: input.status || 'draft' }
  db.transaction(() => {
    const ex = db.prepare('SELECT id FROM announcements WHERE id=?').get(a.id)
    if (ex) db.prepare('UPDATE announcements SET status=?, data=? WHERE id=?').run(a.status, JSON.stringify(a), a.id)
    else db.prepare('INSERT INTO announcements (id,status,createdAt,data) VALUES (?,?,?,?)').run(a.id, a.status, a.createdAt, JSON.stringify(a))
    R.addAudit(admin, existing ? 'Announcement Updated' : 'Announcement Created', a.title, `${existing ? 'Updated' : 'Created'} announcement "${a.title}"`, 'content')
  })()
  return { id: a.id }
}

export function setAnnouncementStatus(actor, { id, status }) {
  const admin = requireAdmin(actor)
  const row = db.prepare('SELECT data FROM announcements WHERE id=?').get(id)
  if (!row) fail('Announcement not found.')
  const a = JSON.parse(row.data)
  db.transaction(() => {
    const updated = { ...a, status }
    db.prepare('UPDATE announcements SET status=?, data=? WHERE id=?').run(status, JSON.stringify(updated), id)
    R.addAudit(admin, status === 'published' ? 'Announcement Published' : 'Announcement Updated', a.title, `Announcement "${a.title}" set to ${status}`, 'content')
    if (status === 'published') {
      for (const u of R.allUsers().filter((u) => u.role === 'player')) R.notify(u.id, 'New announcement', a.title, 'announcement')
    }
  })()
  return {}
}

export function deleteAnnouncement(actor, { id }) {
  const admin = requireAdmin(actor)
  db.transaction(() => {
    db.prepare('DELETE FROM announcements WHERE id=?').run(id)
    R.addAudit(admin, 'Announcement Deleted', id, 'Deleted announcement', 'content')
  })()
  return {}
}

// ================= SUPPORT TICKETS =================

export function createTicket(actor, { subject, category, message, attachment }) {
  const user = requireUser(actor)
  if (!(subject || '').trim()) fail('Subject is required.')
  if (!(message || '').trim()) fail('Message is required.')
  const id = uid('tk')
  db.transaction(() => {
    const ticket = { id, userId: user.id, subject: subject.trim(), category: category || 'other', status: 'open', createdAt: nowIso(),
      messages: [{ id: uid('tm'), authorId: user.id, authorRole: user.role, authorName: user.fullName, message: message.trim(), attachment: str(attachment, 5_000_000) || undefined, createdAt: nowIso() }] }
    db.prepare('INSERT INTO tickets (id,userId,status,createdAt,data) VALUES (?,?,?,?,?)').run(id, user.id, 'open', ticket.createdAt, JSON.stringify(ticket))
    R.notifyAdmins('New support ticket', `${user.fullName}: "${ticket.subject}" (${ticket.category})`, 'ticket')
  })()
  return { id }
}

export function replyTicket(actor, { ticketId, message, attachment }) {
  const author = requireUser(actor)
  if (!(message || '').trim()) fail('Message cannot be empty.')
  const row = db.prepare('SELECT data FROM tickets WHERE id=?').get(ticketId)
  if (!row) fail('Ticket not found.')
  const ticket = JSON.parse(row.data)
  if (author.role === 'player' && author.id !== ticket.userId) fail('You can only reply to your own tickets.')
  db.transaction(() => {
    const updated = { ...ticket,
      messages: [...ticket.messages, { id: uid('tm'), authorId: author.id, authorRole: author.role, authorName: author.fullName, message: message.trim(), attachment: str(attachment, 5_000_000) || undefined, createdAt: nowIso() }],
      status: isStaff(author.role) && ticket.status === 'open' ? 'in_progress' : ticket.status }
    db.prepare('UPDATE tickets SET status=?, data=? WHERE id=?').run(updated.status, JSON.stringify(updated), ticketId)
    if (isStaff(author.role)) R.notify(ticket.userId, 'Support reply', `Admin replied to your ticket "${ticket.subject}".`, 'ticket')
    else R.notifyAdmins('Ticket reply', `${author.fullName} replied to "${ticket.subject}".`, 'ticket')
  })()
  return {}
}

export function setTicketStatus(actor, { ticketId, status }) {
  const admin = requireStaff(actor)
  const row = db.prepare('SELECT data FROM tickets WHERE id=?').get(ticketId)
  if (!row) fail('Ticket not found.')
  const ticket = JSON.parse(row.data)
  db.transaction(() => {
    db.prepare('UPDATE tickets SET status=?, data=? WHERE id=?').run(status, JSON.stringify({ ...ticket, status }), ticketId)
    R.notify(ticket.userId, 'Ticket status updated', `Your ticket "${ticket.subject}" is now: ${status.replace(/_/g, ' ')}.`, 'ticket')
    R.addAudit(admin, 'Ticket Status Changed', ticket.subject, `Ticket set to "${status}"`, 'content')
  })()
  return {}
}

// ================= SETTINGS (super admin) =================

export function updateSettings(actor, { section, patch }) {
  const admin = requireAdmin(actor)
  const s = R.getSettings()
  if (!s[section]) fail('Unknown settings section.')
  const next = { ...s, [section]: { ...s[section], ...patch } }
  db.transaction(() => {
    R.saveSettings(next)
    R.addAudit(admin, 'Settings Changed', String(section), `Updated ${String(section)} settings`, 'settings')
  })()
  return {}
}

// ================= NOTIFICATIONS =================

export function markNotificationRead(actor, { id }) {
  const user = requireUser(actor)
  const row = db.prepare('SELECT data FROM notifications WHERE id=?').get(id)
  if (!row) return {}
  const n = JSON.parse(row.data)
  if (n.userId !== user.id && !(isStaff(user.role) && n.userId === 'admins')) fail('Not your notification.', 403)
  db.prepare('UPDATE notifications SET read=1, data=? WHERE id=?').run(JSON.stringify({ ...n, read: true }), id)
  return {}
}

export function markAllNotificationsRead(actor) {
  const user = requireUser(actor)
  const targets = isStaff(user.role) ? [user.id, 'admins'] : [user.id]
  db.transaction(() => {
    for (const row of db.prepare('SELECT id,data FROM notifications WHERE read=0').all()) {
      const n = JSON.parse(row.data)
      if (targets.includes(n.userId)) db.prepare('UPDATE notifications SET read=1, data=? WHERE id=?').run(JSON.stringify({ ...n, read: true }), row.id)
    }
  })()
  return {}
}
