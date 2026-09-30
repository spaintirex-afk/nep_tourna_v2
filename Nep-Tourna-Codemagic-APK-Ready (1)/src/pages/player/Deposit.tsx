import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCurrentUser, useDB } from '../../store'
import { requestDeposit } from '../../lib/actions'
import { readFileAsDataURL, fmtNcc, fmtRupees } from '../../lib/format'
import { Card, CardHead, ConfirmDialog, Field, useToast } from '../../components/ui'

const PRESETS = [50, 100, 500, 1000]

export default function Deposit() {
  const db = useDB()
  const user = useCurrentUser()
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const s = db.settings.wallet
  const pay = db.settings.payment

  const [amount, setAmount] = useState<number | ''>('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [screenshot, setScreenshot] = useState<string | undefined>(undefined)
  const [errors, setErrors] = useState<{ amount?: string; reference?: string }>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const validate = (): boolean => {
    const errs: { amount?: string; reference?: string } = {}
    const amt = Number(amount)
    if (amount === '' || !Number.isFinite(amt) || amt <= 0) {
      errs.amount = 'Please enter a valid amount.'
    } else if (amt < s.minDeposit) {
      errs.amount = `Minimum deposit is ${fmtNcc(s.minDeposit, s.coinSymbol)}.`
    } else if (amt > s.maxDeposit) {
      errs.amount = `Maximum deposit is ${fmtNcc(s.maxDeposit, s.coinSymbol)}.`
    }
    if (!reference.trim()) errs.reference = 'Payment reference / transaction ID is required.'
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
      const data = await readFileAsDataURL(f)
      setScreenshot(data)
      toast.push('success', 'Screenshot attached.')
    } catch {
      toast.push('error', 'Could not read that file. Please try another image.')
    }
  }

  const doSubmit = async () => {
    if (!user) return
    setBusy(true)
    const res = await requestDeposit(user.id, Number(amount), reference, note, screenshot)
    setBusy(false)
    setConfirmOpen(false)
    if (res.ok) {
      toast.push('success', 'Deposit request submitted — pending admin approval.')
      navigate('/deposits')
    } else {
      toast.push('error', res.error)
    }
  }

  const amtNum = Number(amount) || 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>NCC Coin Deposit — 1 {s.coinSymbol} = {fmtRupees(s.rate)}</h1>
          <div className="sub">Send payment, submit the reference, and coins land after admin approval</div>
        </div>
        <Link to="/deposits" className="btn btn-outline">📜 Deposit history</Link>
      </div>

      {!pay.depositEnabled && (
        <div className="alert alert-warn">
          ⚠️ Deposits are currently disabled by the platform. You can still browse — payments will
          reopen soon. Check announcements for updates.
        </div>
      )}

      <div className="grid-2">
        <Card>
          <CardHead title="Deposit Request" sub={`Limits: ${fmtNcc(s.minDeposit, s.coinSymbol)} – ${fmtNcc(s.maxDeposit, s.coinSymbol)}`} />
          <div className="card-pad">
            <form onSubmit={onSubmit}>
              <Field label="Amount (NCC)" required error={errors.amount}>
                <div className="amount-grid mb8">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`amount-btn ${amount === p ? 'selected' : ''}`}
                      onClick={() => {
                        setAmount(p)
                        setErrors((x) => ({ ...x, amount: undefined }))
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={s.minDeposit}
                  max={s.maxDeposit}
                  className={`input ${errors.amount ? 'invalid' : ''}`}
                  placeholder={`Custom amount (${s.minDeposit}–${s.maxDeposit})`}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value === '' ? '' : Number(e.target.value))
                    setErrors((x) => ({ ...x, amount: undefined }))
                  }}
                />
                {amount !== '' && !errors.amount && amtNum >= s.minDeposit && amtNum <= s.maxDeposit && (
                  <div className="hint">You will receive {fmtNcc(amtNum, s.coinSymbol)} ≈ {fmtRupees(amtNum * s.rate)}</div>
                )}
              </Field>

              <Field
                label="Payment Reference / Transaction ID"
                required
                error={errors.reference}
                hint="The reference shown in your eSewa/Khalti/bank confirmation."
              >
                <input
                  className={`input ${errors.reference ? 'invalid' : ''}`}
                  placeholder="e.g. 20250928.1234567"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
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

              <Field label="Payment Screenshot (optional)" hint="A screenshot of the transfer speeds up verification.">
                <input ref={fileRef} type="file" accept="image/*" className="input" onChange={onFile} />
                {screenshot && (
                  <div className="row mt8">
                    <img src={screenshot} alt="Payment screenshot preview" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                    <button type="button" className="btn btn-sm btn-ghost text-red" onClick={() => { setScreenshot(undefined); if (fileRef.current) fileRef.current.value = '' }}>
                      ✕ Remove
                    </button>
                  </div>
                )}
              </Field>

              <button type="submit" className="btn btn-primary btn-lg btn-block mt8" disabled={!pay.depositEnabled || busy}>
                Submit Deposit Request
              </button>
              <div className="hint mt8" style={{ textAlign: 'center' }}>
                Coins are added to your wallet only after an admin approves your request.
              </div>
            </form>
          </div>
        </Card>

        <Card>
          <CardHead title="Payment Information" sub="Send the exact amount to this account" />
          <div className="card-pad" style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
            <div className="qr-box">
              {pay.qrImage ? (
                <img src={pay.qrImage} alt="Payment QR code" />
              ) : (
                <div className="empty" style={{ padding: '30px 10px' }}>
                  <div className="e-ico">🔳</div>
                  <h4>QR not configured</h4>
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="strong" style={{ fontSize: 15.5 }}>{pay.paymentName}</div>
              <div className="mono text-blue strong" style={{ fontSize: 14 }}>{pay.paymentId}</div>
            </div>
            <div className="divider" style={{ width: '100%' }} />
            <div className="small" style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>
              {pay.instructions || 'Pay via the QR or the payment ID above, then submit the reference below.'}
            </div>
            <div className="alert alert-info small" style={{ width: '100%', marginBottom: 0 }}>
              1️⃣ Pay <b>{pay.paymentName}</b> → 2️⃣ Copy the reference ID → 3️⃣ Submit the form →
              4️⃣ Wait for admin approval. Pending deposits show in your <Link to="/deposits" className="strong">deposit history</Link>.
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doSubmit}
        busy={busy}
        title="Submit Deposit Request?"
        confirmLabel="Submit Request"
        message={
          <div>
            <dl className="kv">
              <dt>Amount</dt>
              <dd>{fmtNcc(amtNum, s.coinSymbol)} (≈ {fmtRupees(amtNum * s.rate)})</dd>
              <dt>Reference</dt>
              <dd className="mono">{reference}</dd>
              <dt>Screenshot</dt>
              <dd>{screenshot ? 'Attached ✓' : 'None'}</dd>
            </dl>
            <p className="small muted mt16">
              Make sure you have actually sent the payment — false references are rejected and may
              lead to account action. Coins are credited after admin approval.
            </p>
          </div>
        }
      />
    </div>
  )
}
