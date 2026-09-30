import { useSyncExternalStore } from 'react'
import { getDB, getMe, isReady, subscribeDB, getSession, subscribeSession } from './lib/db'
import type { DB, User } from './lib/types'

export function useDB(): DB {
  return useSyncExternalStore(subscribeDB, getDB, getDB)
}

/** True once the initial server snapshot has been hydrated. */
export function useReady(): boolean {
  return useSyncExternalStore(subscribeDB, isReady, isReady)
}

export function useSessionUserId(): string | null {
  return useSyncExternalStore(subscribeSession, () => getSession()?.userId ?? null, () => getSession()?.userId ?? null)
}

/** The server-verified current user (from the session cookie), or null. */
export function useCurrentUser(): User | null {
  return useSyncExternalStore(subscribeDB, getMe, getMe)
}

export function useWallet(userId: string | undefined) {
  const db = useDB()
  if (!userId) return undefined
  return db.wallets.find((w) => w.userId === userId)
}
