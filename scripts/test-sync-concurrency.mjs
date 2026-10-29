import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CONTAINER, migrationMarker, validateContainer } from './test-rls-local.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const database = `vaulto_qa_race_${Date.now()}`
const sqlArgs = (db) => ['exec', '-i', CONTAINER, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate',
  '-h', '/var/run/postgresql', '-U', 'postgres', '-d', db, '-f', '-']

function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' })
  if (result.status !== 0 || result.error) throw new Error('Falló una operación sobre el contenedor de pruebas.')
  return result.stdout
}

function startSQL(sql) {
  const child = spawn('docker', sqlArgs(database), { stdio: ['pipe', 'pipe', 'pipe'], timeout: 20_000 })
  let output = ''
  let error = ''
  let resolveReady, rejectReady
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject })
  void ready.catch(() => {})
  const done = new Promise((resolve) => {
    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
      if (output.includes('LOCK_HELD')) resolveReady()
    })
    child.stderr.on('data', (chunk) => { error += chunk.toString() })
    child.on('error', () => { rejectReady(new Error('No se abrió la sesión SQL de prueba.')) })
    child.on('close', (code) => {
      rejectReady(new Error('La sesión terminó antes de adquirir el lock de prueba.'))
      resolve({ code, output, sqlState: error.match(/ERROR:\s+([A-Z0-9]{5})\b/)?.[1] })
    })
  })
  child.stdin.on('error', () => {})
  child.stdin.end(sql)
  return { ready, done }
}

const op = (table, id, kind, data = {}) => ({ table, id, op: kind, data })
const rpc = (key, operations) => `SELECT public.aplicar_lote_sync('${key}', '${JSON.stringify(operations).replace(/'/g, "''")}'::jsonb);`
const jwt = (user) => `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{"sub":"${user}","role":"authenticated"}', true);`

async function race(firstAmount, secondAmount, expectConflict) {
  const [userA, userB, space, debt, paymentA, paymentB] = Array.from({ length: 6 }, () => randomUUID())
  docker(sqlArgs(database), `
    INSERT INTO auth.users(id,email) VALUES ('${userA}','qa-a-${userA}@example.com'), ('${userB}','qa-b-${userB}@example.com');
    INSERT INTO public.espacio(id,nombre,owner_user_id) VALUES ('${space}','QA concurrencia','${userA}');
    INSERT INTO public.espacio_miembro(espacio_id,user_id) VALUES ('${space}','${userA}'), ('${space}','${userB}');
    INSERT INTO public.deuda(id,espacio_id,direccion,contraparte,monto_inicial,saldo_pendiente)
      VALUES ('${debt}','${space}','yo_debo','QA',100,100);
  `)
  const operations = (payment, amount) => [
    op('pago', payment, 'PUT', { espacio_id: space, deuda_id: debt, monto: String(amount), fecha: '2026-01-01T12:00:00Z' }),
    op('deuda', debt, 'PATCH', { saldo_pendiente: String(100 - amount) }),
  ]
  const first = startSQL(`BEGIN; ${jwt(userA)} ${rpc('QA-A:1:2', operations(paymentA, firstAmount))}
    SELECT 'LOCK_HELD'; SELECT pg_sleep(2); SELECT 'RELEASE_AT=' || extract(epoch FROM clock_timestamp()); COMMIT;`)
  await first.ready
  const second = startSQL(`BEGIN; ${jwt(userB)} SELECT 'START_AT=' || extract(epoch FROM clock_timestamp());
    ${rpc('QA-B:1:2', operations(paymentB, secondAmount))} COMMIT;`)
  const [a, b] = await Promise.all([first.done, second.done])
  assert.equal(a.code, 0, 'El primer lote debe confirmar')
  assert.equal(b.code, expectConflict ? 3 : 0, 'Resultado de la segunda sesión')
  if (expectConflict) assert.equal(b.sqlState, '23514')
  const release = Number(a.output.match(/RELEASE_AT=([\d.]+)/)?.[1])
  const start = Number(b.output.match(/START_AT=([\d.]+)/)?.[1])
  assert.ok(Number.isFinite(start) && Number.isFinite(release) && start < release, 'Las sesiones deben solaparse realmente')
  const snapshot = JSON.parse(docker(sqlArgs(database), `
    SELECT jsonb_build_object('payments', (SELECT count(*) FROM public.pago WHERE deuda_id='${debt}'),
      'balance', saldo_pendiente::text, 'state', estado,
      'receipts_b', (SELECT count(*) FROM private.vaulto_sync_lote WHERE user_id='${userB}'))
    FROM public.deuda WHERE id='${debt}';
  `).trim())
  assert.deepEqual(snapshot, expectConflict
    ? { payments: 1, balance: '40.00', state: 'activa', receipts_b: 0 }
    : { payments: 2, balance: '0.00', state: 'saldada', receipts_b: 1 })
  docker(sqlArgs(database), `BEGIN; ${jwt(userA)} ${rpc('QA-A:1:2', operations(paymentA, firstAmount))} COMMIT;`)
  assert.equal(docker(sqlArgs(database), `SELECT count(*) FROM public.pago WHERE deuda_id='${debt}';`).trim(), expectConflict ? '1' : '2')
  console.log(`Concurrencia ${firstAmount}+${secondAmount}: ${expectConflict ? 'sobrepago rechazado sin residuos' : 'saldo final correcto'}; reintento idempotente.`)
}

async function main() {
  validateContainer(JSON.parse(docker(['inspect', CONTAINER]))[0])
  const files = readdirSync(join(root, 'supabase/migrations')).filter((file) => file.endsWith('.sql')).sort()
  const expected = migrationMarker(files.map((file) => readFileSync(join(root, 'supabase/migrations', file), 'utf8')))
  const installed = docker(sqlArgs('vaulto_qa'), "SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database();").trim()
  assert.equal(installed, expected, 'Aplicar primero las migraciones locales actuales')
  assert.match(database, /^vaulto_qa_race_\d{13}$/)
  docker(sqlArgs('postgres'), `CREATE DATABASE ${database} TEMPLATE vaulto_qa;`)
  console.log(`Fixture sintético conservado en ${CONTAINER}/${database}; sin puertos ni conexiones remotas.`)
  await race(60, 60, true)
  await race(40, 60, false)
}

main().catch(() => { console.error('No se verificó la concurrencia. Se conservan las bases de prueba para diagnóstico.'); process.exitCode = 1 })
