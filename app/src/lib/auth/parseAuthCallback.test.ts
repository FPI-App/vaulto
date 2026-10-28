import { describe, expect, it } from 'vitest'

import { parseAuthCallback } from './parseAuthCallback'

describe('parseAuthCallback', () => {
  it('extrae un código PKCE del callback nativo permitido', () => {
    expect(parseAuthCallback('vaulto://auth/callback?code=one-time-code')).toEqual({
      type: 'code',
      code: 'one-time-code',
      isRecovery: false,
    })
  })

  it('acepta sesiones de confirmaciones ya emitidas en el fragmento', () => {
    expect(parseAuthCallback('vaulto://auth/callback#access_token=access&refresh_token=refresh')).toEqual({
      type: 'session',
      accessToken: 'access',
      refreshToken: 'refresh',
      isRecovery: false,
    })
  })

  it('admite el callback de desarrollo con esquema exp+vaulto', () => {
    expect(parseAuthCallback('exp+vaulto://auth/callback?code=one-time-code')).toEqual({
      type: 'code',
      code: 'one-time-code',
      isRecovery: false,
    })
  })

  it('acepta token_hash de confirmación PKCE', () => {
    expect(parseAuthCallback('vaulto://auth/callback?token_hash=one-time-hash&type=email')).toEqual({
      type: 'otp',
      tokenHash: 'one-time-hash',
      otpType: 'email',
    })
  })

  it('acepta token_hash de recuperación PKCE', () => {
    expect(parseAuthCallback('vaulto://auth/callback?token_hash=one-time-hash&type=recovery')).toEqual({
      type: 'otp',
      tokenHash: 'one-time-hash',
      otpType: 'recovery',
    })
  })

  it('ignora enlaces de otras rutas y esquemas', () => {
    expect(parseAuthCallback('vaulto://movimientos/123?code=not-auth')).toBeNull()
    expect(parseAuthCallback('https://example.com/auth/callback?code=not-native')).toBeNull()
  })

  it('reconoce errores del callback sin conservar detalles de la URL', () => {
    expect(parseAuthCallback('vaulto://auth/callback?error=access_denied&error_description=expired')).toEqual({ type: 'error' })
  })

  it('detecta callbacks de recuperación de contraseña', () => {
    expect(parseAuthCallback('vaulto://auth/callback?code=one-time-code&type=recovery')).toEqual({
      type: 'code',
      code: 'one-time-code',
      isRecovery: true,
    })
  })
})
