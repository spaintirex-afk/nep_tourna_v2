import express from 'express'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { db, seedIfEmpty, nowIso } from './db.js'
import * as A from './actions.js'
import * as R from './repo.js'
import { buildState, unreadCount } from './state.js'
import { isStaff } from './permissions.js'
import { sseHandler, broadcast } from './realtime.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 8080
const HOST = process.env.HOST || '0.0.0.0'
const COOKIE = 'nt_session'
const SESSION_DAYS_REMEMBER = 30
const SESSION_DAYS_TAB = 1 // "don't remember" still needs a server expiry; browser clears cookie on close

seedIfEmpty()

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '12mb' }))

// Capacitor/mobile builds call the deployed API from capacitor://localhost.
// Configure CORS_ORIGINS in production with the exact frontend/app origins.
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean)

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// ---------- session helpers ----------
function createSession(userId, remember) {
  const token = crypto.randomBytes(32).toString('hex')
  const days = remember ? SESSION_DAYS_REMEMBER : SESSION_DAYS_TAB
  const expiresAt = new Date(Date.now() + days * 864e5).toISOString()
  db.prepare('INSERT INTO sessions (token,userId,createdAt,expiresAt) VALUES (?,?,?,?)').run(token, userId, nowIso(), expiresAt)
  return { token, expiresAt, persistent: remember }
}
function readSession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE]
  if (!token) return null
  const s = db.prepare('SELECT * FROM sessions WHERE token=?').get(token)
  if (!s) return null
  if (new Date(s.expiresAt).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token=?').run(token)
    return null
  }
  const user = R.getUser(s.userId)
  if (!user || user.status === 'suspended') return null
  return { token, user }
}
function destroySession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE]
  if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(token)
}
function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}
function setSessionCookie(res, { token, expiresAt, persistent }) {
  const maxAge = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  const crossOrigin = corsOrigins.length > 0
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=${crossOrigin ? 'None' : 'Lax'}; Max-Age=${maxAge}${crossOrigin ? '; Secure' : ''}`)
}
function clearSessionCookie(res) {
  const crossOrigin = corsOrigins.length > 0
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=${crossOrigin ? 'None' : 'Lax'}; Max-Age=0${crossOrigin ? '; Secure' : ''}`)
}

// ---------- middleware ----------
function attachUser(req, _res, next) {
  const s = readSession(req)
  req.user = s ? s.user : null
  next()
}
app.use(attachUser)

// Wrap an action handler: resolves actor from session, runs it, returns fresh state.
function handler(fn, { auth = true } = {}) {
  return (req, res) => {
    try {
      if (auth && !req.user) return res.status(401).json({ ok: false, error: 'You must be logged in.' })
      const result = fn(req.user, req.body || {}, req) || {}
      // Auth endpoints signal the new user id via result.__login
      res.json({ ok: true, ...result })
      broadcast('changed')
    } catch (e) {
      if (e instanceof A.AppError) return res.status(e.status).json({ ok: false, error: e.message })
      console.error('[api error]', e)
      res.status(500).json({ ok: false, error: 'Server error. Please try again.' })
    }
  }
}

// ---------- auth routes (set/clear cookie, then return state) ----------
app.post('/api/register', (req, res) => {
  try {
    const { id } = A.register(req.body || {})
    const user = R.getUser(id)
    setSessionCookie(res, createSession(id, true))
    res.json({ ok: true, id, state: buildState(user), unread: unreadCount(user), me: R.publicUser(user) })
    broadcast('changed')
  } catch (e) { return err(res, e) }
})
app.post('/api/login', (req, res) => {
  try {
    const { email, password, remember, adminOnly } = req.body || {}
    const { id } = A.login({ email, password, adminOnly })
    const user = R.getUser(id)
    setSessionCookie(res, createSession(id, !!remember))
    res.json({ ok: true, id, state: buildState(user), unread: unreadCount(user), me: R.publicUser(user) })
    broadcast('changed')
  } catch (e) { return err(res, e) }
})
app.post('/api/logout', (req, res) => {
  try {
    if (req.user) R.addAudit(req.user, 'Logout', req.user.username, 'User logged out', 'auth')
  } catch {}
  destroySession(req)
  clearSessionCookie(res)
  res.json({ ok: true })
  broadcast('changed')
})
app.post('/api/reset-password', (req, res) => {
  try { const r = A.resetPassword(req.body || {}); res.json({ ok: true, ...r }); broadcast('changed') } catch (e) { return err(res, e) }
})

