import { useSyncExternalStore } from 'react'

// A client-side gate: it hides the admin screens, it protects nothing (architecture.md 10.2).
// The credentials ship in the downloadable code, and the admin API only has a shared key.
// Real authentication would be validated on the server.
const ADMIN_USER = 'admin'
const ADMIN_PASSWORD = 'admin'

const STORAGE_KEY = 'admin-session'

// Fallback when sessionStorage is unavailable (blocked storage, private windows)
let memorySession = false
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Storage blocked: the in-memory flag is the session
    return memorySession
  }
}

function write(active: boolean): void {
  memorySession = active
  try {
    if (active) sessionStorage.setItem(STORAGE_KEY, '1')
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Session storage unavailable, keeping the admin session in memory', error)
  }
  listeners.forEach((listener) => listener())
}

export function isAdminLoggedIn(): boolean {
  return read()
}

// Returns whether the credentials were right. Which part was wrong is never reported.
export function loginAdmin(username: string, password: string): boolean {
  const valid = username.trim() === ADMIN_USER && password === ADMIN_PASSWORD
  if (valid) write(true)
  return valid
}

export function logoutAdmin(): void {
  write(false)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Re-renders when the session changes, in this tab
export function useAdminSession(): boolean {
  return useSyncExternalStore(subscribe, read)
}

const LOGIN_PATH = '/admin/login'
export const DEFAULT_ADMIN_PATH = '/admin/dashboard'

// Where to go after signing in. Only admin screens are accepted, so a crafted link
// cannot bounce the user to another site or back to the login itself.
export function safeAdminPath(candidate: unknown): string {
  if (typeof candidate !== 'string') return DEFAULT_ADMIN_PATH
  const isAdminScreen = /^\/admin(\/[A-Za-z0-9_\-./%]*)?(\?[A-Za-z0-9_\-=&%.]*)?$/.test(candidate)
  const isLogin = candidate === LOGIN_PATH || candidate.startsWith(`${LOGIN_PATH}/`) || candidate.startsWith(`${LOGIN_PATH}?`)
  const escapes = candidate.includes('//') || candidate.includes('..')
  return isAdminScreen && !isLogin && !escapes && candidate !== '/admin' ? candidate : DEFAULT_ADMIN_PATH
}
