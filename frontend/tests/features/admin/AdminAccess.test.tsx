import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../../../src/App'
import { isAdminLoggedIn, loginAdmin, logoutAdmin } from '../../../src/features/admin/adminSession'
import { FakeEventSource } from '../../setup'

vi.mock('../../../src/api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/api/client')>()
  return {
    ...original,
    api: {
      airports: { list: vi.fn() },
      flights: { search: vi.fn(), seatSnapshot: vi.fn() },
      reservations: { getByCode: vi.fn() },
      admin: { lockStages: vi.fn(), cancelFlight: vi.fn() }
    }
  }
})

import { api } from '../../../src/api/client'

type Entry = string | { pathname: string; state?: unknown }

function renderAt(entry: Entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
    </MemoryRouter>
  )
}

const login = (user = 'admin', password = 'admin') => {
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: user } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
}

beforeEach(() => {
  FakeEventSource.reset()
  logoutAdmin()
  sessionStorage.clear()
  vi.mocked(api.airports.list).mockResolvedValue([
    { code: 'BOG', name: 'El Dorado', city: 'Bogotá', timezone: 'America/Bogota' },
    { code: 'MDE', name: 'José María Córdova', city: 'Medellín', timezone: 'America/Bogota' }
  ])
  vi.mocked(api.flights.search).mockResolvedValue([])
  // A public screen that never finishes loading is enough for these tests
  vi.mocked(api.reservations.getByCode).mockReturnValue(new Promise(() => undefined))
  vi.mocked(api.flights.seatSnapshot).mockReturnValue(new Promise(() => undefined))
  vi.mocked(api.admin.lockStages).mockReturnValue(new Promise(() => undefined))
})

describe('the login screen', () => {
  it('shows the title, the subtitle and both fields, without the connection indicator or admin links', () => {
    renderAt('/admin/login')

    expect(screen.getByRole('heading', { name: 'Acceso administrativo' })).toBeInTheDocument()
    expect(screen.getByText('Solo para el equipo de operaciones')).toBeInTheDocument()
    expect(screen.getByLabelText('Usuario')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(document.querySelector('.connection')).toBeNull()
  })

  it('starts with the cursor in the user field', () => {
    renderAt('/admin/login')
    expect(document.activeElement).toBe(screen.getByLabelText('Usuario'))
  })

  it('never shows the credentials on screen', () => {
    renderAt('/admin/login')
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/admin\s*[/:,]\s*admin/i)
    expect(text).not.toMatch(/contraseña\s*[:=]/i)
    expect(document.querySelector('input[placeholder]')).toBeNull()
  })

  it('a wrong password shows one message, empties the password and puts the cursor there', async () => {
    renderAt('/admin/login')
    login('admin', 'nope')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Usuario o contraseña incorrectos')
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    expect(screen.getByLabelText('Usuario')).toHaveValue('admin')
    expect(document.activeElement).toBe(screen.getByLabelText('Contraseña'))
    expect(isAdminLoggedIn()).toBe(false)
  })

  it('says exactly the same for a wrong user, a wrong password and an empty form', async () => {
    renderAt('/admin/login')

    const messages: string[] = []
    for (const [user, password] of [
      ['root', 'admin'],
      ['admin', 'nope'],
      ['', '']
    ]) {
      login(user, password)
      messages.push((await screen.findByRole('alert')).textContent ?? '')
    }

    expect(new Set(messages)).toEqual(new Set(['Usuario o contraseña incorrectos']))
  })

  it('has no error message before the first attempt', () => {
    renderAt('/admin/login')
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
  })
})

