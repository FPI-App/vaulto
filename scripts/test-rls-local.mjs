import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CONTAINER = 'vaulto-qa-pg-20261028'
const DATABASE = 'vaulto_qa'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function validateContainer(container) {
  if (container.Name !== `/${CONTAINER}` || container.Config?.Labels?.['com.vaulto.purpose'] !== 'local-rls') {
    throw new Error('El destino no es el contenedor de pruebas de Vaulto.')
  }
  if (container.Config.Image !== 'postgres:15-bookworm' || !container.State?.Running) {
    throw new Error('Se requiere el PostgreSQL 15 de pruebas en ejecución.')
  }
  if (Object.keys(container.HostConfig?.PortBindings ?? {}).length) {
    throw new Error('El contenedor de pruebas no debe publicar puertos.')
  }
}

function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  if (result.status !== 0 || result.error) {
    // Nunca volcar inspect/env ni respuestas externas que puedan contener credenciales.
    const sqlState = result.stderr?.match(/ERROR:\s+([A-Z0-9]{5})\b/)?.[1]
    throw new Error(`Falló Docker/psql en el contenedor de pruebas${sqlState ? ` (SQLSTATE ${sqlState})` : ''}. No se consultó ningún servidor remoto.`)
  }
  return result.stdout
}

function sql(input, transaction = false) {
  return docker(['exec', '-i', CONTAINER, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate',
    '-h', '/var/run/postgresql', '-U', 'postgres', '-d', DATABASE,
    ...(transaction ? ['--single-transaction'] : []), '-f', '-'], input)
}

export function validateTap(output) {
  const lines = output.split(/\r?\n/).map((line) => line.trim())
  const plan = lines.find((line) => /^1\.\.\d+$/.test(line))
  const assertions = lines.filter((line) => /^(?:not )?ok \d+\b/.test(line))
  if (!plan || assertions.length === 0 || Number(plan.slice(3)) !== assertions.length || lines.some((line) => /^(not ok\b|Bail out!|# Looks like)/.test(line))) {
    throw new Error('La salida pgTAP contiene fallos, plan incompleto o ninguna prueba.')
  }
  return assertions.length
}

const bootstrap = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth, public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE EXTENSION pgtap;
`

export function migrationMarker(contents) {
  return `vaulto-qa:${createHash('sha256').update(contents.join('\n')).digest('hex')}`
}

export function pendingMigrations(installed, contents) {
  for (let count = contents.length; count > 0; count--) {
    if (installed === migrationMarker(contents.slice(0, count))) return contents.slice(count)
  }
  throw new Error('La versión instalada no es un prefijo conocido. La base se conserva sin reset.')
}

export function main(mode = '--check') {
  if (!['--check', '--apply-migrations', '--test'].includes(mode)) throw new Error('Modo no admitido.')
  validateContainer(JSON.parse(docker(['inspect', CONTAINER]))[0])
  const files = readdirSync(join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()
  const contents = files.map((name) => readFileSync(join(root, 'supabase/migrations', name), 'utf8'))
  const marker = migrationMarker(contents)
  const installed = sql("SELECT coalesce(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname = current_database();").trim()
  if (mode === '--check') {
    console.log(`Destino: ${CONTAINER}/${DATABASE}; puertos publicados: ninguno; esquema actualizado: ${installed === marker}`)
    console.log(`pgTAP disponible: ${sql("SELECT count(*) FROM pg_available_extensions WHERE name = 'pgtap';").trim() === '1'}`)
    return
  }
  if (installed !== marker) {
    if (mode !== '--apply-migrations') throw new Error('Las migraciones de pruebas requieren aprobación y aplicación explícitas.')
    let pending
    let initialize = ''
    if (installed) {
      pending = pendingMigrations(installed, contents)
    } else {
      const occupied = sql("SELECT count(*) FROM information_schema.tables WHERE table_schema IN ('auth', 'public', 'private');").trim()
      if (occupied !== '0') throw new Error('La base ya contiene tablas. Se conserva intacta; no se hace reset.')
      initialize = bootstrap
      pending = contents
    }
    sql(`${initialize}\n${pending.join('\n')}\nCOMMENT ON DATABASE ${DATABASE} IS '${marker}';`, true)
    console.log(`Aplicadas ${pending.length} migraciones pendientes únicamente en ${CONTAINER}/${DATABASE}.`)
  }
  let count = 0
  for (const file of readdirSync(join(root, 'supabase/tests')).filter((name) => name.endsWith('.test.sql')).sort()) {
    const output = sql(readFileSync(join(root, 'supabase/tests', file), 'utf8'))
    count += validateTap(output)
    console.log(`${file}: correcto`)
  }
  console.log(`${count} aserciones pgTAP correctas; fixtures revertidos por los tests.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv[2]) } catch (error) {
    console.error(error instanceof Error ? error.message : 'No se completaron las pruebas locales.')
    process.exitCode = 1
  }
}