// Bootstrap: returns current session user + scoped state (or public state).
app.get('/api/state', (req, res) => {
  try {
    res.json({ ok: true, me: R.publicUser(req.user), state: buildState(req.user), unread: unreadCount(req.user) })
  } catch (e) { return err(res, e) }
})

// Real-time channel: clients listen and re-fetch /api/state on every ping.
app.get('/api/events', sseHandler)

// ---------- generic action routes ----------
// Each returns the mutated result; the client refetches /api/state afterwards.
const post = (path, fn, opts) => app.post(path, handler(fn, opts))

post('/api/profile/update', (u, b) => A.updateProfile(u, b))
post('/api/password/change', (u, b) => A.changePassword(u, b))

post('/api/tournaments/create', (u, b) => A.createTournament(u, b))
post('/api/tournaments/update', (u, b) => A.updateTournament(u, b))
post('/api/tournaments/status', (u, b) => A.setTournamentStatus(u, b))
post('/api/tournaments/cancel', (u, b) => A.cancelTournament(u, b))
post('/api/tournaments/delete', (u, b) => A.deleteTournament(u, b))
post('/api/tournaments/join', (u, b) => A.joinTournament(u, b))
post('/api/tournaments/leave', (u, b) => A.cancelRegistration(u, b))

post('/api/deposits/request', (u, b) => A.requestDeposit(u, b))
post('/api/deposits/review', (u, b) => A.reviewDeposit(u, b))
post('/api/withdrawals/request', (u, b) => A.requestWithdrawal(u, b))
post('/api/withdrawals/review', (u, b) => A.reviewWithdrawal(u, b))
post('/api/wallet/adjust', (u, b) => A.adjustBalance(u, b))

post('/api/players/status', (u, b) => A.setPlayerStatus(u, b))
post('/api/players/role', (u, b) => A.setUserRole(u, b))

post('/api/matches/save', (u, b) => A.saveMatch(u, b))
post('/api/matches/status', (u, b) => A.setMatchStatus(u, b))
post('/api/matches/delete', (u, b) => A.deleteMatch(u, b))

post('/api/results/draft', (u, b) => A.saveResultDraft(u, b))
post('/api/results/status', (u, b) => A.setResultStatus(u, b))
post('/api/results/distribute', (u, b) => A.distributePrizes(u, b))

post('/api/announcements/save', (u, b) => A.saveAnnouncement(u, b))
post('/api/announcements/status', (u, b) => A.setAnnouncementStatus(u, b))
post('/api/announcements/delete', (u, b) => A.deleteAnnouncement(u, b))

post('/api/tickets/create', (u, b) => A.createTicket(u, b))
post('/api/tickets/reply', (u, b) => A.replyTicket(u, b))
post('/api/tickets/status', (u, b) => A.setTicketStatus(u, b))

post('/api/settings/update', (u, b) => A.updateSettings(u, b))

post('/api/notifications/read', (u, b) => A.markNotificationRead(u, b))
post('/api/notifications/read-all', (u) => A.markAllNotificationsRead(u))

function err(res, e) {
  if (e instanceof A.AppError) return res.status(e.status).json({ ok: false, error: e.message })
  console.error('[api error]', e)
  res.status(500).json({ ok: false, error: 'Server error. Please try again.' })
}

// ---------- static frontend (SPA fallback) ----------
const DIST = process.env.DIST_DIR || path.join(__dirname, '..', 'dist')
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(DIST, 'index.html'))
  })
} else {
  app.get('/', (_req, res) => res.type('text/plain').send('Nep Tourna API running. Build the frontend into ../dist to serve the app.'))
}

app.listen(PORT, HOST, () => {
  console.log(`Nep Tourna server listening on http://${HOST}:${PORT}`)
  console.log(`Database: ${process.env.DB_FILE || path.join(__dirname, 'data', 'neptourna.db')}`)
})
