import type { Role } from './types'

/**
 * Central role-based access control map.
 *
 * Roles:
 *  - player           → normal player, no admin panel access
 *  - admin            → super admin, full access to every admin area
 *  - coin_manager     → deposits, withdrawals and wallet management
 *  - tournament_maker → full tournament lifecycle (tournaments, matches, results, leaderboards)
 *
 * Every admin page and every privileged action is gated through canAccessArea(),
 * so hiding a nav link is never the only line of defense.
 */

export type AdminArea =
  | 'dashboard'
  | 'tournaments'
  | 'matches'
  | 'results'
  | 'leaderboards'
  | 'players'
  | 'wallet'
  | 'deposits'
  | 'withdrawals'
  | 'announcements'
  | 'tickets'
  | 'audit'
  | 'payment'
  | 'settings'
  | 'notifications'

export type StaffRole = Exclude<Role, 'player'>

export const STAFF_ROLES: StaffRole[] = ['admin', 'coin_manager', 'tournament_maker']

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  coin_manager: 'Coin Management',
  tournament_maker: 'Tournament Maker',
  player: 'Player',
}

/** Assignable roles a super admin can give a user (excludes promoting to super admin by accident). */
export const ASSIGNABLE_ROLES: Role[] = ['player', 'coin_manager', 'tournament_maker', 'admin']

export function isStaff(role: Role | undefined | null): boolean {
  return !!role && role !== 'player'
}

const AREA_ACCESS: Record<StaffRole, AdminArea[] | 'all'> = {
  admin: 'all',
  coin_manager: ['dashboard', 'deposits', 'withdrawals', 'wallet', 'notifications'],
  tournament_maker: ['dashboard', 'tournaments', 'matches', 'results', 'leaderboards', 'notifications'],
}

export function canAccessArea(role: Role | undefined | null, area: AdminArea): boolean {
  if (!isStaff(role)) return false
  const access = AREA_ACCESS[role as StaffRole]
  return access === 'all' || access.includes(area)
}

export function accessibleAreas(role: Role): AdminArea[] {
  if (!isStaff(role)) return []
  const access = AREA_ACCESS[role as StaffRole]
  if (access === 'all') {
    return [
      'dashboard', 'tournaments', 'matches', 'results', 'leaderboards', 'players',
      'wallet', 'deposits', 'withdrawals', 'announcements', 'tickets', 'audit',
      'payment', 'settings', 'notifications',
    ]
  }
  return access
}

/** Maps an /admin/* pathname to the area that guards it. */
export function areaForAdminPath(path: string): AdminArea | null {
  if (path.startsWith('/admin/tournaments')) return 'tournaments'
  if (path.startsWith('/admin/matches')) return 'matches'
  if (path.startsWith('/admin/results')) return 'results'
  if (path.startsWith('/admin/leaderboards')) return 'leaderboards'
  if (path.startsWith('/admin/players')) return 'players'
  if (path.startsWith('/admin/wallet')) return 'wallet'
  if (path.startsWith('/admin/deposits')) return 'deposits'
  if (path.startsWith('/admin/withdrawals')) return 'withdrawals'
  if (path.startsWith('/admin/announcements')) return 'announcements'
  if (path.startsWith('/admin/tickets')) return 'tickets'
  if (path.startsWith('/admin/audit')) return 'audit'
  if (path.startsWith('/admin/payment-settings')) return 'payment'
  if (path.startsWith('/admin/settings')) return 'settings'
  if (path.startsWith('/admin/notifications')) return 'notifications'
  if (path.startsWith('/admin/dashboard') || path === '/admin') return 'dashboard'
  return null
}

/** Where a staff member lands after login / when redirected home. */
export function homeRouteFor(role: Role): string {
  if (role === 'coin_manager') return '/admin/deposits'
  if (role === 'tournament_maker') return '/admin/tournaments'
  if (role === 'admin') return '/admin/dashboard'
  return '/dashboard'
}