describe('the guard and where you land after signing in', () => {
  it.each(['/admin/dashboard', '/admin/dashboard/4c438a42', '/admin/flights', '/admin', '/admin/anything'])(
    'sends an unauthenticated visitor of %s to the login',
    (path) => {
      renderAt(path)
      expect(screen.getByRole('heading', { name: 'Acceso administrativo' })).toBeInTheDocument()
    }
  )

  it('after signing in it returns to the screen that was requested', async () => {
    renderAt('/admin/dashboard')
    login()

    expect(await screen.findByRole('heading', { name: 'Dashboard de ocupación' })).toBeInTheDocument()
    expect(isAdminLoggedIn()).toBe(true)
  })

  it('returns to a screen with parameters too', async () => {
    renderAt('/admin/dashboard/4c438a42-c0fc-4626-b04a-f5c0eef8dc5d')
    login()
    expect(await screen.findByRole('status', { name: 'Cargando el dashboard…' })).toBeInTheDocument()
  })

  it('coming straight to the login, it lands on the dashboard', async () => {
    renderAt('/admin/login')
    login()
    expect(await screen.findByRole('heading', { name: 'Dashboard de ocupación' })).toBeInTheDocument()
  })

  it('a crafted return address cannot send the user anywhere else', async () => {
    renderAt({ pathname: '/admin/login', state: { from: 'https://evil.example/steal' } })
    login()
    expect(await screen.findByRole('heading', { name: 'Dashboard de ocupación' })).toBeInTheDocument()
  })

  it('a signed-in visitor of the login goes straight in', () => {
    loginAdmin('admin', 'admin')
    renderAt('/admin/login')
    expect(screen.getByRole('heading', { name: 'Dashboard de ocupación' })).toBeInTheDocument()
  })

  it('/admin leads a signed-in user to the dashboard', () => {
    loginAdmin('admin', 'admin')
    renderAt('/admin')
    expect(screen.getByRole('heading', { name: 'Dashboard de ocupación' })).toBeInTheDocument()
  })

  it('an unknown admin address gets the admin not-found, not the public one', () => {
    loginAdmin('admin', 'admin')
    renderAt('/admin/nothing-here')
    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegación administrativa' })).toBeInTheDocument()
  })

  it('the session persists across a page reload', () => {
    loginAdmin('admin', 'admin')
    const first = renderAt('/admin/dashboard')
    first.unmount()

    renderAt('/admin/dashboard')
    expect(screen.getByRole('heading', { name: 'Dashboard de ocupación' })).toBeInTheDocument()
  })
})

describe('the admin frame', () => {
  it('has its own header with Dashboard, Simulación and Salir, and marks the current section', () => {
    loginAdmin('admin', 'admin')
    renderAt('/admin/dashboard')

    const nav = screen.getByRole('navigation', { name: 'Navegación administrativa' })
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Simulación' })).not.toHaveAttribute('aria-current')
    expect(within(nav).getByRole('button', { name: 'Salir' })).toBeInTheDocument()
    expect(document.querySelector('.connection')).not.toBeNull()
  })

  it('the Dashboard section stays marked on a flight\'s dashboard', () => {
    loginAdmin('admin', 'admin')
    renderAt('/admin/dashboard/4c438a42')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  })

  it('moves between sections', async () => {
    loginAdmin('admin', 'admin')
    renderAt('/admin/dashboard')
    fireEvent.click(screen.getByRole('link', { name: 'Simulación' }))
    expect(await screen.findByRole('heading', { name: 'Simulación de vuelos' })).toBeInTheDocument()
  })

  it('Salir ends the session and returns to the login, which the guard then enforces again', async () => {
    loginAdmin('admin', 'admin')
    renderAt('/admin/flights')
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))

    expect(await screen.findByRole('heading', { name: 'Acceso administrativo' })).toBeInTheDocument()
    expect(isAdminLoggedIn()).toBe(false)
    expect(sessionStorage.getItem('admin-session')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Navegación administrativa' })).not.toBeInTheDocument()
  })

  it('cannot be reached with the browser Back button after leaving', async () => {
    loginAdmin('admin', 'admin')
    const view = renderAt('/admin/flights')
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    await screen.findByRole('heading', { name: 'Acceso administrativo' })
    view.unmount()

    renderAt('/admin/flights')
    expect(screen.getByRole('heading', { name: 'Acceso administrativo' })).toBeInTheDocument()
  })
})

describe('the public interface', () => {
  it('has no link to the admin area', async () => {
    renderAt('/')
    await waitFor(() => expect(api.airports.list).toHaveBeenCalled())

    const links = [...document.querySelectorAll('a')].map((link) => link.getAttribute('href') ?? '')
    expect(links.some((href) => href.includes('/admin'))).toBe(false)
    expect(document.body.textContent).not.toMatch(/administrativ|admin/i)
  })

  it('does not show the admin navigation on a public screen even with a session open', () => {
    loginAdmin('admin', 'admin')
    renderAt('/booking/ABC234')
    expect(screen.queryByRole('navigation', { name: 'Navegación administrativa' })).not.toBeInTheDocument()
  })
})
