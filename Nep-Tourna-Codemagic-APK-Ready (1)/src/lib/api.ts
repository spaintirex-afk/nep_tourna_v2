// Thin API client. All calls are same-origin (Vite proxies /api in dev; Express
// serves both API and static build in production) and rely on the httpOnly
// session cookie, so credentials must be included.

export interface ApiOk {
  ok: true
  id?: string
  [k: string]: unknown
}
export interface ApiErr {
  ok: false
  error: string
}
export type ApiResponse = ApiOk | ApiErr

// In a normal web deployment the API is same-origin. In a Capacitor build,
// VITE_API_URL points to the deployed backend because the app runs from
// capacitor://localhost instead of the web server's origin.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const apiUrl = (path: string) => `${API_BASE}${path}`

async function parse(res: Response): Promise<ApiResponse> {
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    return { ok: false, error: `Server returned an invalid response (${res.status}).` }
  }
  if (body && typeof body === 'object' && 'ok' in body) return body as ApiResponse
  return { ok: false, error: 'Unexpected server response.' }
}

export async function apiGet(path: string): Promise<ApiResponse & Record<string, unknown>> {
  try {
    const res = await fetch(apiUrl(path), { credentials: API_BASE ? 'include' : 'same-origin', headers: { Accept: 'application/json' } })
    return (await parse(res)) as ApiResponse & Record<string, unknown>
  } catch {
    return { ok: false, error: 'Cannot reach the server. Check your connection.' }
  }
}

export async function apiPost(path: string, body?: unknown): Promise<ApiResponse & Record<string, unknown>> {
  try {
    const res = await fetch(apiUrl(path), {
      method: 'POST',
      credentials: API_BASE ? 'include' : 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    return (await parse(res)) as ApiResponse & Record<string, unknown>
  } catch {
    return { ok: false, error: 'Cannot reach the server. Check your connection.' }
  }
}
