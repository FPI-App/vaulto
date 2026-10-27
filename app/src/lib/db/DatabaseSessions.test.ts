import { describe, expect, it, vi } from 'vitest'

import { DatabaseSessions } from './DatabaseSessions'

describe('Ciclo de vida de las bases locales', () => {
  it('comparte conexión entre leases de la misma cuenta y cierra al soltar el último', async () => {
    const close = vi.fn(async () => {})
    const open = vi.fn(async () => ({ close }))
    const manager = new DatabaseSessions(open)
    const [first, second] = await Promise.all([manager.acquire('a'), manager.acquire('a')])
    expect(first.database).toBe(second.database)
    await first.release()
    expect(close).not.toHaveBeenCalled()
    await second.release()
    await second.release()
    expect(close).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledTimes(1)
  })
  it('cierra la cuenta anterior antes de abrir la nueva y un cleanup tardío no cierra la nueva', async () => {
    const events: string[] = []
    const manager = new DatabaseSessions(async (id) => {
      events.push(`open:${id}`)
      return { close: async () => { events.push(`close:${id}`) } }
    })
    const old = await manager.acquire('a')
    const current = await manager.acquire('b')
    await old.release()
    expect(events).toEqual(['open:a', 'close:a', 'open:b'])
    await current.release()
    expect(events.at(-1)).toBe('close:b')
  })
  it('si no puede cerrar la conexión anterior, impide abrir otra cuenta', async () => {
    const close = vi.fn(async () => { throw new Error('cierre fallido') })
    const open = vi.fn(async () => ({ close }))
    const manager = new DatabaseSessions(open)
    await manager.acquire('a')
    await expect(manager.acquire('b')).rejects.toThrow('cierre fallido')
    expect(open).toHaveBeenCalledTimes(1)
  })
  it('un fallo al abrir no bloquea los siguientes intentos', async () => {
    const open = vi.fn().mockRejectedValueOnce(new Error('fallo')).mockResolvedValue({ close: async () => {} })
    const manager = new DatabaseSessions(open)
    await expect(manager.acquire('a')).rejects.toThrow('fallo')
    const lease = await manager.acquire('a')
    await lease.release()
    expect(open).toHaveBeenCalledTimes(2)
  })
})
