import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSeed } from './seed-data.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'neptourna.db')

fs.mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(DB_FILE)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  fullName TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  ffUid TEXT,
  ffIgn TEXT,
  role TEXT NOT NULL DEFAULT 'player',
  status TEXT NOT NULL DEFAULT 'active',
  createdAt TEXT NOT NULL,
  avatarColor TEXT NOT NULL DEFAULT '#1d4ed8'
);
CREATE TABLE IF NOT EXISTS wallets (
  userId TEXT PRIMARY KEY,
  available INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0,
  totalDeposited INTEGER NOT NULL DEFAULT 0,
  totalWithdrawn INTEGER NOT NULL DEFAULT 0,
  totalSpent INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  tournamentId TEXT NOT NULL,
  userId TEXT NOT NULL,
  joinedAt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'joined'
);
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  tournamentId TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  matchId TEXT NOT NULL,
  tournamentId TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  category TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(userId);
CREATE INDEX IF NOT EXISTS idx_reg_tournament ON registrations(tournamentId);
CREATE INDEX IF NOT EXISTS idx_reg_user ON registrations(userId);
CREATE UNIQUE INDEX IF NOT EXISTS ux_reg_tournament_user ON registrations(tournamentId, userId);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(userId);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId);
`

db.exec(SCHEMA)

export function hashPassword(pw) {
  return bcrypt.hashSync(pw, 10)
}
export function verifyPassword(pw, hash) {
  try { return bcrypt.compareSync(pw, hash) } catch { return false }
}

function hasUsers() {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c > 0
}

export function seedIfEmpty() {
  if (hasUsers()) return false
  const s = buildSeed()
  const insertUser = db.prepare(`INSERT INTO users (id,fullName,username,email,passwordHash,phone,ffUid,ffIgn,role,status,createdAt,avatarColor)
    VALUES (@id,@fullName,@username,@email,@passwordHash,@phone,@ffUid,@ffIgn,@role,@status,@createdAt,@avatarColor)`)
  const insertWallet = db.prepare(`INSERT INTO wallets (userId,available,pending,totalDeposited,totalWithdrawn,totalSpent)
    VALUES (@userId,@available,@pending,@totalDeposited,@totalWithdrawn,@totalSpent)`)
  const insertTxn = db.prepare(`INSERT INTO transactions (id,userId,amount,type,status,createdAt,description)
    VALUES (@id,@userId,@amount,@type,@status,@createdAt,@description)`)

  const run = db.transaction(() => {
    for (const u of s.users) {
      insertUser.run({
        id: u.id, fullName: u.fullName, username: u.username, email: u.email,
        passwordHash: hashPassword(u._plain), phone: u.phone, ffUid: u.ffUid ?? null, ffIgn: u.ffIgn ?? null,
        role: u.role, status: u.status, createdAt: u.createdAt, avatarColor: u.avatarColor,
      })
    }
    for (const w of s.wallets) insertWallet.run(w)
    for (const t of s.transactions) insertTxn.run(t)
    db.prepare('INSERT INTO meta (key,value) VALUES (?,?)').run('txnCounter', String(s.txnCounter))

    const insT = db.prepare('INSERT INTO tournaments (id,data,createdAt,name) VALUES (?,?,?,?)')
    for (const t of s.tournaments) insT.run(t.id, JSON.stringify(t), t.createdAt, t.name)

    const insR = db.prepare('INSERT INTO registrations (id,tournamentId,userId,joinedAt,status) VALUES (@id,@tournamentId,@userId,@joinedAt,@status)')
    for (const r of s.registrations) insR.run(r)

    const insM = db.prepare('INSERT INTO matches (id,tournamentId,data) VALUES (?,?,?)')
    for (const m of s.matches) insM.run(m.id, m.tournamentId, JSON.stringify(m))

    const insRes = db.prepare('INSERT INTO results (id,matchId,tournamentId,data) VALUES (?,?,?,?)')
    for (const r of s.results) insRes.run(r.id, r.matchId, r.tournamentId, JSON.stringify(r))

    const insD = db.prepare('INSERT INTO deposits (id,userId,amount,status,createdAt,data) VALUES (?,?,?,?,?,?)')
    for (const d of s.deposits) insD.run(d.id, d.userId, d.amount, d.status, d.createdAt, JSON.stringify(d))

    const insW = db.prepare('INSERT INTO withdrawals (id,userId,amount,status,createdAt,data) VALUES (?,?,?,?,?,?)')
    for (const w of s.withdrawals) insW.run(w.id, w.userId, w.amount, w.status, w.createdAt, JSON.stringify(w))

    const insA = db.prepare('INSERT INTO announcements (id,status,createdAt,data) VALUES (?,?,?,?)')
    for (const a of s.announcements) insA.run(a.id, a.status, a.createdAt, JSON.stringify(a))

    const insTk = db.prepare('INSERT INTO tickets (id,userId,status,createdAt,data) VALUES (?,?,?,?,?)')
    for (const t of s.tickets) insTk.run(t.id, t.userId, t.status, t.createdAt, JSON.stringify(t))

    const insAl = db.prepare('INSERT INTO audit_logs (id,timestamp,category,data) VALUES (?,?,?,?)')
    for (const a of s.auditLogs) insAl.run(a.id, a.timestamp, a.category, JSON.stringify(a))

    const insN = db.prepare('INSERT INTO notifications (id,userId,read,createdAt,data) VALUES (?,?,?,?,?)')
    for (const n of s.notifications) insN.run(n.id, n.userId, n.read ? 1 : 0, n.createdAt, JSON.stringify(n))

    db.prepare('INSERT INTO settings (id,data) VALUES (1,?)').run(JSON.stringify(s.settings))
  })
  run()
  return true
}

// ---------- id + counter helpers ----------
let randCounter = 0
export function uid(prefix) {
  randCounter += 1
  return `${prefix}_${Date.now().toString(36)}${randCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function nextTxnId() {
  const row = db.prepare("SELECT value FROM meta WHERE key='txnCounter'").get()
  const counter = (row ? parseInt(row.value, 10) : 0) + 1
  db.prepare("INSERT INTO meta (key,value) VALUES ('txnCounter',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(counter))
  return { id: `NCC-TXN-${String(counter).padStart(6, '0')}`, counter }
}

export const nowIso = () => new Date().toISOString()
