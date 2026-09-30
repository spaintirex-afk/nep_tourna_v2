import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../lib/actions'
import { useCurrentUser } from '../store'
import { ConfirmDialog, useToast } from './ui'

/**
 * Logout button with a confirmation step. Clears the session, shows a toast and
 * redirects to the correct login page for the current role (staff → /admin/login,
 * player → /login).
 */
export default function LogoutButton({
  className = 'btn btn-danger',
  label = '⏻ Log out',
}: {
  className?: string
  label?: string
}) {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const staff = !!user && user.role !== 'player'

  const doLogout = async () => {
    await logout()
    setOpen(false)
    toast.push('success', 'You have been logged out successfully.')
    navigate(staff ? '/admin/login' : '/login', { replace: true })
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={doLogout}
        danger
        title="Log out?"
        confirmLabel="Log Out"
        message={<p>You will be signed out of your {staff ? 'admin' : 'player'} account and redirected to the login page.</p>}
      />
    </>
  )
}
