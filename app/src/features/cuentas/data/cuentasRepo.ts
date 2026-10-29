// Capa de datos de Cuentas: escrituras contra la SQLite local de PowerSync.
// Toda escritura queda en la cola de sync y sube a Supabase cuando hay red.
// El `updated_at` se setea a mano porque el trigger vive en Postgres, no en la
// réplica local. Borrar = soft delete (deleted_at), nunca DELETE físico.
import * as Crypto from 'expo-crypto'
import { aCentavos, desdeCentavos } from '@vaulto/shared/domain'
import type { TipoCuenta } from '@vaulto/shared/types'

import type { DatabaseWriter } from '@/lib/db/DatabaseWriter'

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

function normalizarDatos(datos: DatosCuenta): DatosCuenta {
  if (!datos.nombre.trim() || !['banco', 'efectivo'].includes(datos.tipo)) {
    throw new Error('Indica un nombre y un tipo de cuenta válidos')
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(datos.saldo_inicial)) {
    throw new Error('El saldo inicial debe tener como máximo dos decimales')
  }
  const centavos = aCentavos(datos.saldo_inicial)
  if (!Number.isSafeInteger(centavos) || Math.abs(centavos) > 10 ** 14 - 1) {
    throw new RangeError('El saldo inicial supera el monto permitido')
  }
  const currency = datos.currency ?? 'COP'
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('La moneda no es válida')
  return {
    ...datos,
    nombre: datos.nombre.trim(),
    banco: datos.tipo === 'banco' ? datos.banco?.trim() || null : null,
    saldo_inicial: desdeCentavos(centavos),
    currency,
  }
}

async function modificarCuenta(
  db: DatabaseWriter,
  espacioId: string,
  id: string,
  campos: string,
  valores: unknown[],
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    const cuenta = await tx.getOptional<{ id: string }>(
      'SELECT id FROM cuenta WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL', [id, espacioId],
    )
    if (!cuenta) throw new Error('La cuenta ya no existe en este espacio')
    // Los campos vienen exclusivamente de las tres mutaciones internas.
    await tx.execute(
      `UPDATE cuenta SET ${campos} WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL`,
      [...valores, id, espacioId],
    )
  })
}

/** Crea una cuenta y devuelve su id (UUID generado en cliente). */
export async function crearCuenta(
  db: DatabaseWriter,
  espacioId: string,
  entrada: DatosCuenta,
): Promise<string> {
  if (!espacioId) throw new Error('Selecciona un espacio antes de crear la cuenta')
  const datos = normalizarDatos(entrada)
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
  db: DatabaseWriter,
  espacioId: string,
  id: string,
  entrada: DatosCuenta,
): Promise<void> {
  const datos = normalizarDatos(entrada)
  await modificarCuenta(
    db, espacioId, id,
    'nombre = ?, tipo = ?, banco = ?, saldo_inicial = ?, updated_at = ?',
    [datos.nombre, datos.tipo, datos.banco, datos.saldo_inicial, new Date().toISOString()],
  )
}

/** Archiva o desarchiva una cuenta (no la borra: sigue contando en históricos). */
export async function archivarCuenta(
  db: DatabaseWriter,
  espacioId: string,
  id: string,
  archivada: boolean,
): Promise<void> {
  await modificarCuenta(db, espacioId, id, 'archivada = ?, updated_at = ?', [
    archivada ? 1 : 0, new Date().toISOString(),
  ])
}

/** Borrado lógico de una cuenta. */
export async function eliminarCuenta(db: DatabaseWriter, espacioId: string, id: string): Promise<void> {
  const now = new Date().toISOString()
  await modificarCuenta(db, espacioId, id, 'deleted_at = ?, updated_at = ?', [now, now])
}
