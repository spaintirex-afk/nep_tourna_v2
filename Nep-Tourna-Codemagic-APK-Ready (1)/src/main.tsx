import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './components/ui'
import { useReady } from './store'
import './styles/global.css'

function Boot() {
  const ready = useReady()
  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
          background: '#0b1020',
          color: '#e5e7eb',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.5 }}>Nep Tourna</div>
        <div style={{ opacity: 0.7, fontSize: 14 }}>Loading…</div>
      </div>
    )
  }
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Boot />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
