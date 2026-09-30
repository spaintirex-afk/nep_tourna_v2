import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCurrentUser, useDB, useWallet } from '../../store'
import { requestWithdrawal } from '../../lib/actions'
import { readFileAsDataURL, fmtNcc, fmtRupees } from '../../lib/format'
import { Card, CardHead, ConfirmDialog, Field, useToast } from '../../components/ui'

const METHODS = ['eSewa', 'Khalti', 'Bank Transfer', 'Other']

export default function Withdraw() {
  const db = useDB()
  const user = useCurrentUser()
  const wallet = useWallet(user?.id)
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const s = db.settings.wallet
  const available = wallet?.available ?? 0

  const [amount, setAmount] = useState<number | ''>('')
  const [method, setMethod] = useState(METHODS[0])
  const [account, setAccount] = useState('')
  const [note, setNote] = useState('')
  const [image, setImage] = useState<string | undefined>(undefined)
  const [errors, setErrors] = useState<{ amount?: string; account?: string }>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const amtNum = Number(amount) || 0
  const remaining = available - amtNum

  const validate = (): boolean => {
    const errs: { amount?: string; account?: string } = {}
    const amt = Number(amount)
    if (amount === '' || !Number.isFinite(amt) || amt <= 0) {
      errs.amount = 'Please enter a valid amount.'
    } else if (amt < s.minWithdraw) {
      errs.amount = `Minimum withdrawal is ${fmtNcc(s.minWithdraw, s.coinSymbol)}.`
    } else if (amt > s.maxWithdraw) {
      errs.amount = `Maximum withdrawal is ${fmtNcc(s.maxWithdraw, s.coinSymbol)}.`
    } else if (amt > available) {
      errs.amount = `Insufficient balance — you can withdraw up to ${fmtNcc(available, s.coinSymbol)}.`
    }
    if (!account.trim() && !image) errs.account = 'Add your payment QR image OR enter your account / payment number.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (validate()) setConfirmOpen(true)
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.push('error', 'Please choose an image file (PNG/JPG).')
      return
    }
    try {
      setImage(await readFileAsDataURL(f))
      toast.push('success', 'Image attached.')
    } catch {
      toast.push('error', 'Could not read that file. Please try another image.')
    }
  }

  const doSubmit = async () => {
    if (!user) return
    setBusy(true)
    const res = await requestWithdrawal(user.id, Number(amount), method, account, note, image)
    setBusy(false)
    setConfirmOpen(false)
    if (res.ok) {
      toast.push('success', 'Withdrawal requested — the amount is reserved until an admin processes it.')
      navigate('/withdrawals')
    } else {
      toast.push('error', res.error)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Withdraw {s.coinSymbol}</h1>
          <div className="sub">Cash out your coins — 1 {s.coinSymbol} = {fmtRupees(s.rate)}</div>
        </div>
        <Link to="/withdrawals" className="btn btn-outline">📜 Withdrawal history</Link>
      </div>

      <div className="grid-2">
        <Card>
          <CardHead title="Withdrawal Request" sub={`Limits: ${fmtNcc(s.minWithdraw, s.coinSymbol)} – ${fmtNcc(s.maxWithdraw, s.coinSymbol)}`} />
          <div className="card-pad">
            <form onSubmit={onSubmit}>
              <Field label="Amount (NCC)" required error={errors.amount}>
                <input
                  type="number"
                  min={s.minWithdraw}
                  max={s.maxWithdraw}
                  className={`input ${errors.amount ? 'invalid' : ''}`}
                  placeholder={`Amount (${s.minWithdraw}–${s.maxWithdraw})`}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value === '' ? '' : Number(e.target.value))
                    setErrors((x) => ({ ...x, amount: undefined }))
                  }}
                />
                {amount !== '' && !errors.amount && (
                  <div className="hint">You will receive ≈ {fmtRupees(amtNum * s.rate)}</div>
                )}
              </Field>

              <Field label="Method" required>
                <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>

              <Field
                label="Account / Payment Number"
                error={errors.account}
                hint={method === 'Bank Transfer' ? 'Bank name, account number and account holder — required if you don’t upload a QR.' : `Your ${method} ID / phone number — required if you don’t upload a QR.`}
              >
                <input
                  className={`input ${errors.account ? 'invalid' : ''}`}
                  placeholder={method === 'Bank Transfer' ? 'e.g. Nabil Bank · 1234567890' : 'e.g. 98XXXXXXXX'}
                  value={account}
                  onChange={(e) => {
                    setAccount(e.target.value)
                    setErrors((x) => ({ ...x, account: undefined }))
                  }}
                />
              </Field>

              <Field label="Note (optional)">
                <input
                  className="input"
                  placeholder="Anything the admin should know"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>

              <Field label="Your Payment QR (image)" error={!account.trim() && !image ? errors.account : undefined} hint="Upload your eSewa / Khalti / bank QR so the admin can scan and pay you. Required if you don’t enter a number above.">
                <input ref={fileRef} type="file" accept="image/*" className={`input ${!account.trim() && !image && errors.account ? 'invalid' : ''}`} onChange={onFile} />
                {image && (
                  <div className="row mt8">
                    <img src={image} alt="Your payment QR preview" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                    <button type="button" className="btn btn-sm btn-ghost text-red" onClick={() => { setImage(undefined); if (fileRef.current) fileRef.current.value = '' }}>
                      ✕ Remove
                    </button>
                  </div>
                )}
              </Field>

              <button type="submit" className="btn btn-primary btn-lg btn-block mt8" disabled={busy}>
                Request Withdrawal
              </button>
            </form>
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <Card>
            <CardHead title="Summary" sub="Updates as you type" />
            <div className="card-pad">
              <dl className="kv">
                <dt>Available Balance</dt>
                <dd>{fmtNcc(available, s.coinSymbol)}</dd>
                <dt>Requested Amount</dt>
                <dd className={amtNum > 0 ? 'text-red' : ''}>−{fmtNcc(amtNum, s.coinSymbol)}</dd>
                <dt>Remaining Balance</dt>
                <dd className={remaining < 0 ? 'text-red' : 'text-green'}>{fmtNcc(remaining, s.coinSymbol)}</dd>
              </dl>
              <div className="divider" />
              <dl className="kv">
                <dt>Method</dt>
                <dd>{method}</dd>
                <dt>Payout to</dt>
                <dd className="mono">{account || (image ? 'QR image attached ✓' : '—')}</dd>
                <dt>You receive</dt>
                <dd className="text-green">{fmtRupees(amtNum * s.rate)}</dd>
              </dl>
            </div>
          </Card>

          <Card className="card-pad">
            <div className="alert alert-info small" style={{ marginBottom: 0 }}>
              ℹ️ The requested amount is <b>reserved immediately</b> (moved from available to pending)
              so it cannot be double-spent. Once an admin approves and pays it, the reserved coins are
              deducted permanently. If your request is <b>rejected</b>, the coins are returned to your
              available balance automatically.
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doSubmit}
        busy={busy}
        danger
        title="Confirm Withdrawal Request"
        confirmLabel="Request Withdrawal"
        message={
          <div>
            <dl className="kv">
              <dt>Amount</dt>
              <dd>{fmtNcc(amtNum, s.coinSymbol)} (≈ {fmtRupees(amtNum * s.rate)})</dd>
              <dt>Method</dt>
              <dd>{method}</dd>
              <dt>Payout to</dt>
              <dd className="mono">{account || '—'}</dd>
              <dt>QR image</dt>
              <dd>{image ? 'Attached ✓' : 'None'}</dd>
              <dt>Remaining Balance</dt>
              <dd>{fmtNcc(remaining, s.coinSymbol)}</dd>
            </dl>
            <p className="small muted mt16">
              This amount will be reserved until an admin processes the payout. Double-check your
              account details — payments to wrong IDs cannot be reversed.
            </p>
          </div>
        }
      />
    </div>
  )
}
