import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, AccessDeniedPage, SuspendedPage } from './routes/guards'
import { PlayerLayout, AdminLayout } from './layouts/Shell'
import { useCurrentUser } from './store'
import { homeRouteFor, isStaff } from './lib/permissions'

// Auth
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import AdminLogin from './pages/auth/AdminLogin'

// Player
import PDashboard from './pages/player/Dashboard'
import PTournaments from './pages/player/Tournaments'
import PTournamentDetails from './pages/player/TournamentDetails'
import PMyTournaments from './pages/player/MyTournaments'
import PWallet from './pages/player/Wallet'
import PDeposit from './pages/player/Deposit'
import PDeposits from './pages/player/Deposits'
import PWithdraw from './pages/player/Withdraw'
import PWithdrawals from './pages/player/Withdrawals'
import PLeaderboard from './pages/player/Leaderboard'
import PAnnouncements from './pages/player/Announcements'
import PNotifications from './pages/player/Notifications'
import PSupport from './pages/player/Support'
import PSupportDetail from './pages/player/SupportDetail'
import PProfile from './pages/player/Profile'
import PSettings from './pages/player/Settings'

// Admin
import ADashboard from './pages/admin/Dashboard'
import ATournaments from './pages/admin/Tournaments'
import ATournamentForm from './pages/admin/TournamentForm'
import AMatches from './pages/admin/Matches'
import AResults from './pages/admin/Results'
import AResultDetail from './pages/admin/ResultDetail'
import ALeaderboards from './pages/admin/Leaderboards'
import APlayers from './pages/admin/Players'
import APlayerDetails from './pages/admin/PlayerDetails'
import AWalletManagement from './pages/admin/WalletManagement'
import ADeposits from './pages/admin/Deposits'
import AWithdrawals from './pages/admin/Withdrawals'
import AAnnouncements from './pages/admin/Announcements'
import ATickets from './pages/admin/Tickets'
import ATicketDetail from './pages/admin/TicketDetail'
import AAuditLogs from './pages/admin/AuditLogs'
import APaymentSettings from './pages/admin/PaymentSettings'
import ASettings from './pages/admin/Settings'
import ANotifications from './pages/admin/Notifications'
import AProfile from './pages/admin/Profile'

function HomeRedirect() {
  const user = useCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homeRouteFor(user.role)} replace />
}

function AdminHome() {
  const user = useCurrentUser()
  return <Navigate to={user ? homeRouteFor(user.role) : '/admin/login'} replace />
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/access-denied" element={<AccessDeniedPage />} />
      <Route path="/suspended" element={<SuspendedPage />} />

      {/* Player */}
      <Route element={<RequireAuth role="player"><PlayerLayout /></RequireAuth>}>
        <Route path="/dashboard" element={<PDashboard />} />
        <Route path="/tournaments" element={<PTournaments />} />
        <Route path="/tournaments/:id" element={<PTournamentDetails />} />
        <Route path="/my-tournaments" element={<PMyTournaments />} />
        <Route path="/wallet" element={<PWallet />} />
        <Route path="/deposit" element={<PDeposit />} />
        <Route path="/deposits" element={<PDeposits />} />
        <Route path="/withdraw" element={<PWithdraw />} />
        <Route path="/withdrawals" element={<PWithdrawals />} />
        <Route path="/leaderboard" element={<PLeaderboard />} />
        <Route path="/announcements" element={<PAnnouncements />} />
        <Route path="/notifications" element={<PNotifications />} />
        <Route path="/support" element={<PSupport />} />
        <Route path="/support/:id" element={<PSupportDetail />} />
        <Route path="/profile" element={<PProfile />} />
        <Route path="/settings" element={<PSettings />} />
      </Route>

      {/* Admin — shell requires staff; each section is area-gated by role */}
      <Route element={<RequireAuth role="admin"><AdminLayout /></RequireAuth>}>
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/profile" element={<AProfile />} />
        <Route path="/admin/dashboard" element={<RequireAuth area="dashboard"><ADashboard /></RequireAuth>} />
        <Route path="/admin/tournaments" element={<RequireAuth area="tournaments"><ATournaments /></RequireAuth>} />
        <Route path="/admin/tournaments/new" element={<RequireAuth area="tournaments"><ATournamentForm /></RequireAuth>} />
        <Route path="/admin/tournaments/:id/edit" element={<RequireAuth area="tournaments"><ATournamentForm /></RequireAuth>} />
        <Route path="/admin/matches" element={<RequireAuth area="matches"><AMatches /></RequireAuth>} />
        <Route path="/admin/results" element={<RequireAuth area="results"><AResults /></RequireAuth>} />
        <Route path="/admin/results/:matchId" element={<RequireAuth area="results"><AResultDetail /></RequireAuth>} />
        <Route path="/admin/leaderboards" element={<RequireAuth area="leaderboards"><ALeaderboards /></RequireAuth>} />
        <Route path="/admin/players" element={<RequireAuth area="players"><APlayers /></RequireAuth>} />
        <Route path="/admin/players/:id" element={<RequireAuth area="players"><APlayerDetails /></RequireAuth>} />
        <Route path="/admin/wallet" element={<RequireAuth area="wallet"><AWalletManagement /></RequireAuth>} />
        <Route path="/admin/deposits" element={<RequireAuth area="deposits"><ADeposits /></RequireAuth>} />
        <Route path="/admin/withdrawals" element={<RequireAuth area="withdrawals"><AWithdrawals /></RequireAuth>} />
        <Route path="/admin/announcements" element={<RequireAuth area="announcements"><AAnnouncements /></RequireAuth>} />
        <Route path="/admin/tickets" element={<RequireAuth area="tickets"><ATickets /></RequireAuth>} />
        <Route path="/admin/tickets/:id" element={<RequireAuth area="tickets"><ATicketDetail /></RequireAuth>} />
        <Route path="/admin/audit-logs" element={<RequireAuth area="audit"><AAuditLogs /></RequireAuth>} />
        <Route path="/admin/payment-settings" element={<RequireAuth area="payment"><APaymentSettings /></RequireAuth>} />
        <Route path="/admin/settings" element={<RequireAuth area="settings"><ASettings /></RequireAuth>} />
        <Route path="/admin/notifications" element={<RequireAuth area="notifications"><ANotifications /></RequireAuth>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
