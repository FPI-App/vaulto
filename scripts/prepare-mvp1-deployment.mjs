import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
export const PROJECT = 'pqxvttkyevbkfdhmcmxu'
const expected = ['0001', '0002', '0003', '0004', '0005']
const quote = (text) => `'${text.replaceAll("'", "''")}'`

/** Solo prepara SQL revisable; no conecta ni ejecuta migraciones. */
export function prepareDeployment() {
  const files = readdirSync(resolve(root, 'supabase/migrations')).filter((name) => /^00(?:0[6-9]|1[0-6])_.+\.sql$/.test(name)).sort()
  if (files.length !== 11 || files.some((file, index) => Number(file.slice(0, 4)) !== index + 6)) throw Error('La secuencia de migraciones no es la prevista')
  const migrations = files.map((file) => ({ file, source: readFileSync(resolve(root, 'supabase/migrations', file), 'utf8') }))
  const guard = `BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtextextended('vaulto:mvp1:migrations', 0));
DO $guard$
BEGIN
  IF (SELECT array_agg(version ORDER BY version)::text[] FROM supabase_migrations.schema_migrations)
     IS DISTINCT FROM ARRAY[${expected.map(quote).join(',')}]::text[] THEN
    RAISE EXCEPTION 'Historial remoto diferente: no se aplica el despliegue';
  END IF;
END;
$guard$;
`
  const body = migrations.map(({ file, source }) => {
    const version = file.slice(0, 4)
    const name = file.slice(5, -4)
    return `-- Fuente: supabase/migrations/${file}\n${source}\nINSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES (${quote(version)}, ${quote(name)}, ARRAY[${quote(source)}]);`
  }).join('\n\n')
  const sql = `${guard}\n${body}\nNOTIFY pgrst, 'reload schema';\nCOMMIT;\nSELECT version FROM supabase_migrations.schema_migrations ORDER BY version;\n`
  const manifest = {
    project: PROJECT,
    expectedVersions: expected,
    finalVersions: [...expected, ...migrations.map(({ file }) => file.slice(0, 4))],
    sha256: createHash('sha256').update(sql).digest('hex'),
    migrations: migrations.map(({ file, source }) => ({ file, sha256: createHash('sha256').update(source).digest('hex') })),
  }
  return { sql, manifest }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { sql, manifest } = prepareDeployment()
  mkdirSync(resolve(root, '.cache/qa'), { recursive: true })
  mkdirSync(resolve(root, 'docs/validaciones/2026-10-29'), { recursive: true })
  writeFileSync(resolve(root, '.cache/qa/deploy-mvp1.sql'), sql)
  writeFileSync(resolve(root, 'docs/validaciones/2026-10-29/despliegue-manifiesto.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(JSON.stringify({ prepared: true, executed: false, file: '.cache/qa/deploy-mvp1.sql', ...manifest }))
}
