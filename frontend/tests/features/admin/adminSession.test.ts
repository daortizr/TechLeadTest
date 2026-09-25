import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  DEFAULT_ADMIN_PATH,
  isAdminLoggedIn,
  loginAdmin,
  logoutAdmin,
  safeAdminPath
} from '../../../src/features/admin/adminSession'

beforeEach(() => {
  logoutAdmin()
  sessionStorage.clear()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('loginAdmin', () => {
  it('opens the session with the right credentials', () => {
    expect(loginAdmin('admin', 'admin')).toBe(true)
    expect(isAdminLoggedIn()).toBe(true)
  })

  it.each([
    ['wrong password', 'admin', 'nope'],
    ['wrong user', 'root', 'admin'],
    ['both wrong', 'root', 'nope'],
    ['empty', '', ''],
    ['user only', 'admin', ''],
    ['different case', 'ADMIN', 'ADMIN'],
    ['password with a trailing space', 'admin', 'admin ']
  ])('rejects %s and opens no session', (_name, user, password) => {
    expect(loginAdmin(user, password)).toBe(false)
    expect(isAdminLoggedIn()).toBe(false)
  })

  it('ignores spaces around the user name, never around the password', () => {
    expect(loginAdmin('  admin ', 'admin')).toBe(true)
  })

  it('keeps the session only in this tab: sessionStorage, never localStorage', () => {
    loginAdmin('admin', 'admin')
    expect(sessionStorage.getItem('admin-session')).toBe('1')
    expect(localStorage.length).toBe(0)
  })

  it('logout ends the session', () => {
    loginAdmin('admin', 'admin')
    logoutAdmin()
    expect(isAdminLoggedIn()).toBe(false)
    expect(sessionStorage.getItem('admin-session')).toBeNull()
  })

  it('a session survives a reload of the page (it is read from storage)', () => {
    loginAdmin('admin', 'admin')
    expect(sessionStorage.getItem('admin-session')).toBe('1')
    expect(isAdminLoggedIn()).toBe(true)
  })
})

describe('when storage is blocked', () => {
  it('still works from memory for the life of the page', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(loginAdmin('admin', 'admin')).toBe(true)
    expect(isAdminLoggedIn()).toBe(true)
    expect(warn).toHaveBeenCalled()

    logoutAdmin()
    expect(isAdminLoggedIn()).toBe(false)
  })
})

describe('safeAdminPath', () => {
  it('accepts the admin screens, with their parameters', () => {
    expect(safeAdminPath('/admin/dashboard')).toBe('/admin/dashboard')
    expect(safeAdminPath('/admin/dashboard/4c438a42-c0fc-4626-b04a-f5c0eef8dc5d')).toBe(
      '/admin/dashboard/4c438a42-c0fc-4626-b04a-f5c0eef8dc5d'
    )
    expect(safeAdminPath('/admin/flights?origin=BOG&date=2026-09-25')).toBe('/admin/flights?origin=BOG&date=2026-09-25')
  })

  it.each([
    ['nothing', undefined],
    ['a non-string', 42],
    ['the admin root', '/admin'],
    ['the login itself', '/admin/login'],
    ['the login with a query', '/admin/login?x=1'],
    ['another site', 'https://evil.example/admin/flights'],
    ['a protocol-relative URL', '//evil.example'],
    ['a public screen', '/flights/abc'],
    ['a path that climbs out', '/admin/../secret'],
    ['a double slash', '/admin//x'],
    ['a script URL', 'javascript:alert(1)']
  ])('falls back to the default screen for %s', (_name, candidate) => {
    expect(safeAdminPath(candidate)).toBe(DEFAULT_ADMIN_PATH)
  })
})
