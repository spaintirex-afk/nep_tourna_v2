// Server-side RBAC. This is the authoritative copy — the client's permissions.ts
// is only used for UI (hiding links). Every privileged action re-checks here.

export const ROLE_LABELS = {
  admin: 'Administrator',
  coin_manager: 'Coin Management',
  tournament_maker: 'Tournament Maker',
  player: 'Player',
}

export function isStaff(role) {
  return !!role && role !== 'player'
}

const AREA_ACCESS = {
  admin: 'all',
  coin_manager: ['dashboard', 'deposits', 'withdrawals', 'wallet', 'notifications'],
  tournament_maker: ['dashboard', 'tournaments', 'matches', 'results', 'leaderboards', 'notifications'],
}

export function canAccessArea(role, area) {
  if (!isStaff(role)) return false
  const access = AREA_ACCESS[role]
  return access === 'all' || access.includes(area)
}
