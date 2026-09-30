import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser, useDB } from '../../store'
import { Avatar, Card, ConfirmDialog, EmptyState, Field, Modal, Pagination, StatusBadge, usePagination, useToast } from '../../components/ui'
import { setPlayerStatus, setUserRole } from '../../lib/actions'
import { fmtDate, fmtNcc } from '../../lib/format'
import type { Role, User } from '../../lib/types'
import { ASSIGNABLE_ROLES, ROLE_LABELS, isStaff } from '../../lib/permissions'

type RoleFilter = 'player' | 'staff' | 'all'

export default function Players() {
  const db = useDB()
  const me = useCurrentUser()
  const toast = useToast()
  const isSuperAdmin = me?.role === 'admin'

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('player')
  const [target, setTarget] = useState<User | null>(null)

  // Role change state
  const [roleTarget, setRoleTarget] = useState<User | null>(null)
  const [newRole, setNewRole] = useState<Role>('player')
  const [confirmRole, setConfirmRole] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return db.users.filter((u) => {
      if (roleFilter === 'player' && u.role !== 'player') return false
      if (roleFilter === 'staff' && u.role === 'player') return false
      if (status && u.status !== status) return false
      if (!q) return true
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.ffUid ?? '').toLowerCase().includes(q)
      )
    })
  }, [db.users, search, status, roleFilter])

  const { page, pages, slice, setPage } = usePagination(filtered, 10)

  const joinedCount = (uid: string) => db.registrations.filter((r) => r.userId === uid && r.status === 'joined').length
  const walletOf = (uid: string) => db.wallets.find((w) => w.userId === uid)

  const toggleStatus = async () => {
    if (!target || !me) return
    const next = target.status === 'active' ? 'suspended' : 'active'
    try {
      const r = await setPlayerStatus(me.id, target.id, next)
      if (r.ok) toast.push('success', next === 'suspended' ? `${target.fullName} suspended.` : `${target.fullName} reactivated.`)
      else toast.push('error', r.error)
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Action failed.')
    }
    setTarget(null)
  }

  const openRole = (u: User) => {
    setRoleTarget(u)
    setNewRole(u.role)
    setConfirmRole(false)
  }

  const submitRole = async () => {
    if (!roleTarget || !me) return
    try {
      const r = await setUserRole(me.id, roleTarget.id, newRole)
      if (r.ok) toast.push('success', `${roleTarget.fullName} is now ${ROLE_LABELS[newRole]}.`)
      else toast.push('error', r.error)
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Action failed.')
    }
    setRoleTarget(null)
    setConfirmRole(false)
  }

  const playerCount = db.users.filter((u) => u.role === 'player').length
  const staffCount = db.users.filter((u) => isStaff(u.role)).length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>People & Roles</h1>
          <div className="sub">{playerCount} players · {staffCount} staff members</div>
        </div>
      </div>

      <div className="filters">
        <div className="search-input">
          <input className="input" placeholder="Search name, username, email or FF UID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as RoleFilter); setPage(1) }}>
          <option value="player">Players only</option>
          <option value="staff">Staff only</option>
          <option value="all">Everyone</option>
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon="👥" title="No users found" message="Try a different search or filter." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table cards-mobile">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Balance</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((u) => {
                    const w = walletOf(u.id)
                    return (
                      <tr key={u.id}>
                        <td data-label="ID" className="mono muted">{u.id.slice(0, 8)}</td>
                        <td data-label="Name" className="span2">
                          <span className="row" style={{ gap: 8 }}>
                            <Avatar name={u.fullName} color={u.avatarColor} size="avatar-sm" />
                            <span className="strong truncate" style={{ maxWidth: 150 }}>{u.fullName}</span>
                          </span>
                        </td>
                        <td data-label="Username">@{u.username}</td>
                        <td data-label="Email" className="truncate" style={{ maxWidth: 180 }}>{u.email}</td>
                        <td data-label="Role"><StatusBadge status={u.role} label={ROLE_LABELS[u.role]} /></td>
                        <td data-label="Balance">
                          <span className="strong">{fmtNcc(w?.available ?? 0)}</span>
                          {(w?.pending ?? 0) > 0 && <span className="text-amber small"> +{fmtNcc(w!.pending)} pending</span>}
                        </td>
                        <td data-label="Joined">{joinedCount(u.id)}</td>
                        <td data-label="Status"><StatusBadge status={u.status} /></td>
                        <td data-label="Registered">{fmtDate(u.createdAt)}</td>
                        <td data-label="Actions" className="span2">
                          <span className="row wrap" style={{ gap: 6 }}>
                            {u.role === 'player' && (
                              <Link to={`/admin/players/${u.id}`} className="btn btn-sm btn-outline">View</Link>
                            )}
                            {isSuperAdmin && u.id !== me?.id && (
                              <button className="btn btn-sm btn-blue" onClick={() => openRole(u)}>Role</button>
                            )}
                            {u.role === 'player' && (
                              <button
                                className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                                onClick={() => setTarget(u)}
                              >
                                {u.status === 'active' ? 'Suspend' : 'Activate'}
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onChange={setPage} />
          </>
        )}
      </Card>

      {/* Suspend / activate */}
      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={toggleStatus}
        title={target?.status === 'active' ? 'Suspend player?' : 'Activate player?'}
        danger={target?.status === 'active'}
        confirmLabel={target?.status === 'active' ? 'Suspend' : 'Activate'}
        message={
          target ? (
            <div>
              {target.status === 'active' ? (
                <p>Suspend <b>{target.fullName}</b> (@{target.username})? They will not be able to log in or join tournaments until reactivated.</p>
              ) : (
                <p>Reactivate <b>{target.fullName}</b> (@{target.username})? They will regain full access immediately.</p>
              )}
            </div>
          ) : ''
        }
      />

      {/* Change role */}
      <Modal
        open={roleTarget !== null && !confirmRole}
        onClose={() => setRoleTarget(null)}
        title={`Change role — ${roleTarget?.fullName ?? ''}`}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setRoleTarget(null)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (roleTarget && newRole === roleTarget.role) { toast.push('info', 'That is already their role.'); return }
                setConfirmRole(true)
              }}
            >
              Review
            </button>
          </>
        }
      >
        {roleTarget && (
          <>
            <div className="alert alert-info small">
              Current role: <b>{ROLE_LABELS[roleTarget.role]}</b>. Staff sign in through the <b>admin login</b> page with their usual email and password.
            </div>
            <Field label="New Role" hint="Coin Management → deposits, withdrawals & wallet. Tournament Maker → tournaments, matches, results & leaderboards.">
              <select className="select" value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </Field>
            <div className="small muted" style={{ marginTop: 10 }}>
              {newRole === 'player' && 'They will lose all admin-panel access and return to a standard player account.'}
              {newRole === 'coin_manager' && 'They will be able to approve/reject deposits and withdrawals and adjust player coin balances.'}
              {newRole === 'tournament_maker' && 'They will be able to create and edit tournaments, matches, results and leaderboards.'}
              {newRole === 'admin' && '⚠ Full super-admin access to every section, settings and financial controls.'}
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmRole && roleTarget !== null}
        onClose={() => setConfirmRole(false)}
        onConfirm={submitRole}
        danger={newRole === 'admin'}
        title="Confirm role change"
        confirmLabel={`Set ${ROLE_LABELS[newRole]}`}
        message={
          roleTarget ? (
            <p>
              Change <b>{roleTarget.fullName}</b> (@{roleTarget.username}) from <b>{ROLE_LABELS[roleTarget.role]}</b> to{' '}
              <b>{ROLE_LABELS[newRole]}</b>? This takes effect immediately and is recorded in the audit log.
            </p>
          ) : ''
        }
      />
    </div>
  )
}
