import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CONTAINER, migrationMarker, pendingMigrations, validateContainer, validateTap } from './test-rls-local.mjs'

const fixture = () => ({
  Name: `/${CONTAINER}`, Config: { Image: 'postgres:15-bookworm', Labels: { 'com.vaulto.purpose': 'local-rls' } },
  State: { Running: true }, HostConfig: { PortBindings: {} },
})

test('solo acepta el contenedor etiquetado, activo y sin puertos publicados', () => {
  assert.doesNotThrow(() => validateContainer(fixture()))
  for (const modify of [
    (c) => { c.Name = '/otro' },
    (c) => { c.Config.Labels = {} },
    (c) => { c.State.Running = false },
    (c) => { c.Config.Image = 'postgres:17' },
    (c) => { c.HostConfig.PortBindings = { '5432/tcp': [] } },
  ]) {
    const container = fixture()
    modify(container)
    assert.throws(() => validateContainer(container))
  }
})

test('no confunde salida psql sin errores con una suite pgTAP aprobada', () => {
  assert.equal(validateTap('1..2\nok 1 - acceso\nok 2 - aislamiento\n'), 2)
  for (const output of ['1..2\nok 1\n', '1..1\nnot ok 1\n', '1..0', '1..0\n# Looks like no tests\n', 'BEGIN\nROLLBACK', '1..1\nok 1\nBail out!']) {
    assert.throws(() => validateTap(output))
  }
})

test('solo aplica migraciones añadidas, nunca reconstruye una base divergente', () => {
  const initial = ['primera', 'segunda']
  const marker = migrationMarker(initial)
  assert.deepEqual(pendingMigrations(marker, [...initial, 'tercera']), ['tercera'])
  assert.deepEqual(pendingMigrations(marker, initial), [])
  assert.throws(() => pendingMigrations(marker, ['primera-modificada', 'segunda', 'tercera']))
  assert.throws(() => pendingMigrations('ajeno', initial))
})
