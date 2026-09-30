// Seed data for the Nep Tourna backend. Ported from the frontend demo seed so a
// fresh database starts with the same realistic content. Passwords are stored in
// plaintext here ONLY so db.js can bcrypt-hash them on insert; nothing else reads
// this field.

const now = new Date()
function day(offset, hour = 18, min = 0) {
  const d = new Date(now)
  d.setDate(d.getDate() + offset)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}
function dateStr(offset) {
  const d = new Date(now)
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}
const AVATAR_COLORS = ['#e63946', '#1d4ed8', '#0ea5e9', '#7c3aed', '#059669', '#d97706', '#dc2626', '#2563eb']

function makeUser(id, fullName, username, email, password, phone, role, ffUid, ffIgn, daysAgo, colorIdx) {
  return {
    id, fullName, username, email, phone, ffUid, ffIgn, role,
    status: 'active',
    createdAt: day(-daysAgo, 10),
    avatarColor: AVATAR_COLORS[colorIdx % AVATAR_COLORS.length],
    _plain: password,
  }
}

const DEFAULT_SETTINGS = {
  general: {
    appName: 'Nep Tourna',
    appDescription: 'Premium Free Fire esports tournament platform',
    supportEmail: 'support@neptourna.local',
    contact: 'Kathmandu, Nepal · +977-9800000000',
  },
  social: {
    facebook: 'https://facebook.com/neptourna',
    instagram: 'https://instagram.com/neptourna',
    youtube: 'https://youtube.com/@neptourna',
    discord: 'https://discord.gg/neptourna',
    twitter: 'https://twitter.com/neptourna',
    tiktok: 'https://tiktok.com/@neptourna',
  },
  wallet: { coinName: 'NCC Coin', coinSymbol: 'NCC', rate: 1, minDeposit: 50, maxDeposit: 10000, minWithdraw: 100, maxWithdraw: 5000 },
  payment: {
    qrImage: QR_PLACEHOLDER(),
    paymentName: 'Nep Tourna Payments',
    paymentId: 'neptourna@esewa',
    instructions: 'Scan the QR and complete your payment. Enter the transaction reference and upload the screenshot. Your coins are credited after admin approval.',
    depositEnabled: true,
  },
  tournament: {
    defaultRules: '1. No hacks/mods — permanent ban.\n2. Join the room 10 minutes before start.\n3. Emote-teaming is prohibited.\n4. Admin decisions are final.',
    allowRegistration: true,
    requireResultApproval: true,
    autoPrizeDistribution: false,
  },
  maintenance: { enabled: false, message: 'We are performing scheduled maintenance. Please check back soon.' },
}

