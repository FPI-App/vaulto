import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseEnv } from 'node:util'

const variables = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_POWERSYNC_URL']
const keyField = 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o EXPO_PUBLIC_SUPABASE_ANON_KEY)'
const clientKey = (env) => env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || ''

function validEndpoint(value) {
  try {
    const url = new URL(value)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)
    return (url.protocol === 'https:' || (local && url.protocol === 'http:'))
      && !url.username && !url.password && !url.search && !url.hash
      && !/TU_PROYECTO|TU_INSTANCIA/i.test(value)
  } catch { return false }
}

function publicKey(value) {
  if (/^sb_publishable_[a-z0-9_-]+$/i.test(value)) return true
  try {
    const [, payload] = value.split('.')
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).role === 'anon'
  } catch { return false }
}

export function validateEnvironment(env) {
  const issues = []
  for (const name of variables) {
    if (!env[name]?.trim()) issues.push(`${name}: falta configurar`)
  }
  if (!clientKey(env)) issues.push(`${keyField}: falta configurar`)
  for (const name of variables) {
    if (env[name] && !validEndpoint(env[name])) issues.push(`${name}: URL inválida; usa HTTPS remoto o HTTP de red local`)
  }
  if (clientKey(env) && !publicKey(clientKey(env))) {
    issues.push(`${keyField}: requiere publishable o anon; no uses secret ni service_role`)
  }
  return issues
}

export async function probeEnvironment(env, request = fetch) {
  const issues = validateEnvironment(env)
  if (issues.length) return { ok: false, lines: issues }
  const checks = [
    { name: 'Supabase Auth', base: env.EXPO_PUBLIC_SUPABASE_URL, route: 'auth/v1/health', headers: { apikey: clientKey(env) } },
    { name: 'PowerSync liveness', base: env.EXPO_PUBLIC_POWERSYNC_URL, route: 'probes/liveness', headers: {} },
  ]
  const results = await Promise.all(checks.map(async (check) => {
    try {
      const url = new URL(check.route, `${check.base.replace(/\/$/, '')}/`)
      const response = await request(url, { headers: check.headers, signal: AbortSignal.timeout(5000), redirect: 'error' })
      await response.body?.cancel()
      return { ok: response.ok, line: `${check.name}: HTTP ${response.status}${response.ok ? ' OK' : ' (revisar servicio)'}` }
    } catch {
      // No imprimir excepciones de red: pueden incluir URL, cabeceras o tokens.
      return { ok: false, line: `${check.name}: no se pudo completar la conexión` }
    }
  }))
  return { ok: results.every((result) => result.ok), lines: results.map((result) => result.line) }
}

async function main() {
  let local = {}
  try {
    for (const filename of ['.env', '.env.local']) {
      const envPath = fileURLToPath(new URL(`../app/${filename}`, import.meta.url))
      if (existsSync(envPath)) local = { ...local, ...parseEnv(readFileSync(envPath, 'utf8')) }
    }
  } catch {
    console.error('No se pudo leer la configuración local; revisa .env y .env.local.')
    process.exitCode = 1
    return
  }
  const result = await probeEnvironment({ ...local, ...process.env })
  for (const line of result.lines) console.log(line)
  console.log('Este chequeo no aplica migraciones ni verifica sesiones, RLS o sync entre dispositivos.')
  process.exitCode = result.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
