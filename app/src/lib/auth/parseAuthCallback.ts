export type AuthCallback =
  | { type: 'code'; code: string; isRecovery: boolean }
  | { type: 'otp'; tokenHash: string; otpType: 'email' | 'recovery' }
  | { type: 'session'; accessToken: string; refreshToken: string; isRecovery: boolean }
  | { type: 'error' }

export function parseAuthCallback(url: string): AuthCallback | null {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return null
  }
  const isVaultoScheme = parsedUrl.protocol === 'vaulto:' || parsedUrl.protocol === 'exp+vaulto:'
  const isCallbackRoute =
    (parsedUrl.hostname === 'auth' && parsedUrl.pathname === '/callback') ||
    (parsedUrl.hostname === '' && parsedUrl.pathname === '/auth/callback')

  if (!isVaultoScheme || !isCallbackRoute) return null

  const params = new URLSearchParams(parsedUrl.search)
  const fragmentParams = new URLSearchParams(parsedUrl.hash.slice(1))
  for (const [key, value] of fragmentParams) params.set(key, value)

  if (params.has('error_code') || params.has('error')) return { type: 'error' }

  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const otpType = params.get('type')
  if (tokenHash && (otpType === 'email' || otpType === 'recovery')) {
    return { type: 'otp', tokenHash, otpType }
  }

  const isRecovery = params.get('type') === 'recovery'
  if (code) return { type: 'code', code, isRecovery }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (accessToken && refreshToken) {
    return { type: 'session', accessToken, refreshToken, isRecovery }
  }

  return { type: 'error' }
}
