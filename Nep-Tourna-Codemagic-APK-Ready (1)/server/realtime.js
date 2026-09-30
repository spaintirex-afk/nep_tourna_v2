// Real-time fan-out via Server-Sent Events.
//
// The server never pushes state over the wire — that would risk leaking
// role-scoped data. Instead, after any successful mutation we broadcast a tiny
// "changed" ping. Every connected browser then re-fetches /api/state, which
// returns its own role-scoped snapshot. This keeps the security boundary in one
// place (buildState) while giving all users live updates.

const clients = new Set()

export function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write('retry: 3000\n\n')
  res.write(`event: hello\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`)

  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n') } catch { /* ignore */ }
  }, 25000)

  clients.add(res)
  req.on('close', () => {
    clearInterval(heartbeat)
    clients.delete(res)
  })
}

/** Broadcast a change ping to every connected client. */
export function broadcast(type = 'changed') {
  const payload = `event: ${type}\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`
  for (const res of clients) {
    try { res.write(payload) } catch { clients.delete(res) }
  }
}

export function clientCount() {
  return clients.size
}
