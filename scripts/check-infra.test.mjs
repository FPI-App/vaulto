import { test } from 'node:test'
import assert from 'node:assert/strict'

import { probeEnvironment, validateEnvironment } from './check-infra.mjs'

const env = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture',
  EXPO_PUBLIC_POWERSYNC_URL: 'https://example.powersync.test',
}

test('detecta variables faltantes sin imprimir valores', () => {
  assert.equal(validateEnvironment({}).length, 3)
  assert.deepEqual(validateEnvironment(env), [])
})
test('acepta la publishable que escribe EAS por encima de una anon antigua', () => {
  const configured = { ...env, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-antiguo', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' }
  assert.deepEqual(validateEnvironment(configured), [])
})
test('rechaza secretos y JWT service_role en la configuración cliente', () => {
  for (const key of ['sb_secret_fixture', `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`]) {
    const issues = validateEnvironment({ ...env, EXPO_PUBLIC_SUPABASE_ANON_KEY: key })
    assert.equal(issues.length, 1)
    assert.ok(!issues.join().includes(key))
  }
})
test('admite una anon legacy y URLs HTTP solo de red local', () => {
  const anon = `header.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.signature`
  assert.deepEqual(validateEnvironment({ ...env, EXPO_PUBLIC_SUPABASE_ANON_KEY: anon, EXPO_PUBLIC_POWERSYNC_URL: 'http://192.168.1.20:8085' }), [])
  assert.equal(validateEnvironment({ ...env, EXPO_PUBLIC_POWERSYNC_URL: 'http://example.com' }).length, 1)
})
test('rechaza URLs con credenciales y placeholders', () => {
  for (const url of ['https://user:pass@example.com', 'https://TU_PROYECTO.supabase.co', 'https://example.com?token=fixture']) {
    assert.equal(validateEnvironment({ ...env, EXPO_PUBLIC_SUPABASE_URL: url }).length, 1)
  }
})
test('un chequeo con configuración inválida no llama a la red', async () => {
  let called = false
  const result = await probeEnvironment({}, async () => { called = true })
  assert.equal(result.ok, false)
  assert.equal(called, false)
})
test('consulta salud y liveness sin imprimir respuestas o claves', async () => {
  const urls = []
  const result = await probeEnvironment(env, async (url) => {
    urls.push(url.pathname)
    return new Response('contenido privado de prueba', { status: 200 })
  })
  assert.equal(result.ok, true)
  assert.deepEqual(urls, ['/auth/v1/health', '/probes/liveness'])
  assert.ok(!result.lines.join().includes(env.EXPO_PUBLIC_SUPABASE_ANON_KEY))
  assert.ok(!result.lines.join().includes('contenido privado'))
})
test('los fallos de red se sanitizan y los HTTP fallidos no se declaran saludables', async () => {
  const failed = await probeEnvironment(env, async () => { throw new Error('Authorization: dato-sensible-de-prueba') })
  assert.equal(failed.ok, false)
  assert.ok(!failed.lines.join().includes('dato-sensible'))
  const http = await probeEnvironment(env, async () => new Response('', { status: 503 }))
  assert.equal(http.ok, false)
  assert.ok(http.lines.every((line) => line.includes('503')))
})
