import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDB } from '../../store'
import { Card, CardHead, EmptyState, Field, useToast } from '../../components/ui'
import { createTournament, updateTournament } from '../../lib/actions'
import { readFileAsDataURL } from '../../lib/format'
import type { PrizeSlot, TournamentStatus } from '../../lib/types'

const TYPES = ['Solo', 'Duo', 'Squad', 'Clash Squad']
const STATUSES: TournamentStatus[] = ['upcoming', 'registration_open', 'registration_closed', 'live', 'completed', 'cancelled']

function isoToLocalInput(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TournamentForm() {
  const { id } = useParams()
  const db = useDB()
  const toast = useToast()
  const navigate = useNavigate()
  const existing = db.tournaments.find((t) => t.id === id)
  const isEdit = Boolean(id)

  const [name, setName] = useState('')
  const [game, setGame] = useState('Free Fire')
  const [type, setType] = useState('Squad')
  const [description, setDescription] = useState('')
  const [entryFee, setEntryFee] = useState('0')
  const [prizePool, setPrizePool] = useState('0')
  const [maxPlayers, setMaxPlayers] = useState('48')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [regDeadline, setRegDeadline] = useState('')
  const [mapName, setMapName] = useState('')
  const [mode, setMode] = useState('')
  const [roomId, setRoomId] = useState('')
  const [roomPassword, setRoomPassword] = useState('')
  const [rules, setRules] = useState(db.settings.tournament.defaultRules)
  const [banner, setBanner] = useState('')
  const [status, setStatus] = useState<TournamentStatus>('upcoming')
  const [prizes, setPrizes] = useState<PrizeSlot[]>([
    { rank: 1, amount: 0 },
    { rank: 2, amount: 0 },
    { rank: 3, amount: 0 },
  ])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(!isEdit)

  useEffect(() => {
    if (!isEdit || !existing || loaded) return
    setName(existing.name)
    setGame(existing.game)
    setType(existing.type)
    setDescription(existing.description)
    setEntryFee(String(existing.entryFee))
    setPrizePool(String(existing.prizePool))
    setMaxPlayers(String(existing.maxPlayers))
    setDate(existing.date)
    setStartTime(existing.startTime)
    setRegDeadline(isoToLocalInput(existing.regDeadline))
    setMapName(existing.map ?? '')
    setMode(existing.mode ?? '')
    setRoomId(existing.roomId ?? '')
    setRoomPassword(existing.roomPassword ?? '')
    setRules(existing.rules ?? '')
    setBanner(existing.banner ?? '')
    setStatus(existing.status)
    setPrizes([1, 2, 3].map((rank) => ({ rank, amount: existing.prizes.find((p) => p.rank === rank)?.amount ?? 0 })))
    setLoaded(true)
  }, [isEdit, existing, loaded])

  if (isEdit && !existing) {
    return (
      <div className="page">
        <EmptyState icon="🏆" title="Tournament not found" message="It may have been deleted." action={<Link to="/admin/tournaments" className="btn btn-primary">Back to Tournaments</Link>} />
      </div>
    )
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Tournament name is required.'
    if (!date) e.date = 'Tournament date is required.'
    const fee = Number(entryFee)
    const pool = Number(prizePool)
    const max = Number(maxPlayers)
    if (!Number.isFinite(fee) || fee < 0) e.entryFee = 'Entry fee must be a non-negative number.'
    if (!Number.isFinite(pool) || pool < 0) e.prizePool = 'Prize pool must be a non-negative number.'
    if (!Number.isFinite(max) || max < 2) e.maxPlayers = 'Maximum players must be at least 2.'
    if (prizes.some((p) => !Number.isFinite(p.amount) || p.amount < 0)) e.prizes = 'Prize amounts must be non-negative numbers.'
    if (regDeadline) {
      const dl = new Date(regDeadline).getTime()
      const start = startTime ? new Date(`${date}T${startTime}`).getTime() : NaN
      if (Number.isFinite(start) && dl >= start) e.regDeadline = 'Registration deadline must be before the tournament start time.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = async () => {
    if (!validate()) {
      toast.push('error', 'Please fix the highlighted errors.')
      return
    }
    const payload = {
      name: name.trim(),
      game: game.trim() || 'Free Fire',
      type,
      description: description.trim(),
      entryFee: Number(entryFee),
      prizePool: Number(prizePool),
      maxPlayers: Number(maxPlayers),
      date,
      startTime,
      regDeadline: regDeadline ? new Date(regDeadline).toISOString() : '',
      map: mapName.trim() || undefined,
      mode: mode.trim() || undefined,
      roomId: roomId.trim() || undefined,
      roomPassword: roomPassword.trim() || undefined,
      rules: rules.trim() || undefined,
      banner: banner || undefined,
      prizes: prizes.filter((p) => p.amount > 0),
      status,
    }
    try {
      const r = isEdit ? await updateTournament(id!, payload) : await createTournament(payload)
      if (r.ok) {
        toast.push('success', isEdit ? 'Tournament updated.' : 'Tournament created.')
        navigate('/admin/tournaments')
      } else {
        toast.push('error', r.error)
      }
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Action failed.')
    }
  }

  const onBanner = async (f: File | undefined) => {
    if (!f) return
    try {
      setBanner(await readFileAsDataURL(f))
    } catch {
      toast.push('error', 'Could not read the image file.')
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{isEdit ? 'Edit Tournament' : 'Create Tournament'}</h1>
          <div className="sub">{isEdit ? `Updating "${existing?.name}"` : 'Set up a new Free Fire tournament'}</div>
        </div>
        <Link to="/admin/tournaments" className="btn btn-outline">← Back</Link>
      </div>

      <Card>
        <CardHead title="Tournament Details" sub="All fields marked * are required" />
        <div style={{ padding: 20 }}>
          <div className="form-grid">
            <div className="full">
              <Field label="Tournament Name" required error={errors.name}>
                <input className={`input ${errors.name ? 'invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nepal Fire Squad Showdown" />
              </Field>
            </div>
            <Field label="Game">
              <input className="input" value={game} onChange={(e) => setGame(e.target.value)} />
            </Field>
            <Field label="Type">
              <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <div className="full">
              <Field label="Description">
                <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What makes this tournament special?" />
              </Field>
            </div>
            <Field label="Entry Fee (NCC)" error={errors.entryFee}>
              <input className={`input ${errors.entryFee ? 'invalid' : ''}`} type="number" min={0} value={entryFee} onChange={(e) => setEntryFee(e.target.value)} />
            </Field>
            <Field label="Prize Pool (NCC)" error={errors.prizePool}>
              <input className={`input ${errors.prizePool ? 'invalid' : ''}`} type="number" min={0} value={prizePool} onChange={(e) => setPrizePool(e.target.value)} />
            </Field>
            <Field label="Max Players" error={errors.maxPlayers}>
              <input className={`input ${errors.maxPlayers ? 'invalid' : ''}`} type="number" min={2} value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} />
            </Field>
            <Field label="Status">
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value as TournamentStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
            <Field label="Date" required error={errors.date}>
              <input className={`input ${errors.date ? 'invalid' : ''}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Start Time">
              <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field label="Registration Deadline" error={errors.regDeadline} hint="Players cannot join after this time.">
              <input className={`input ${errors.regDeadline ? 'invalid' : ''}`} type="datetime-local" value={regDeadline} onChange={(e) => setRegDeadline(e.target.value)} />
            </Field>
            <Field label="Map">
              <input className="input" value={mapName} onChange={(e) => setMapName(e.target.value)} placeholder="e.g. Bermuda" />
            </Field>
            <Field label="Mode">
              <input className="input" value={mode} onChange={(e) => setMode(e.target.value)} placeholder="e.g. Battle Royale" />
            </Field>
            <Field label="Room ID">
              <input className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
            </Field>
            <Field label="Room Password">
              <input className="input" value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} />
            </Field>
            <div className="full">
              <Field label="Rules">
                <textarea className="textarea" value={rules} onChange={(e) => setRules(e.target.value)} />
              </Field>
            </div>
            <div className="full">
              <Field label="Banner Image" hint="Optional. Uploaded images are stored locally (demo).">
                <input className="input" type="file" accept="image/*" onChange={(e) => onBanner(e.target.files?.[0])} />
              </Field>
              {banner && (
                <div className="row mt8" style={{ gap: 12 }}>
                  <img src={banner} alt="Banner preview" style={{ width: 220, height: 90, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                  <button className="btn btn-sm btn-outline text-red" onClick={() => setBanner('')}>Remove</button>
                </div>
              )}
            </div>
          </div>

          <div className="divider" />

          <h3 style={{ fontSize: 15, marginBottom: 4 }}>Prize Slots</h3>
          <div className="muted small mb16">Amounts are credited to winners automatically when prizes are distributed.</div>
          {errors.prizes && <div className="alert alert-error">{errors.prizes}</div>}
          {prizes.map((p, i) => (
            <div className="row mb8" key={p.rank} style={{ gap: 12 }}>
              <span className="badge badge-plain badge-navy" style={{ minWidth: 64, justifyContent: 'center' }}>
                {p.rank === 1 ? '🥇 1st' : p.rank === 2 ? '🥈 2nd' : '🥉 3rd'}
              </span>
              <input
                className="input"
                style={{ maxWidth: 200 }}
                type="number"
                min={0}
                placeholder="Amount (NCC)"
                value={String(p.amount)}
                onChange={(e) => setPrizes((prev) => prev.map((x, xi) => (xi === i ? { ...x, amount: Number(e.target.value) || 0 } : x)))}
              />
              <span className="muted small">NCC</span>
            </div>
          ))}

          <div className="row mt24" style={{ gap: 10 }}>
            <button className="btn btn-primary" onClick={onSubmit}>{isEdit ? 'Save Changes' : 'Create Tournament'}</button>
            <Link to="/admin/tournaments" className="btn btn-outline">Cancel</Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
