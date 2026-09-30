import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDB, useCurrentUser } from '../store'
import { fmtNcc } from '../lib/format'

interface NavAction {
  label: string
  to: string
  icon?: string
}
interface ExtLink {
  label: string
  url: string
  icon?: string
}
interface Msg {
  id: number
  from: 'bot' | 'user'
  text: string
  nav?: NavAction[]
  links?: ExtLink[]
}

type SocialKey = 'facebook' | 'instagram' | 'youtube' | 'discord' | 'twitter' | 'tiktok'
const SOCIAL_META: { key: SocialKey; label: string; icon: string }[] = [
  { key: 'facebook', label: 'Facebook', icon: '📘' },
  { key: 'instagram', label: 'Instagram', icon: '📸' },
  { key: 'youtube', label: 'YouTube', icon: '▶️' },
  { key: 'discord', label: 'Discord', icon: '💬' },
  { key: 'twitter', label: 'Twitter / X', icon: '🐦' },
  { key: 'tiktok', label: 'TikTok', icon: '🎵' },
]

let msgId = 0
const nextId = () => ++msgId

export default function FloatingAssistant() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const bodyRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const db = useDB()
  const user = useCurrentUser()
  const settings = db.settings

  useEffect(() => {
    if (open && messages.length === 0) {
      pushBot(
        `Hey${user ? ' ' + user.fullName.split(' ')[0] : ''}! 👋 I'm your Nep Tourna assistant.\n\nI can help you:\n• Navigate anywhere in the app\n• Find & read the tournament rules\n• Get our social media links\n\nWhat do you need?`,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing, open])

  function pushBot(text: string, extra?: { nav?: NavAction[]; links?: ExtLink[] }) {
    setMessages((m) => [...m, { id: nextId(), from: 'bot', text, ...extra }])
  }

  const NAV_TARGETS: { keys: string[]; label: string; to: string; icon: string }[] = [
    { keys: ['dashboard', 'home', 'main'], label: 'Dashboard', to: '/dashboard', icon: '🏠' },
    { keys: ['tournament', 'event', 'browse', 'join', 'match list', 'available'], label: 'Browse Tournaments', to: '/tournaments', icon: '🏆' },
    { keys: ['my tournament', 'joined', 'registered', 'my match', 'my event'], label: 'My Tournaments', to: '/my-tournaments', icon: '🎯' },
    { keys: ['wallet', 'balance', 'coin', 'ncc', 'transaction'], label: 'Wallet', to: '/wallet', icon: '👛' },
    { keys: ['deposit', 'add money', 'top up', 'topup', 'recharge', 'pay in'], label: 'Deposit NCC', to: '/deposit', icon: '💰' },
    { keys: ['withdraw', 'cash out', 'cashout', 'payout', 'withdrawal'], label: 'Withdraw', to: '/withdraw', icon: '🏧' },
    { keys: ['leaderboard', 'rank', 'ranking', 'standing', 'top player'], label: 'Leaderboard', to: '/leaderboard', icon: '📊' },
    { keys: ['announcement', 'news', 'update'], label: 'Announcements', to: '/announcements', icon: '📢' },
    { keys: ['notification', 'alert'], label: 'Notifications', to: '/notifications', icon: '🔔' },
    { keys: ['support', 'help desk', 'ticket', 'contact support', 'problem', 'issue', 'complaint'], label: 'Support', to: '/support', icon: '🎧' },
    { keys: ['profile', 'account', 'my info'], label: 'Profile', to: '/profile', icon: '👤' },
    { keys: ['setting', 'preferences'], label: 'Settings', to: '/settings', icon: '⚙️' },
  ]

  function findNav(text: string) {
    const t = text.toLowerCase()
    return NAV_TARGETS.filter((n) => n.keys.some((k) => t.includes(k)))
  }

  function respond(raw: string) {
    const text = raw.trim()
    const t = text.toLowerCase()

    // Greetings
    if (/^(hi|hey|hello|yo|namaste|namaskar|good (morning|evening|afternoon))\b/.test(t)) {
      pushBot(`Hello${user ? ' ' + user.fullName.split(' ')[0] : ''}! 😊 How can I help you today?`, {
        nav: [
          { label: 'Show tournament rules', to: '__rules__', icon: '📜' },
          { label: 'Social media links', to: '__social__', icon: '🔗' },
          { label: 'Browse tournaments', to: '/tournaments', icon: '🏆' },
        ],
      })
      return
    }

    // Rules
    if (t.includes('rule') || t.includes('guideline') || t.includes('how does it work') || t.includes('terms')) {
      pushBot(`📜 Here are the standard Nep Tourna rules:\n\n${settings.tournament.defaultRules}\n\nℹ️ Each tournament may add its own specific rules — open any tournament and check its "Rules" section. Room ID & password are shown on the tournament page once released.`, {
        nav: [
          { label: 'Browse tournaments', to: '/tournaments', icon: '🏆' },
          { label: 'My tournaments', to: '/my-tournaments', icon: '🎯' },
        ],
      })
      return
    }

    // Social media
    if (t.includes('social') || t.includes('facebook') || t.includes('instagram') || t.includes('youtube') || t.includes('discord') || t.includes('twitter') || t.includes('tiktok') || t.includes('follow')) {
      const social = settings.social ?? ({} as Record<SocialKey, string>)
      const links: ExtLink[] = SOCIAL_META.filter((s) => social[s.key])
        .map((s) => ({ label: s.label, url: social[s.key], icon: s.icon }))
      if (links.length === 0) {
        pushBot('Social media links are not configured yet. Please check back soon! 🔗')
        return
      }
      pushBot('🔗 Follow Nep Tourna on social media for updates, results & giveaways:', { links })
      return
    }

    // Balance / wallet info
    if (t.includes('balance') || (t.includes('how much') && (t.includes('coin') || t.includes('ncc') || t.includes('money')))) {
      const w = user ? db.wallets.find((x) => x.userId === user.id) : undefined
      const symbol = settings.wallet.coinSymbol
      if (w) {
        pushBot(`👛 Your wallet, ${user!.fullName.split(' ')[0]}:\n\n• Available: ${fmtNcc(w.available, symbol)}\n• Reserved (pending withdrawal): ${fmtNcc(w.pending, symbol)}\n• Total deposited: ${fmtNcc(w.totalDeposited, symbol)}\n• Total won/spent on entries: ${fmtNcc(w.totalSpent, symbol)}\n\n1 ${symbol} = ₹${settings.wallet.rate}`, {
          nav: [
            { label: 'Open wallet', to: '/wallet', icon: '👛' },
            { label: 'Deposit coins', to: '/deposit', icon: '💰' },
            { label: 'Withdraw', to: '/withdraw', icon: '🏧' },
          ],
        })
      } else {
        pushBot('Please log in to see your balance.')
      }
      return
    }

    // Deposit
    if (t.includes('deposit') || t.includes('top up') || t.includes('add money') || t.includes('recharge')) {
      pushBot(`💰 To deposit ${settings.wallet.coinSymbol}:\n\n1. Go to the Deposit page\n2. Scan the payment QR & pay\n3. Enter the payment reference\n4. Upload a screenshot (faster approval)\n\nCoins are added after an admin approves. Min ${settings.wallet.minDeposit}, max ${settings.wallet.maxDeposit}.`, {
        nav: [{ label: 'Open Deposit page', to: '/deposit', icon: '💰' }],
      })
      return
    }

    // Withdraw
    if (t.includes('withdraw') || t.includes('cash out') || t.includes('payout')) {
      pushBot(`🏧 To withdraw ${settings.wallet.coinSymbol}:\n\n1. Open the Withdraw page\n2. Enter the amount (min ${settings.wallet.minWithdraw})\n3. Choose a payment method + account\n4. Submit the request\n\nThe amount is reserved until an admin marks it paid.`, {
        nav: [{ label: 'Open Withdraw page', to: '/withdraw', icon: '🏧' }],
      })
      return
    }

    // Join tournament
    if (t.includes('join') || t.includes('register for') || t.includes('sign up for') || t.includes('enter tournament')) {
      pushBot('🏆 To join a tournament:\n\n1. Browse available tournaments\n2. Open one and tap "Join"\n3. Make sure registration is open, it\'s not full, and you have enough coins\n\nThe entry fee is deducted from your wallet instantly.', {
        nav: [{ label: 'Browse tournaments', to: '/tournaments', icon: '🏆' }],
      })
      return
    }

    // Generic navigation
    const navMatches = findNav(text)
    if (navMatches.length > 0) {
      pushBot(`Sure! Here you go — tap to navigate:`, {
        nav: navMatches.map((n) => ({ label: n.label, to: n.to, icon: n.icon })),
      })
      return
    }

    // Help / capabilities
    if (t.includes('help') || t.includes('what can you do') || t.includes('menu') || t.includes('options')) {
      pushBot('I can help with these — just tap:', {
        nav: [
          { label: 'Tournament rules', to: '__rules__', icon: '📜' },
          { label: 'Social media links', to: '__social__', icon: '🔗' },
          { label: 'My balance', to: '__balance__', icon: '👛' },
          { label: 'Browse tournaments', to: '/tournaments', icon: '🏆' },
          { label: 'Deposit coins', to: '/deposit', icon: '💰' },
          { label: 'Withdraw', to: '/withdraw', icon: '🏧' },
          { label: 'Leaderboard', to: '/leaderboard', icon: '📊' },
          { label: 'Contact support', to: '/support', icon: '🎧' },
        ],
      })
      return
    }

    // Thanks
    if (t.includes('thank') || t.includes('thanks') || t.includes('dhanyabad')) {
      pushBot('You\'re welcome! 🙌 Good luck and Booyah! 🏆 Tap below if you need anything else.', {
        nav: [{ label: 'Show help menu', to: '__help__', icon: '❓' }],
      })
      return
    }

    // Fallback
    pushBot(`I'm not sure I caught that 🤔. I can help you navigate, read the rules, check your balance, or get social links. Try one of these:`, {
      nav: [
        { label: 'Tournament rules', to: '__rules__', icon: '📜' },
        { label: 'Social media links', to: '__social__', icon: '🔗' },
        { label: 'My balance', to: '__balance__', icon: '👛' },
        { label: 'Browse tournaments', to: '/tournaments', icon: '🏆' },
        { label: 'Help menu', to: '__help__', icon: '❓' },
      ],
    })
  }

  function send(text: string) {
    const clean = text.trim()
    if (!clean) return
    setMessages((m) => [...m, { id: nextId(), from: 'user', text: clean }])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      respond(clean)
    }, 480)
  }

  function handleNav(to: string) {
    if (to === '__rules__') return respond('rules')
    if (to === '__social__') return respond('social media')
    if (to === '__balance__') return respond('balance')
    if (to === '__help__') return respond('help')
    navigate(to)
    setOpen(false)
  }

  const suggestions = ['📜 Rules', '🔗 Social links', '👛 My balance', '🏆 Tournaments', '💰 Deposit', '🏧 Withdraw']
  const suggestionMap: Record<string, string> = {
    '📜 Rules': 'rules',
    '🔗 Social links': 'social media',
    '👛 My balance': 'balance',
    '🏆 Tournaments': 'tournaments',
    '💰 Deposit': 'deposit',
    '🏧 Withdraw': 'withdraw',
  }

  return (
    <>
      {open && (
        <div className="ai-panel" role="dialog" aria-label="Nep Tourna assistant">
          <div className="ai-head">
            <div className="ai-ava">🤖</div>
            <div>
              <div className="ai-title">Nep Tourna Assistant</div>
              <div className="ai-status">Online · here to help</div>
            </div>
            <button className="ai-close" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </div>

          <div className="ai-body" ref={bodyRef}>
            {messages.map((m) => (
              <div key={m.id} className={`ai-msg ${m.from}`}>
                {m.text}
                {m.nav && m.nav.length > 0 && (
                  <div className="ai-links">
                    {m.nav.map((n, i) => (
                      <button key={i} className="ai-nav" onClick={() => handleNav(n.to)}>
                        <span>{n.icon ?? '➡️'}</span> {n.label}
                      </button>
                    ))}
                  </div>
                )}
                {m.links && m.links.length > 0 && (
                  <div className="ai-links">
                    {m.links.map((l, i) => (
                      <a key={i} className="ai-link" href={l.url} target="_blank" rel="noopener noreferrer">
                        <span>{l.icon ?? '🔗'}</span> {l.label} <span className="muted" style={{ marginLeft: 'auto', fontSize: 11 }}>↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {typing && (
              <div className="ai-msg bot ai-typing">
                <span /><span /><span />
              </div>
            )}
          </div>

          <div className="ai-chips">
            {suggestions.map((s) => (
              <button key={s} className="ai-chip" onClick={() => send(suggestionMap[s])}>{s}</button>
            ))}
          </div>

          <form
            className="ai-input-row"
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about rules, navigation, socials…"
              aria-label="Message the assistant"
            />
            <button className="ai-send" type="submit" disabled={!input.trim()} aria-label="Send">➤</button>
          </form>
        </div>
      )}

      <button className="ai-fab" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close assistant' : 'Open assistant'}>
        {open ? '✕' : '🤖'}
        {!open && <span className="ai-ping" />}
      </button>
    </>
  )
}
