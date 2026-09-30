// Core domain types for Nep Tourna.

export type Role = 'player' | 'admin' | 'coin_manager' | 'tournament_maker'
export type UserStatus = 'active' | 'suspended'

export interface User {
  id: string
  fullName: string
  username: string
  email: string
  /** Never sent by the server — auth is handled server-side via session cookie. */
  passwordHash?: string
  phone: string
  ffUid?: string
  ffIgn?: string
  role: Role
  status: UserStatus
  createdAt: string
  avatarColor: string
}

export interface Wallet {
  userId: string
  /** Spendable balance */
  available: number
  /** Reserved by pending withdrawals */
  pending: number
  totalDeposited: number
  totalWithdrawn: number
  totalSpent: number
}

export type TxnType =
  | 'deposit'
  | 'withdrawal'
  | 'tournament_entry'
  | 'prize'
  | 'refund'
  | 'adjustment'

export type TxnStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled'

export interface Transaction {
  id: string // NCC-TXN-000001
  userId: string
  amount: number
  type: TxnType
  status: TxnStatus
  createdAt: string
  description: string
}

export type TournamentStatus =
  | 'upcoming'
  | 'registration_open'
  | 'registration_closed'
  | 'live'
  | 'completed'
  | 'cancelled'

export interface PrizeSlot {
  rank: number
  amount: number
}

export interface Tournament {
  id: string
  name: string
  description: string
  game: string
  type: string // Solo / Duo / Squad / Clash Squad
  entryFee: number
  prizePool: number
  maxPlayers: number
  date: string // yyyy-mm-dd
  startTime: string // HH:mm
  regDeadline: string // ISO datetime
  roomId?: string
  roomPassword?: string
  map?: string
  mode?: string
  rules?: string
  banner?: string // data URL or empty
  status: TournamentStatus
  prizes: PrizeSlot[]
  createdAt: string
}

export interface Registration {
  id: string
  tournamentId: string
  userId: string
  joinedAt: string
  status: 'joined' | 'cancelled'
}

export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'cancelled'

export interface Match {
  id: string
  tournamentId: string
  name: string
  date: string
  startTime: string
  map: string
  mode: string
  roomId: string
  roomPassword: string
  /** Room info hidden from players until this time (ISO). Empty = visible now. */
  roomReleaseTime: string
  status: MatchStatus
}

export type ResultStatus = 'draft' | 'submitted' | 'approved' | 'published'

export interface ResultEntry {
  userId: string
  playerName: string
  ffUid: string
  kills: number
  placement: number
  points: number // placement points
  bonus: number
  total: number // points + bonus
  prize: number
}

export interface MatchResult {
  id: string
  matchId: string
  tournamentId: string
  status: ResultStatus
  entries: ResultEntry[]
  createdAt: string
  submittedAt?: string
  approvedAt?: string
  publishedAt?: string
  prizesDistributed: boolean
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface Deposit {
  id: string
  userId: string
  amount: number
  reference: string
  note?: string
  screenshot?: string // data URL
  status: ReviewStatus
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
  rejectReason?: string
  txnId?: string
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid'

export interface Withdrawal {
  id: string
  userId: string
  amount: number
  method: string
  account: string
  note?: string
  image?: string // data URL
  status: WithdrawalStatus
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
  rejectReason?: string
  txnId?: string
}

export type AnnouncementType = 'general' | 'tournament' | 'maintenance' | 'payment' | 'important'
export type AnnouncementStatus = 'draft' | 'published' | 'unpublished'
export type Priority = 'low' | 'normal' | 'high'

export interface Announcement {
  id: string
  title: string
  message: string
  image?: string
  priority: Priority
  type: AnnouncementType
  publishDate: string
  status: AnnouncementStatus
  createdAt: string
}

export type TicketCategory = 'deposit' | 'withdrawal' | 'tournament' | 'account' | 'technical' | 'other'
export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'

export interface TicketMessage {
  id: string
  authorId: string
  authorRole: Role
  authorName: string
  message: string
  attachment?: string
  createdAt: string
}

export interface Ticket {
  id: string
  userId: string
  subject: string
  category: TicketCategory
  status: TicketStatus
  messages: TicketMessage[]
  createdAt: string
}

export interface AuditLog {
  id: string
  timestamp: string
  actorId: string
  actorName: string
  action: string
  target: string
  description: string
  category: 'auth' | 'tournament' | 'player' | 'finance' | 'result' | 'content' | 'settings'
  ip?: string
}

export interface AppNotification {
  id: string
  /** user id, or 'admins' for admin inbox */
  userId: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

export interface Settings {
  general: {
    appName: string
    appDescription: string
    supportEmail: string
    contact: string
    logo?: string
  }
  social: {
    facebook: string
    instagram: string
    youtube: string
    discord: string
    twitter: string
    tiktok: string
  }
  wallet: {
    coinName: string
    coinSymbol: string
    rate: number // rupees per coin
    minDeposit: number
    maxDeposit: number
    minWithdraw: number
    maxWithdraw: number
  }
  payment: {
    qrImage?: string
    paymentName: string
    paymentId: string
    instructions: string
    depositEnabled: boolean
  }
  tournament: {
    defaultRules: string
    allowRegistration: boolean
    requireResultApproval: boolean
    autoPrizeDistribution: boolean
  }
  maintenance: {
    enabled: boolean
    message: string
  }
}

export interface DB {
  version: number
  users: User[]
  wallets: Wallet[]
  transactions: Transaction[]
  txnCounter: number
  tournaments: Tournament[]
  registrations: Registration[]
  matches: Match[]
  results: MatchResult[]
  deposits: Deposit[]
  withdrawals: Withdrawal[]
  announcements: Announcement[]
  tickets: Ticket[]
  auditLogs: AuditLog[]
  notifications: AppNotification[]
  settings: Settings
}

export interface Session {
  userId: string
  loginAt: string
}
