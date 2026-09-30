import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentUser, useDB } from '../store'
import { logout } from '../lib/actions'
import { Avatar, StatusBadge, ConfirmDialog, useToast } from '../components/ui'
import FloatingAssistant from '../components/FloatingAssistant'
import { fmtNcc } from '../lib/format'
import { areaForAdminPath, canAccessArea, homeRouteFor, ROLE_LABELS } from '../lib/permissions'

export function Brand({ sub }: { sub?: string }) {
  return (
    <div className="sidebar-brand">
      <div className="brand-mark">NT</div>
      <div>
        <div className="brand-name">NEP<span>TOURNA</span></div>
        <div className="brand-sub">{sub ?? 'Esports Arena'}</div>
      </div>
    </div>
  )
}

interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
  badge?: number
}

function Shell({ nav, sections, foot, bottomNav, isAdmin }: {
  nav: NavItem[]
  sections?: { title: string; items: NavItem[] }[]
  foot?: React.ReactNode
  bottomNav: NavItem[]
  isAdmin: boolean
}) {
  const user = useCurrentUser()
  const db = useDB()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const loc = useLocation()
  const navigate = useNavigate()
  useEffect(() => setOpen(false), [loc.pathname])

  const wallet = db.wallets.find((w) => w.userId === user?.id)
  const notifs = db.notifications.filter(
    (n) => (isAdmin ? n.userId === 'admins' : n.userId === user?.id) && !n.read,
  ).length

  const onLogout = () => {
    setConfirmLogout(true)
  }

  const doLogout = async () => {
    await logout()
    setConfirmLogout(false)
    setOpen(false)
    toast.push('success', 'You have been logged out successfully.')
    navigate(isAdmin ? '/admin/login' : '/login', { replace: true })
  }

  const renderLinks = (items: NavItem[]) =>
    items.map((it) => (
      <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        <span className="ico">{it.icon}</span>
        {it.label}
        {it.to.includes('notifications') && notifs > 0 && <span className="pill">{notifs}</span>}
      </NavLink>
    ))

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Brand sub={isAdmin ? 'Admin Panel' : 'Esports Arena'} />
        <nav className="sidebar-nav">
          {renderLinks(nav)}
          {sections?.map((s) => (
            <React.Fragment key={s.title}>
              <div className="nav-section">{s.title}</div>
              {renderLinks(s.items)}
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-foot">
          {foot}
          {user && (
            <div className="row" style={{ gap: 10 }}>
              <Avatar name={user.fullName} color={user.avatarColor} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="truncate" style={{ color: '#fff', fontWeight: 700, fontSize: 13.5 }}>{user.fullName}</div>
                <div className="truncate" style={{ fontSize: 11.5, color: '#7d8db5' }}>@{user.username}</div>
              </div>
              <button className="btn btn-sm btn-danger" onClick={onLogout} title="Logout">⏻</button>
            </div>
          )}
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button className="burger" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <div className="page-title hide-sm">{db.settings.general.appName}</div>
          <div className="spacer" />
          {!isAdmin && wallet && (
            <NavLink to="/wallet" className="coin-chip" title="NCC Coin balance">
              <span className="coin-ico">₵</span>
              <span className="full-val">{fmtNcc(wallet.available, db.settings.wallet.coinSymbol)}</span>
            </NavLink>
          )}
          <NavLink to={isAdmin ? '/admin/notifications' : '/notifications'} className="btn-icon" title="Notifications">
            🔔{notifs > 0 && <span className="dot" />}
          </NavLink>
          {user && (
            <NavLink
              to={!isAdmin ? '/profile' : '/admin/profile'}
              title={user.fullName}
            >
              <Avatar name={user.fullName} color={user.avatarColor} />
            </NavLink>
          )}
          <span className={`badge ${user?.role === 'admin' ? 'badge-red' : isAdmin ? 'badge-violet' : 'badge-blue'}`} style={{ textTransform: 'uppercase' }}>
            {user ? ROLE_LABELS[user.role] : isAdmin ? 'Admin' : 'Player'}
          </span>
        </header>

        <Outlet />

        <div className="bottom-nav">
          {bottomNav.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ico">{it.icon}</span>
              {it.label}
            </NavLink>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={doLogout}
        danger
        title="Log out?"
        confirmLabel="Log Out"
        message={<p>You will be signed out of your {isAdmin ? 'admin' : 'player'} account and redirected to the login page.</p>}
      />
    </div>
  )
}

export function PlayerLayout() {
  const db = useDB()
  const openTickets = 0
  const nav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: '🏠', end: true },
    { to: '/tournaments', label: 'Tournaments', icon: '🏆' },
    { to: '/my-tournaments', label: 'My Tournaments', icon: '🎯' },
    { to: '/leaderboard', label: 'Leaderboard', icon: '📊' },
    { to: '/announcements', label: 'Announcements', icon: '📢' },
  ]
  const walletNav: NavItem[] = [
    { to: '/wallet', label: 'Wallet', icon: '👛' },
    { to: '/deposits', label: 'Deposits', icon: '⬇️' },
    { to: '/withdrawals', label: 'Withdrawals', icon: '⬆️' },
  ]
  const accountNav: NavItem[] = [
    { to: '/notifications', label: 'Notifications', icon: '🔔' },
    { to: '/support', label: 'Support', icon: '🎧', badge: openTickets },
    { to: '/profile', label: 'Profile', icon: '👤' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
  ]
  void db
  return (
    <>
      <Shell
        nav={nav}
        sections={[
          { title: 'Wallet', items: walletNav },
          { title: 'Account', items: accountNav },
        ]}
        bottomNav={[
          { to: '/dashboard', label: 'Home', icon: '🏠', end: true },
          { to: '/tournaments', label: 'Events', icon: '🏆' },
          { to: '/wallet', label: 'Wallet', icon: '👛' },
          { to: '/leaderboard', label: 'Ranks', icon: '📊' },
          { to: '/profile', label: 'Profile', icon: '👤' },
        ]}
        isAdmin={false}
      />
      <FloatingAssistant />
    </>
  )
}

export function AdminLayout() {
  const db = useDB()
  const me = useCurrentUser()
  const role = me?.role ?? 'admin'
  const allow = (path: string) => {
    const area = areaForAdminPath(path)
    return area ? canAccessArea(role, area) : true
  }
  const filterNav = (items: NavItem[]) => items.filter((it) => allow(it.to))

  const pendingDep = db.deposits.filter((d) => d.status === 'pending').length
  const pendingWd = db.withdrawals.filter((w) => w.status === 'pending').length
  const openTk = db.tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length
  const nav: NavItem[] = [{ to: '/admin/dashboard', label: 'Dashboard', icon: '📈', end: true }]
  const manage: NavItem[] = [
    { to: '/admin/tournaments', label: 'Tournaments', icon: '🏆' },
    { to: '/admin/matches', label: 'Matches', icon: '🎮' },
    { to: '/admin/results', label: 'Results', icon: '🏅' },
    { to: '/admin/leaderboards', label: 'Leaderboards', icon: '📊' },
    { to: '/admin/players', label: 'Players', icon: '👥' },
  ]
  const finance: NavItem[] = [
    { to: '/admin/wallet', label: 'NCC Wallet', icon: '👛' },
    { to: '/admin/deposits', label: 'Deposits', icon: '⬇️', badge: pendingDep },
    { to: '/admin/withdrawals', label: 'Withdrawals', icon: '⬆️', badge: pendingWd },
  ]
  const content: NavItem[] = [
    { to: '/admin/announcements', label: 'Announcements', icon: '📢' },
    { to: '/admin/tickets', label: 'Support Tickets', icon: '🎧', badge: openTk },
  ]
  const system: NavItem[] = [
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: '📜' },
    { to: '/admin/payment-settings', label: 'Payment Settings', icon: '💳' },
    { to: '/admin/settings', label: 'App Settings', icon: '⚙️' },
  ]

  const sections = [
    { title: 'Manage', items: filterNav(manage) },
    { title: 'Finance', items: filterNav(finance) },
    { title: 'Content', items: filterNav(content) },
    { title: 'System', items: filterNav(system) },
  ].filter((s) => s.items.length > 0)

  const bottomNav = filterNav([
    { to: '/admin/dashboard', label: 'Home', icon: '📈', end: true },
    { to: '/admin/tournaments', label: 'Events', icon: '🏆' },
    { to: '/admin/deposits', label: 'Finance', icon: '💰' },
    { to: '/admin/players', label: 'Players', icon: '👥' },
    { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
  ])

  return (
    <Shell
      nav={nav}
      sections={sections}
      bottomNav={bottomNav.length > 0 ? bottomNav : [{ to: homeRouteFor(role), label: 'Home', icon: '📈', end: true }]}
      isAdmin={true}
    />
  )
}

export function AdminNotificationsPagePlaceholder() {
  return null
}

export { StatusBadge }