function QR_PLACEHOLDER() {
  const cells = []
  let seed = 42
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const corner = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)
      let fill = rnd() > 0.55
      if (corner) {
        const cx = x > 13 ? x - 14 : x
        const cy = y > 13 ? y - 14 : y
        fill = (cx === 0 || cx === 6 || cy === 0 || cy === 6) || (cx >= 2 && cx <= 4 && cy >= 2 && cy <= 4)
      }
      if (fill) cells.push(`<rect x="${x * 10}" y="${y * 10}" width="10" height="10"/>`)
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 210"><rect width="210" height="210" fill="white"/><g fill="#0f172a">${cells.join('')}</g></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export function buildSeed() {
  const users = [
    makeUser('u_admin', 'Nep Admin', 'admin', 'admin@neptourna.local', 'Admin@12345', '+977-9800000001', 'admin', undefined, undefined, 120, 0),
    makeUser('u_p1', 'Aarav Sharma', 'aarav_ff', 'aarav@demo.local', 'Player@123', '+977-9810000001', 'player', '123456789', 'FF•AARAV', 60, 1),
    makeUser('u_p2', 'Bikash Rai', 'bikash_op', 'bikash@demo.local', 'Player@123', '+977-9810000002', 'player', '234567890', 'FF•BIKASH', 55, 2),
    makeUser('u_p3', 'Suman Thapa', 'suman_headshot', 'suman@demo.local', 'Player@123', '+977-9810000003', 'player', '345678901', 'FF•SUMAN', 50, 3),
    makeUser('u_p4', 'Priya Karki', 'priya_sniper', 'priya@demo.local', 'Player@123', '+977-9810000004', 'player', '456789012', 'FF•PRIYA', 40, 4),
    makeUser('u_p5', 'Rohan Gurung', 'rohan_rush', 'rohan@demo.local', 'Player@123', '+977-9810000005', 'player', '567890123', 'FF•ROHAN', 30, 5),
    makeUser('u_p6', 'Nisha Lama', 'nisha_pro', 'nisha@demo.local', 'Player@123', '+977-9810000006', 'player', '678901234', 'FF•NISHA', 20, 6),
  ]

  const balances = [0, 850, 620, 1400, 300, 2100, 950]
  const deposited = [0, 1000, 800, 2000, 500, 2500, 1000]
  const withdrawn = [0, 0, 180, 500, 0, 200, 0]
  const spent = [0, 150, 180, 100, 200, 200, 50]
  const wallets = users.map((u, i) => ({
    userId: u.id,
    available: u.role === 'admin' ? 0 : balances[i],
    pending: u.id === 'u_p4' ? 200 : 0,
    totalDeposited: u.role === 'admin' ? 0 : deposited[i],
    totalWithdrawn: u.role === 'admin' ? 0 : withdrawn[i],
    totalSpent: u.role === 'admin' ? 0 : spent[i],
  }))

  const rules = DEFAULT_SETTINGS.tournament.defaultRules
  const tournaments = [
    {
      id: 't_booyah', name: 'Booyah Championship S3',
      description: 'The biggest solo battle royale of the season. 50 slots, classic Bermuda map, winner takes 500 NCC. Room ID and password released 15 minutes before match start.',
      game: 'Free Fire', type: 'Solo', entryFee: 50, prizePool: 1000, maxPlayers: 50,
      date: dateStr(3), startTime: '19:00', regDeadline: day(3, 17),
      roomId: '8842135', roomPassword: 'BOOYAH50', map: 'Bermuda', mode: 'Battle Royale — Classic',
      rules, banner: '', status: 'registration_open',
      prizes: [{ rank: 1, amount: 500 }, { rank: 2, amount: 300 }, { rank: 3, amount: 200 }],
      createdAt: day(-7, 12),
    },
    {
      id: 't_squad', name: 'Squad Clash Cup',
      description: 'Squad showdown on Purgatory. Form your team, register your squad leader account, and fight for the 1500 NCC prize pool across 3 matches.',
      game: 'Free Fire', type: 'Squad', entryFee: 100, prizePool: 1500, maxPlayers: 48,
      date: dateStr(7), startTime: '18:30', regDeadline: day(7, 16),
      roomId: null, roomPassword: null, map: 'Purgatory', mode: 'Battle Royale — Ranked Rules',
      rules, banner: '', status: 'upcoming',
      prizes: [{ rank: 1, amount: 800 }, { rank: 2, amount: 450 }, { rank: 3, amount: 250 }],
      createdAt: day(-3, 12),
    },
    {
      id: 't_live', name: 'Friday Night Frags',
      description: 'Fast-paced weekly solo tournament. Low entry, quick matches, instant prizes. Currently LIVE — good luck, Booyah!',
      game: 'Free Fire', type: 'Solo', entryFee: 25, prizePool: 500, maxPlayers: 50,
      date: dateStr(0), startTime: '20:00', regDeadline: day(0, 18),
      roomId: '5512007', roomPassword: 'FRAG25', map: 'Kalahari', mode: 'Battle Royale — Classic',
      rules, banner: '', status: 'live',
      prizes: [{ rank: 1, amount: 250 }, { rank: 2, amount: 150 }, { rank: 3, amount: 100 }],
      createdAt: day(-10, 12),
    },
    {
      id: 't_done', name: 'Nep Tourna Invitational #12',
      description: 'Completed invitational tournament. Results published, prizes distributed to winners. Check the leaderboard for final standings.',
      game: 'Free Fire', type: 'Solo', entryFee: 50, prizePool: 1000, maxPlayers: 50,
      date: dateStr(-5), startTime: '19:00', regDeadline: day(-5, 17),
      roomId: '1123581', roomPassword: 'INVITE12', map: 'Bermuda', mode: 'Battle Royale — Classic',
      rules, banner: '', status: 'completed',
      prizes: [{ rank: 1, amount: 500 }, { rank: 2, amount: 300 }, { rank: 3, amount: 200 }],
      createdAt: day(-15, 12),
    },
  ]

  const registrations = [
    { id: 'r1', tournamentId: 't_booyah', userId: 'u_p1', joinedAt: day(-2, 11), status: 'joined' },
    { id: 'r2', tournamentId: 't_booyah', userId: 'u_p2', joinedAt: day(-2, 12), status: 'joined' },
    { id: 'r3', tournamentId: 't_booyah', userId: 'u_p5', joinedAt: day(-1, 9), status: 'joined' },
    { id: 'r4', tournamentId: 't_live', userId: 'u_p1', joinedAt: day(-1, 14), status: 'joined' },
    { id: 'r5', tournamentId: 't_live', userId: 'u_p3', joinedAt: day(-1, 15), status: 'joined' },
    { id: 'r6', tournamentId: 't_live', userId: 'u_p6', joinedAt: day(-1, 16), status: 'joined' },
    { id: 'r7', tournamentId: 't_done', userId: 'u_p1', joinedAt: day(-8, 10), status: 'joined' },
    { id: 'r8', tournamentId: 't_done', userId: 'u_p2', joinedAt: day(-8, 11), status: 'joined' },
    { id: 'r9', tournamentId: 't_done', userId: 'u_p3', joinedAt: day(-8, 12), status: 'joined' },
    { id: 'r10', tournamentId: 't_done', userId: 'u_p4', joinedAt: day(-7, 10), status: 'joined' },
    { id: 'r11', tournamentId: 't_done', userId: 'u_p5', joinedAt: day(-7, 11), status: 'joined' },
    { id: 'r12', tournamentId: 't_done', userId: 'u_p6', joinedAt: day(-7, 12), status: 'joined' },
  ]

  const matches = [
    { id: 'm1', tournamentId: 't_booyah', name: 'Final Match — Bermuda', date: dateStr(3), startTime: '19:00', map: 'Bermuda', mode: 'Battle Royale — Classic', roomId: '8842135', roomPassword: 'BOOYAH50', roomReleaseTime: day(3, 18, 45), status: 'scheduled' },
    { id: 'm2', tournamentId: 't_live', name: 'Match 1 — Kalahari', date: dateStr(0), startTime: '20:00', map: 'Kalahari', mode: 'Battle Royale — Classic', roomId: '5512007', roomPassword: 'FRAG25', roomReleaseTime: day(0, 19, 45), status: 'live' },
    { id: 'm3', tournamentId: 't_done', name: 'Final Match — Bermuda', date: dateStr(-5), startTime: '19:00', map: 'Bermuda', mode: 'Battle Royale — Classic', roomId: '1123581', roomPassword: 'INVITE12', roomReleaseTime: day(-5, 18, 45), status: 'completed' },
  ]

  const results = [
    {
      id: 'res1', matchId: 'm3', tournamentId: 't_done', status: 'published',
      entries: [
        { userId: 'u_p3', playerName: 'Suman Thapa', ffUid: '345678901', kills: 12, placement: 1, points: 100, bonus: 60, total: 160, prize: 500 },
        { userId: 'u_p1', playerName: 'Aarav Sharma', ffUid: '123456789', kills: 9, placement: 2, points: 80, bonus: 45, total: 125, prize: 300 },
        { userId: 'u_p6', playerName: 'Nisha Lama', ffUid: '678901234', kills: 8, placement: 3, points: 70, bonus: 40, total: 110, prize: 200 },
        { userId: 'u_p2', playerName: 'Bikash Rai', ffUid: '234567890', kills: 6, placement: 5, points: 50, bonus: 30, total: 80, prize: 0 },
        { userId: 'u_p5', playerName: 'Rohan Gurung', ffUid: '567890123', kills: 5, placement: 7, points: 40, bonus: 25, total: 65, prize: 0 },
        { userId: 'u_p4', playerName: 'Priya Karki', ffUid: '456789012', kills: 3, placement: 11, points: 20, bonus: 15, total: 35, prize: 0 },
      ],
      createdAt: day(-5, 21), submittedAt: day(-5, 21, 10), approvedAt: day(-5, 21, 30), publishedAt: day(-5, 22), prizesDistributed: true,
    },
  ]

  let txnCounter = 0
  const transactions = []
  function txn(userId, amount, type, status, createdAt, description) {
    txnCounter++
    return { id: `NCC-TXN-${String(txnCounter).padStart(6, '0')}`, userId, amount, type, status, createdAt, description }
  }
  transactions.push(
    txn('u_p1', 500, 'deposit', 'completed', day(-20, 10), 'Deposit approved — ₹500'),
    txn('u_p1', 500, 'deposit', 'completed', day(-10, 10), 'Deposit approved — ₹500'),
    txn('u_p1', 50, 'tournament_entry', 'completed', day(-8, 10), 'Entry fee — Nep Tourna Invitational #12'),
    txn('u_p1', 300, 'prize', 'completed', day(-5, 22), 'Prize — 2nd place, Nep Tourna Invitational #12'),
    txn('u_p1', 50, 'tournament_entry', 'completed', day(-2, 11), 'Entry fee — Booyah Championship S3'),
    txn('u_p1', 25, 'tournament_entry', 'completed', day(-1, 14), 'Entry fee — Friday Night Frags'),
    txn('u_p3', 2000, 'deposit', 'completed', day(-30, 10), 'Deposit approved — ₹2000'),
    txn('u_p3', 50, 'tournament_entry', 'completed', day(-8, 12), 'Entry fee — Nep Tourna Invitational #12'),
    txn('u_p3', 500, 'prize', 'completed', day(-5, 22), 'Prize — 1st place, Nep Tourna Invitational #12'),
    txn('u_p3', 500, 'withdrawal', 'completed', day(-3, 15), 'Withdrawal paid — ₹500'),
    txn('u_p3', 25, 'tournament_entry', 'completed', day(-1, 15), 'Entry fee — Friday Night Frags'),
    txn('u_p6', 1000, 'deposit', 'completed', day(-15, 10), 'Deposit approved — ₹1000'),
    txn('u_p6', 50, 'tournament_entry', 'completed', day(-7, 12), 'Entry fee — Nep Tourna Invitational #12'),
    txn('u_p6', 200, 'prize', 'completed', day(-5, 22), 'Prize — 3rd place, Nep Tourna Invitational #12'),
    txn('u_p6', 25, 'tournament_entry', 'completed', day(-1, 16), 'Entry fee — Friday Night Frags'),
    txn('u_p4', 500, 'deposit', 'completed', day(-12, 10), 'Deposit approved — ₹500'),
    txn('u_p4', 50, 'tournament_entry', 'completed', day(-7, 10), 'Entry fee — Nep Tourna Invitational #12'),
    txn('u_p4', 200, 'withdrawal', 'pending', day(-1, 9), 'Withdrawal requested — ₹200'),
    txn('u_p5', 2500, 'deposit', 'completed', day(-9, 10), 'Deposit approved — ₹2500'),
    txn('u_p5', 50, 'tournament_entry', 'completed', day(-7, 11), 'Entry fee — Nep Tourna Invitational #12'),
    txn('u_p5', 50, 'tournament_entry', 'completed', day(-1, 9), 'Entry fee — Booyah Championship S3'),
    txn('u_p5', 200, 'withdrawal', 'completed', day(-4, 12), 'Withdrawal paid — ₹200'),
    txn('u_p2', 800, 'deposit', 'completed', day(-25, 10), 'Deposit approved — ₹800'),
    txn('u_p2', 50, 'tournament_entry', 'completed', day(-8, 11), 'Entry fee — Nep Tourna Invitational #12'),
    txn('u_p2', 50, 'tournament_entry', 'completed', day(-2, 12), 'Entry fee — Booyah Championship S3'),
    txn('u_p2', 180, 'withdrawal', 'completed', day(-2, 9), 'Withdrawal paid — ₹180'),
  )

  const deposits = [
    { id: 'd1', userId: 'u_p5', amount: 500, reference: 'ESW8842199', note: 'Paid via eSewa', screenshot: null, status: 'pending', createdAt: day(-1, 8), reviewedAt: null, reviewedBy: null, rejectReason: null, txnId: null },
    { id: 'd2', userId: 'u_p2', amount: 200, reference: 'KGP7712045', note: '', screenshot: null, status: 'pending', createdAt: day(0, 7, 30), reviewedAt: null, reviewedBy: null, rejectReason: null, txnId: null },
    { id: 'd3', userId: 'u_p1', amount: 500, reference: 'ESW8810022', note: null, screenshot: null, status: 'approved', createdAt: day(-10, 10), reviewedAt: day(-10, 12), reviewedBy: 'u_admin', rejectReason: null, txnId: null },
    { id: 'd4', userId: 'u_p3', amount: 1000, reference: 'KGP5560011', note: null, screenshot: null, status: 'rejected', createdAt: day(-6, 10), reviewedAt: day(-6, 14), reviewedBy: 'u_admin', rejectReason: 'Screenshot did not match the reference number.', txnId: null },
  ]

  const withdrawals = [
    { id: 'w1', userId: 'u_p4', amount: 200, method: 'eSewa', account: '9810000004', note: 'Please pay to my eSewa', image: null, status: 'pending', createdAt: day(-1, 9), reviewedAt: null, reviewedBy: null, rejectReason: null, txnId: 'NCC-TXN-000018' },
    { id: 'w2', userId: 'u_p3', amount: 500, method: 'Khalti', account: 'suman@khalti', note: null, image: null, status: 'paid', createdAt: day(-3, 15), reviewedAt: day(-3, 16), reviewedBy: 'u_admin', rejectReason: null, txnId: 'NCC-TXN-000010' },
    { id: 'w3', userId: 'u_p5', amount: 200, method: 'eSewa', account: '9810000005', note: null, image: null, status: 'paid', createdAt: day(-4, 12), reviewedAt: day(-4, 13), reviewedBy: 'u_admin', rejectReason: null, txnId: 'NCC-TXN-000022' },
    { id: 'w4', userId: 'u_p2', amount: 180, method: 'Bank Transfer', account: '012345678901', note: null, image: null, status: 'paid', createdAt: day(-2, 9), reviewedAt: day(-2, 11), reviewedBy: 'u_admin', rejectReason: null, txnId: 'NCC-TXN-000026' },
  ]

  const announcements = [
    { id: 'a1', title: 'Booyah Championship S3 registration is OPEN!', message: '50 slots, ₹50 entry, 1000 NCC prize pool. Registration closes 3 days before the match. Deposit NCC coins now and secure your slot before it fills up!', image: null, priority: 'high', type: 'tournament', publishDate: day(-2, 12), status: 'published', createdAt: day(-2, 12) },
    { id: 'a2', title: 'Deposits now processed within 1 hour', message: 'Our payment team now approves deposits within 1 hour between 8:00–22:00 NPT. Make sure your screenshot clearly shows the transaction reference.', image: null, priority: 'normal', type: 'payment', publishDate: day(-6, 10), status: 'published', createdAt: day(-6, 10) },
    { id: 'a3', title: 'Scheduled maintenance next Monday', message: 'The platform will be offline for 2 hours next Monday at 04:00 NPT for database upgrades.', image: null, priority: 'low', type: 'maintenance', publishDate: day(2, 9), status: 'draft', createdAt: day(-1, 9) },
  ]

  const tickets = [
    {
      id: 'tk1', userId: 'u_p4', subject: 'Withdrawal not received', category: 'withdrawal', status: 'in_progress', createdAt: day(-1, 9, 30),
      messages: [
        { id: 'tm1', authorId: 'u_p4', authorRole: 'player', authorName: 'Priya Karki', message: 'I requested a ₹200 withdrawal yesterday but it is still pending. Please check.', createdAt: day(-1, 9, 30) },
        { id: 'tm2', authorId: 'u_admin', authorRole: 'admin', authorName: 'Nep Admin', message: 'Hi Priya, withdrawals are processed within 24 hours. We are verifying your eSewa account now.', createdAt: day(-1, 11) },
      ],
    },
    {
      id: 'tk2', userId: 'u_p2', subject: 'Deposit screenshot issue', category: 'deposit', status: 'resolved', createdAt: day(-6, 15),
      messages: [
        { id: 'tm3', authorId: 'u_p2', authorRole: 'player', authorName: 'Bikash Rai', message: 'My deposit was rejected but the payment was successful. Reference KGP5560011.', createdAt: day(-6, 15) },
        { id: 'tm4', authorId: 'u_admin', authorRole: 'admin', authorName: 'Nep Admin', message: 'We re-verified with the payment provider and the reference was invalid. Please re-submit with a clear screenshot.', createdAt: day(-6, 16) },
        { id: 'tm5', authorId: 'u_p2', authorRole: 'player', authorName: 'Bikash Rai', message: 'Understood, submitting a new request now. Thanks!', createdAt: day(-6, 16, 30) },
      ],
    },
  ]

  const auditLogs = [
    { id: 'al1', timestamp: day(-2, 12), actorId: 'u_admin', actorName: 'Nep Admin', action: 'Tournament Created', target: 'Booyah Championship S3', description: 'Created tournament with 50 slots, entry fee 50 NCC', category: 'tournament', ip: '127.0.0.1' },
    { id: 'al2', timestamp: day(-10, 12), actorId: 'u_admin', actorName: 'Nep Admin', action: 'Deposit Approved', target: 'Aarav Sharma', description: 'Approved deposit of 500 NCC (ref ESW8810022)', category: 'finance', ip: '127.0.0.1' },
    { id: 'al3', timestamp: day(-6, 14), actorId: 'u_admin', actorName: 'Nep Admin', action: 'Deposit Rejected', target: 'Suman Thapa', description: 'Rejected deposit of 1000 NCC — screenshot mismatch', category: 'finance', ip: '127.0.0.1' },
    { id: 'al4', timestamp: day(-5, 21, 30), actorId: 'u_admin', actorName: 'Nep Admin', action: 'Result Approved', target: 'Nep Tourna Invitational #12', description: 'Approved final match results', category: 'result', ip: '127.0.0.1' },
    { id: 'al5', timestamp: day(-5, 22), actorId: 'u_admin', actorName: 'Nep Admin', action: 'Prize Distributed', target: 'Nep Tourna Invitational #12', description: 'Distributed 1000 NCC prizes to top 3 players', category: 'finance', ip: '127.0.0.1' },
    { id: 'al6', timestamp: day(-3, 16), actorId: 'u_admin', actorName: 'Nep Admin', action: 'Withdrawal Approved', target: 'Suman Thapa', description: 'Paid withdrawal of 500 NCC via Khalti', category: 'finance', ip: '127.0.0.1' },
    { id: 'al7', timestamp: day(-2, 12), actorId: 'u_admin', actorName: 'Nep Admin', action: 'Announcement Published', target: 'Booyah Championship S3 registration is OPEN!', description: 'Published high-priority tournament announcement', category: 'content', ip: '127.0.0.1' },
  ]

  const notifications = [
    { id: 'n1', userId: 'admins', title: 'New deposit request', message: 'Rohan Gurung requested a 500 NCC deposit (ref ESW8842199).', type: 'deposit', read: false, createdAt: day(-1, 8) },
    { id: 'n2', userId: 'admins', title: 'New withdrawal request', message: 'Priya Karki requested a 200 NCC withdrawal via eSewa.', type: 'withdrawal', read: false, createdAt: day(-1, 9) },
    { id: 'n3', userId: 'admins', title: 'New support ticket', message: 'Priya Karki opened a ticket: "Withdrawal not received".', type: 'ticket', read: true, createdAt: day(-1, 9, 30) },
    { id: 'n4', userId: 'u_p4', title: 'Withdrawal under review', message: 'Your 200 NCC withdrawal request is pending admin review.', type: 'withdrawal', read: false, createdAt: day(-1, 9) },
    { id: 'n5', userId: 'u_p4', title: 'Support reply', message: 'Admin replied to your ticket "Withdrawal not received".', type: 'ticket', read: false, createdAt: day(-1, 11) },
    { id: 'n6', userId: 'u_p3', title: 'Prize received!', message: 'You won 500 NCC — 1st place in Nep Tourna Invitational #12. Booyah!', type: 'prize', read: true, createdAt: day(-5, 22) },
    { id: 'n7', userId: 'u_p1', title: 'Tournament joined', message: 'You joined Friday Night Frags. Entry fee 25 NCC deducted.', type: 'tournament', read: true, createdAt: day(-1, 14) },
  ]

  return { users, wallets, transactions, txnCounter, tournaments, registrations, matches, results, deposits, withdrawals, announcements, tickets, auditLogs, notifications, settings: DEFAULT_SETTINGS }
}
