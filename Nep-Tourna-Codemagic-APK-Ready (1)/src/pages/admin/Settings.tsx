import { useState } from 'react'
import { useCurrentUser, useDB } from '../../store'
import { Card, CardHead, ConfirmDialog, Field, useToast } from '../../components/ui'
import { updateSettings } from '../../lib/actions'
import { readFileAsDataURL } from '../../lib/format'
import type { Settings as SettingsType } from '../../lib/types'

export default function Settings() {
  const db = useDB()
  const me = useCurrentUser()
  const toast = useToast()
  const s = db.settings

  // General
  const [general, setGeneral] = useState<SettingsType['general']>({ ...s.general })
  const [generalErr, setGeneralErr] = useState<Record<string, string>>({})
  // Wallet
  const [wallet, setWallet] = useState<SettingsType['wallet']>({ ...s.wallet })
  const [walletErr, setWalletErr] = useState<Record<string, string>>({})
  // Tournament
  const [tournament, setTournament] = useState<SettingsType['tournament']>({ ...s.tournament })
  // Maintenance
  const [maintenance, setMaintenance] = useState<SettingsType['maintenance']>({ ...s.maintenance })
  const [confirmMaintenance, setConfirmMaintenance] = useState(false)
  // Social
  const [social, setSocial] = useState<SettingsType['social']>({ ...(s.social ?? { facebook: '', instagram: '', youtube: '', discord: '', twitter: '', tiktok: '' }) })

  const save = async <K extends keyof SettingsType>(section: K, patch: Partial<SettingsType[K]>): Promise<boolean> => {
    if (!me) return false
    try {
      const r = await updateSettings(me.id, section, patch)
      if (r.ok) toast.push('success', `${String(section)[0].toUpperCase() + String(section).slice(1)} settings saved.`)
      else toast.push('error', r.error)
      return r.ok
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Action failed.')
      return false
    }
  }

  const saveGeneral = async () => {
    const e: Record<string, string> = {}
    if (!general.appName.trim()) e.appName = 'App name is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(general.supportEmail.trim())) e.supportEmail = 'Enter a valid support email.'
    setGeneralErr(e)
    if (Object.keys(e).length > 0) { toast.push('error', 'Please fix the highlighted errors.'); return }
    await save('general', general)
  }

  const saveWallet = async () => {
    const e: Record<string, string> = {}
    if (!wallet.coinName.trim()) e.coinName = 'Coin name is required.'
    if (!wallet.coinSymbol.trim()) e.coinSymbol = 'Coin symbol is required.'
    if (!Number.isFinite(wallet.rate) || wallet.rate <= 0) e.rate = 'Rate must be a number greater than 0.'
    if (wallet.minDeposit < 0 || wallet.maxDeposit < 0) e.deposit = 'Deposit limits cannot be negative.'
    if (wallet.minDeposit > wallet.maxDeposit) e.deposit = 'Minimum deposit must be ≤ maximum deposit.'
    if (wallet.minWithdraw < 0 || wallet.maxWithdraw < 0) e.withdraw = 'Withdrawal limits cannot be negative.'
    if (wallet.minWithdraw > wallet.maxWithdraw) e.withdraw = 'Minimum withdrawal must be ≤ maximum withdrawal.'
    setWalletErr(e)
    if (Object.keys(e).length > 0) { toast.push('error', 'Please fix the highlighted errors.'); return }
    await save('wallet', wallet)
  }

  const onLogo = async (f: File | undefined) => {
    if (!f) return
    try {
      setGeneral({ ...general, logo: await readFileAsDataURL(f) })
    } catch {
      toast.push('error', 'Could not read the image file.')
    }
  }

  const num = (v: string) => Number(v) || 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>App Settings</h1>
          <div className="sub">Global configuration for branding, wallet rules, tournaments and maintenance</div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* General */}
        <Card className="mb24">
          <CardHead title="General" sub="Branding and contact info" />
          <div style={{ padding: 20 }}>
            <Field label="App Name" required error={generalErr.appName}>
              <input className={`input ${generalErr.appName ? 'invalid' : ''}`} value={general.appName} onChange={(e) => setGeneral({ ...general, appName: e.target.value })} />
            </Field>
            <Field label="App Description">
              <textarea className="textarea" value={general.appDescription} onChange={(e) => setGeneral({ ...general, appDescription: e.target.value })} />
            </Field>
            <Field label="Support Email" required error={generalErr.supportEmail}>
              <input className={`input ${generalErr.supportEmail ? 'invalid' : ''}`} type="email" value={general.supportEmail} onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })} />
            </Field>
            <Field label="Contact Number">
              <input className="input" value={general.contact} onChange={(e) => setGeneral({ ...general, contact: e.target.value })} />
            </Field>
            <Field label="Logo (optional)">
              <input className="input" type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0])} />
            </Field>
            {general.logo && (
              <div className="row mb16" style={{ gap: 12 }}>
                <img src={general.logo} alt="Logo preview" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: '#fff' }} />
                <button className="btn btn-sm btn-outline text-red" onClick={() => setGeneral({ ...general, logo: undefined })}>Remove</button>
              </div>
            )}
            <button className="btn btn-primary" onClick={saveGeneral}>💾 Save General</button>
          </div>
        </Card>

        {/* Wallet */}
        <Card className="mb24">
          <CardHead title="Wallet & NCC Coin" sub="Coin naming, exchange rate and limits" />
          <div style={{ padding: 20 }}>
            <div className="form-grid">
              <Field label="Coin Name" required error={walletErr.coinName}>
                <input className={`input ${walletErr.coinName ? 'invalid' : ''}`} value={wallet.coinName} onChange={(e) => setWallet({ ...wallet, coinName: e.target.value })} />
              </Field>
              <Field label="Coin Symbol" required error={walletErr.coinSymbol}>
                <input className={`input ${walletErr.coinSymbol ? 'invalid' : ''}`} value={wallet.coinSymbol} onChange={(e) => setWallet({ ...wallet, coinSymbol: e.target.value })} />
              </Field>
              <div className="full">
                <Field label="Exchange Rate (NPR per coin)" required error={walletErr.rate} hint="Default: 1 NCC = ₹1. Used to display rupee equivalents.">
                  <input className={`input ${walletErr.rate ? 'invalid' : ''}`} type="number" min={0.01} step="0.01" value={String(wallet.rate)} onChange={(e) => setWallet({ ...wallet, rate: Number(e.target.value) })} />
                </Field>
              </div>
              <Field label="Min Deposit" error={walletErr.deposit}>
                <input className={`input ${walletErr.deposit ? 'invalid' : ''}`} type="number" min={0} value={String(wallet.minDeposit)} onChange={(e) => setWallet({ ...wallet, minDeposit: num(e.target.value) })} />
              </Field>
              <Field label="Max Deposit">
                <input className="input" type="number" min={0} value={String(wallet.maxDeposit)} onChange={(e) => setWallet({ ...wallet, maxDeposit: num(e.target.value) })} />
              </Field>
              <Field label="Min Withdrawal" error={walletErr.withdraw}>
                <input className={`input ${walletErr.withdraw ? 'invalid' : ''}`} type="number" min={0} value={String(wallet.minWithdraw)} onChange={(e) => setWallet({ ...wallet, minWithdraw: num(e.target.value) })} />
              </Field>
              <Field label="Max Withdrawal">
                <input className="input" type="number" min={0} value={String(wallet.maxWithdraw)} onChange={(e) => setWallet({ ...wallet, maxWithdraw: num(e.target.value) })} />
              </Field>
            </div>
            <button className="btn btn-primary mt8" onClick={saveWallet}>💾 Save Wallet</button>
          </div>
        </Card>

        {/* Tournament */}
        <Card className="mb24">
          <CardHead title="Tournament" sub="Defaults applied to new tournaments and results" />
          <div style={{ padding: 20 }}>
            <Field label="Default Rules" hint="Prefilled into the rules box when creating a tournament.">
              <textarea className="textarea" style={{ minHeight: 140 }} value={tournament.defaultRules} onChange={(e) => setTournament({ ...tournament, defaultRules: e.target.value })} />
            </Field>
            <div style={{ display: 'grid', gap: 10 }} className="mb16">
              <label className="checkbox">
                <input type="checkbox" checked={tournament.allowRegistration} onChange={(e) => setTournament({ ...tournament, allowRegistration: e.target.checked })} />
                <span>Allow tournament registration globally</span>
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={tournament.requireResultApproval} onChange={(e) => setTournament({ ...tournament, requireResultApproval: e.target.checked })} />
                <span>Require result approval before publishing</span>
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={tournament.autoPrizeDistribution} onChange={(e) => setTournament({ ...tournament, autoPrizeDistribution: e.target.checked })} />
                <span>Auto-distribute prizes when results are published</span>
              </label>
            </div>
            <button className="btn btn-primary" onClick={async () => await save('tournament', tournament)}>💾 Save Tournament</button>
          </div>
        </Card>

        {/* Maintenance */}
        <Card className="mb24">
          <CardHead title="Maintenance Mode" sub="Temporarily show a maintenance notice to players" />
          <div style={{ padding: 20 }}>
            <label className="checkbox mb16">
              <input
                type="checkbox"
                checked={maintenance.enabled}
                onChange={(e) => {
                  if (e.target.checked) setConfirmMaintenance(true)
                  else setMaintenance({ ...maintenance, enabled: false })
                }}
              />
              <span><b>Maintenance mode enabled</b></span>
            </label>
            <Field label="Maintenance Message" hint="Shown to players while maintenance mode is enabled.">
              <textarea className="textarea" value={maintenance.message} onChange={(e) => setMaintenance({ ...maintenance, message: e.target.value })} placeholder="We are upgrading the arena. Back soon!" />
            </Field>
            {maintenance.enabled && <div className="alert alert-warn">⚠ Maintenance mode is ON — players will see the maintenance notice.</div>}
            <button className="btn btn-primary" onClick={async () => await save('maintenance', maintenance)}>💾 Save Maintenance</button>
          </div>
        </Card>

        {/* Social Media */}
        <Card className="mb24">
          <CardHead title="Social Media Links" sub="Shown by the player floating AI assistant when asked for socials" />
          <div style={{ padding: 20 }}>
            {([
              ['facebook', '📘 Facebook'],
              ['instagram', '📸 Instagram'],
              ['youtube', '▶️ YouTube'],
              ['discord', '💬 Discord'],
              ['twitter', '🐦 Twitter / X'],
              ['tiktok', '🎵 TikTok'],
            ] as [keyof SettingsType['social'], string][]).map(([key, label]) => (
              <Field key={key} label={label} hint="Full URL including https:// — leave blank to hide.">
                <input
                  className="input"
                  type="url"
                  placeholder={`https://${key}.com/neptourna`}
                  value={social[key]}
                  onChange={(e) => setSocial({ ...social, [key]: e.target.value })}
                />
              </Field>
            ))}
            <button className="btn btn-primary" onClick={async () => await save('social', social)}>💾 Save Social Links</button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmMaintenance}
        onClose={() => setConfirmMaintenance(false)}
        onConfirm={() => { setMaintenance({ ...maintenance, enabled: true }); setConfirmMaintenance(false); toast.push('info', 'Maintenance mode will take effect after you click Save Maintenance.') }}
        title="Enable maintenance mode?"
        danger
        confirmLabel="Enable Maintenance"
        message={<p>When enabled and saved, <b>players will see the maintenance notice</b> instead of the normal app. Admin access remains available. Continue?</p>}
      />
    </div>
  )
}
