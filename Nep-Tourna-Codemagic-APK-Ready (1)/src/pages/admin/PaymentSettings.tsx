import { useState } from 'react'
import { useCurrentUser, useDB } from '../../store'
import { Card, CardHead, ConfirmDialog, Field, useToast } from '../../components/ui'
import { updateSettings } from '../../lib/actions'
import { readFileAsDataURL } from '../../lib/format'

export default function PaymentSettings() {
  const db = useDB()
  const me = useCurrentUser()
  const toast = useToast()
  const p = db.settings.payment

  const [qrImage, setQrImage] = useState(p.qrImage ?? '')
  const [paymentName, setPaymentName] = useState(p.paymentName)
  const [paymentId, setPaymentId] = useState(p.paymentId)
  const [instructions, setInstructions] = useState(p.instructions)
  const [depositEnabled, setDepositEnabled] = useState(p.depositEnabled)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const onQr = async (f: File | undefined) => {
    if (!f) return
    try {
      setQrImage(await readFileAsDataURL(f))
    } catch {
      toast.push('error', 'Could not read the image file.')
    }
  }

  const save = async () => {
    const e: Record<string, string> = {}
    if (!paymentName.trim()) e.paymentName = 'Payment name is required so players know who they are paying.'
    if (!paymentId.trim()) e.paymentId = 'Payment ID / number is required.'
    setErrors(e)
    if (Object.keys(e).length > 0) {
      toast.push('error', 'Please fix the highlighted errors.')
      return
    }
    if (!me) return
    try {
      const r = await updateSettings(me.id, 'payment', {
        qrImage: qrImage || undefined,
        paymentName: paymentName.trim(),
        paymentId: paymentId.trim(),
        instructions: instructions.trim(),
        depositEnabled,
      })
      if (r.ok) toast.push('success', 'Payment settings saved — changes are live for players immediately.')
      else toast.push('error', r.error)
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Action failed.')
    }
  }

  const onToggleEnabled = () => {
    if (depositEnabled) {
      // currently enabled → disabling needs confirmation
      setConfirmDisable(true)
    } else {
      setDepositEnabled(true)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Payment Settings</h1>
          <div className="sub">Configure the QR code and payment details shown on the player deposit page</div>
        </div>
      </div>

      <div className="alert alert-info">⚡ Changes appear <b>immediately</b> on the player deposit page after saving.</div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHead title="Payment Configuration" sub="eSewa / Khalti / bank QR and instructions" />
          <div style={{ padding: 20 }}>
            <Field label="QR Code Image" hint="Players scan this QR to pay. Optional but strongly recommended.">
              <input className="input" type="file" accept="image/*" onChange={(e) => onQr(e.target.files?.[0])} />
            </Field>
            {qrImage && (
              <div className="row mb16" style={{ gap: 12, alignItems: 'flex-start' }}>
                <div className="qr-box">
                  <img src={qrImage} alt="Payment QR preview" />
                </div>
                <button className="btn btn-sm btn-outline text-red" onClick={() => setQrImage('')}>Remove QR</button>
              </div>
            )}
            <Field label="Payment Name" required error={errors.paymentName} hint="e.g. eSewa / Khalti account holder name">
              <input className={`input ${errors.paymentName ? 'invalid' : ''}`} value={paymentName} onChange={(e) => setPaymentName(e.target.value)} placeholder="e.g. Nep Tourna (eSewa)" />
            </Field>
            <Field label="Payment ID / Number" required error={errors.paymentId}>
              <input className={`input ${errors.paymentId ? 'invalid' : ''}`} value={paymentId} onChange={(e) => setPaymentId(e.target.value)} placeholder="e.g. 98XXXXXXXX" />
            </Field>
            <Field label="Instructions">
              <textarea className="textarea" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Send the exact amount and enter your username in the payment note." />
            </Field>
            <div className="divider" />
            <label className="checkbox">
              <input type="checkbox" checked={depositEnabled} onChange={onToggleEnabled} />
              <span><b>Deposits enabled</b> — players can submit new deposit requests</span>
            </label>
            <div className="row mt24" style={{ gap: 10 }}>
              <button className="btn btn-primary" onClick={save}>💾 Save Payment Settings</button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Player Preview" sub="How the deposit page will look" />
          <div style={{ padding: 20 }}>
            {!depositEnabled && <div className="alert alert-warn">Deposits are currently <b>disabled</b> — players will see this notice instead of the form.</div>}
            <div className="row" style={{ gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {qrImage ? (
                <div className="qr-box">
                  <img src={qrImage} alt="QR" />
                </div>
              ) : (
                <div className="qr-box" style={{ display: 'grid', placeItems: 'center', height: 200, color: 'var(--text-3)' }}>No QR uploaded</div>
              )}
              <div className="grow" style={{ minWidth: 200 }}>
                <div className="muted small">Pay to</div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{paymentName || '—'}</div>
                <div className="muted small mt8">Payment ID</div>
                <div className="mono strong" style={{ fontSize: 15 }}>{paymentId || '—'}</div>
                {instructions.trim() && (
                  <>
                    <div className="muted small mt8">Instructions</div>
                    <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{instructions}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        onConfirm={() => { setDepositEnabled(false); setConfirmDisable(false); toast.push('info', 'Deposits will be disabled when you save. Remember to click Save.') }}
        title="Disable deposits?"
        danger
        confirmLabel="Disable Deposits"
        message={<p>If you disable deposits and save, <b>players will not be able to submit new deposit requests</b> until you re-enable them. Pending requests can still be reviewed. Continue?</p>}
      />
    </div>
  )
}
