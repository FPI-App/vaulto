import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { prepareDeployment, PROJECT } from './prepare-mvp1-deployment.mjs'

test('prepara una sola transacción con historial esperado y todas las migraciones pendientes', () => {
  const { sql, manifest } = prepareDeployment()
  assert.equal(PROJECT, 'pqxvttkyevbkfdhmcmxu')
  assert.equal(manifest.migrations.length, 11)
  assert.deepEqual(manifest.finalVersions, Array.from({ length: 16 }, (_, index) => String(index + 1).padStart(4, '0')))
  assert.ok(sql.startsWith('BEGIN;'))
  assert.match(sql, /IS DISTINCT FROM ARRAY\['0001','0002','0003','0004','0005'\]::text\[\]/)
  assert.equal((sql.match(/^COMMIT;/gm) ?? []).length, 1)
  assert.equal((sql.match(/^INSERT INTO supabase_migrations\.schema_migrations/gm) ?? []).length, 11)
  assert.equal(createHash('sha256').update(sql).digest('hex'), manifest.sha256)
  assert.doesNotMatch(sql, /\b(?:DROP TABLE|DROP SCHEMA|DELETE FROM|TRUNCATE TABLE)\b/i)
})
