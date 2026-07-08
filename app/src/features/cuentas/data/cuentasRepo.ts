// Capa de datos de Cuentas: escrituras contra la SQLite local de PowerSync.
// Toda escritura queda en la cola de sync y sube a Supabase cuando hay red.
// El `updated_at` se setea a mano porque el trigger vive en Postgres, no en la
// réplica local. Borrar = soft delete (deleted_at), nunca DELETE físico.
import type { AbstractPowerSyncDatabase } from '@powersync/react-native'
import * as Crypto from 'expo-crypto'
import type { TipoCuenta } from '@vaulto/shared'

/** Datos que el usuario define de una cuenta (sin campos transversales). */
export interface DatosCuenta {
  nombre: string
  tipo: TipoCuenta
  banco: string | null
  /** Decimal string normalizado (numeric(14,2)). Ver money.normalizarMontoInput. */
  saldo_inicial: string
  /** ISO 4217. MVP: 'COP'. */
  currency?: string
}

/** Crea una cuenta y devuelve su id (UUID generado en cliente). */
export async function crearCuenta(
  db: AbstractPowerSyncDatabase,
  espacioId: string,
  datos: DatosCuenta,
): Promise<string> {
  const id = Crypto.randomUUID()
  const now = new Date().toISOString()
  await db.execute(
    `INSERT INTO cuenta
       (id, espacio_id, nombre, tipo, banco, saldo_inicial, currency, archivada, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
    [id, espacioId, datos.nombre, datos.tipo, datos.banco, datos.saldo_inicial, datos.currency ?? 'COP', now, now],
  )
  return id
}

/** Actualiza los datos editables de una cuenta. */
export async function actualizarCuenta(
  db: AbstractPowerSyncDatabase,
  id: string,
  datos: DatosCuenta,
): Promise<void> {
  await db.execute(
    `UPDATE cuenta SET nombre = ?, tipo = ?, banco = ?, saldo_inicial = ?, updated_at = ?
     WHERE id = ?`,
    [datos.nombre, datos.tipo, datos.banco, datos.saldo_inicial, new Date().toISOString(), id],
  )
}

/** Archiva o desarchiva una cuenta (no la borra: sigue contando en históricos). */
export async function archivarCuenta(
  db: AbstractPowerSyncDatabase,
  id: string,
  archivada: boolean,
): Promise<void> {
  await db.execute('UPDATE cuenta SET archivada = ?, updated_at = ? WHERE id = ?', [
    archivada ? 1 : 0,
    new Date().toISOString(),
    id,
  ])
}

/** Borrado lógico de una cuenta. */
export async function eliminarCuenta(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString()
  await db.execute('UPDATE cuenta SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id])
}
