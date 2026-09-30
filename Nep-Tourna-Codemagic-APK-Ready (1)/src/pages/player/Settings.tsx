import { Link } from 'react-router-dom'
import { useDB } from '../../store'
import { fmtNcc, fmtRupees } from '../../lib/format'
import { Card, CardHead } from '../../components/ui'

export default function Settings() {
  const db = useDB()
  const g = db.settings.general
  const s = db.settings.wallet
  const pay = db.settings.payment
  const mt = db.settings.maintenance

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <h1>App Settings</h1>
          <div className="sub">Platform information and wallet configuration (read-only)</div>
        </div>
        <Link to="/profile" className="btn btn-outline">👤 Edit my profile</Link>
      </div>

      {mt.enabled && (
        <div className="alert alert-warn">
          🛠️ <b>Maintenance mode is enabled.</b> {mt.message || 'Some features may be temporarily unavailable.'}
        </div>
      )}

      <Card className="mb24">
        <CardHead title="About the Platform" />
        <div className="card-pad">
          <dl className="kv">
            <dt>App Name</dt>
            <dd>{g.appName}</dd>
            <dt>Description</dt>
            <dd style={{ textAlign: 'right', maxWidth: 420 }}>{g.appDescription}</dd>
            <dt>Support Email</dt>
            <dd className="mono">{g.supportEmail}</dd>
            <dt>Contact</dt>
            <dd>{g.contact}</dd>
          </dl>
        </div>
      </Card>

      <Card className="mb24">
        <CardHead title="Wallet Configuration" sub={`${s.coinName} (${s.coinSymbol})`} />
        <div className="card-pad">
          <dl className="kv">
            <dt>Coin Name</dt>
            <dd>{s.coinName}</dd>
            <dt>Coin Symbol</dt>
            <dd className="mono">{s.coinSymbol}</dd>
            <dt>Exchange Rate</dt>
            <dd>1 {s.coinSymbol} = {fmtRupees(s.rate)}</dd>
            <dt>Min / Max Deposit</dt>
            <dd>{fmtNcc(s.minDeposit, s.coinSymbol)} – {fmtNcc(s.maxDeposit, s.coinSymbol)}</dd>
            <dt>Min / Max Withdrawal</dt>
            <dd>{fmtNcc(s.minWithdraw, s.coinSymbol)} – {fmtNcc(s.maxWithdraw, s.coinSymbol)}</dd>
          </dl>
        </div>
      </Card>

      <Card className="mb24">
        <CardHead title="Payment Methods" />
        <div className="card-pad">
          <dl className="kv">
            <dt>Deposits</dt>
            <dd>{pay.depositEnabled ? <span className="text-green strong">Enabled</span> : <span className="text-red strong">Disabled</span>}</dd>
            <dt>Payment Name</dt>
            <dd>{pay.paymentName}</dd>
            <dt>Payment ID</dt>
            <dd className="mono">{pay.paymentId}</dd>
          </dl>
          {pay.instructions && (
            <>
              <div className="divider" />
              <div className="small" style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>
                {pay.instructions}
              </div>
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHead title="Account" sub="Your personal details are managed on the profile page" />
        <div className="card-pad">
          <div className="row between wrap" style={{ gap: 10 }}>
            <span className="small muted">
              Change your name, phone, Free Fire details or password from your profile.
            </span>
            <Link to="/profile" className="btn btn-sm btn-primary">Go to profile →</Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
