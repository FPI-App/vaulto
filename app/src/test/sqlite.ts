import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

import type { DatabaseWriter, QueryExecutor } from '@/lib/db/DatabaseWriter'

function sqlParameters(values: unknown[] = []): SQLInputValue[] {
  return values.map((value) => {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || value instanceof Uint8Array) return value
    throw new Error('Parámetro SQLite no admitido en la prueba')
  })
}

/** SQLite real en memoria; no abre ni escribe archivos de usuario. */
export function testDatabase() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`
    CREATE TABLE espacio (id TEXT PRIMARY KEY, nombre TEXT, owner_user_id TEXT, base_currency TEXT,
      country TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
    CREATE TABLE espacio_miembro (id TEXT PRIMARY KEY, espacio_id TEXT, user_id TEXT, rol TEXT,
      created_at TEXT, updated_at TEXT, deleted_at TEXT);
    CREATE TABLE perfil (id TEXT PRIMARY KEY, espacio_id TEXT, nombre TEXT, apellido TEXT, username TEXT UNIQUE,
      foto_url TEXT, descripcion TEXT, ocupacion TEXT, country TEXT, onboarding_completo INTEGER,
      created_at TEXT, updated_at TEXT, deleted_at TEXT);
    CREATE TABLE deuda (id TEXT PRIMARY KEY, espacio_id TEXT, direccion TEXT, contraparte TEXT,
      monto_inicial TEXT, saldo_pendiente TEXT, currency TEXT, fecha_limite TEXT, prioridad INTEGER,
      estado TEXT, nota TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
    CREATE TABLE pago (id TEXT PRIMARY KEY, espacio_id TEXT, deuda_id TEXT, monto TEXT, currency TEXT,
      fecha TEXT, nota TEXT, movimiento_id TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
  `)
  const queries: QueryExecutor = {
    async execute(sql, parameters) { return sqlite.prepare(sql).run(...sqlParameters(parameters)) },
    async getOptional<T>(sql: string, parameters?: unknown[]) {
      return (sqlite.prepare(sql).get(...sqlParameters(parameters)) as T | undefined) ?? null
    },
    async getAll<T>(sql: string, parameters?: unknown[]) {
      return sqlite.prepare(sql).all(...sqlParameters(parameters)) as T[]
    },
  }
  const db: DatabaseWriter = {
    execute: queries.execute,
    async writeTransaction<T>(callback: (tx: QueryExecutor) => Promise<T>): Promise<T> {
      sqlite.exec('BEGIN')
      try {
        const result = await callback(queries)
        sqlite.exec('COMMIT')
        return result
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  }
  return { db, queries, sqlite, close: () => sqlite.close() }
}
