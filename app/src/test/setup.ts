import { vi } from 'vitest'

vi.mock('expo-crypto', async () => {
  const { randomUUID } = await import('node:crypto')
  return { randomUUID }
})
