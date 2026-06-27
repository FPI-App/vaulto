// AppSchema de PowerSync (lado cliente).
//
// Describe las tablas que PowerSync replica a la SQLite local cifrada
// (SQLCipher). Debe ser COHERENTE, campo por campo y nombre por nombre, con:
//   - las migraciones de `supabase/migrations/0001_init.sql`
//   - los tipos de `../types`
//
// Notas sobre tipos en PowerSync (SQLite tiene un sistema de tipos reducido):
//   - `id` es SIEMPRE la PK y es implícita (text). No se declara como columna.
//   - column.text     -> uuid, text, timestamptz, date y numeric(14,2) (el dinero
//                        viaja como string para no perder precisión).
//   - column.integer  -> booleanos (0/1) y enteros (prioridad).
//   - column.real     -> no se usa para dinero (perdería precisión binaria).
//
// Las columnas monetarias se guardan como TEXT a propósito: numeric(14,2) en
// Postgres no tiene un equivalente exacto en SQLite, y un REAL (float64)
// introduciría errores de redondeo en sumas de dinero. Ver `../domain/money.ts`.

import { column, Schema, Table } from '@powersync/react-native'

const espacio = new Table({
  // id (implícita)
  nombre: column.text,
  owner_user_id: column.text,
  base_currency: column.text,
  country: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
})

const espacio_miembro = new Table(
  {
    espacio_id: column.text,
    user_id: column.text,
    rol: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  {
    indexes: {
      por_espacio: ['espacio_id'],
      por_usuario: ['user_id'],
    },
  },
)

const perfil = new Table({
  // id = auth.uid()
  espacio_id: column.text,
  nombre: column.text,
  apellido: column.text,
  username: column.text,
  foto_url: column.text,
  descripcion: column.text,
  ocupacion: column.text,
  country: column.text,
  // boolean -> integer 0/1
  onboarding_completo: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
})

const cuenta = new Table(
  {
    espacio_id: column.text,
    nombre: column.text,
    tipo: column.text,
    banco: column.text,
    // numeric(14,2) -> text
    saldo_inicial: column.text,
    currency: column.text,
    // boolean -> integer 0/1
    archivada: column.integer,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  {
    indexes: {
      por_espacio: ['espacio_id'],
    },
  },
)

const categoria = new Table(
  {
    espacio_id: column.text,
    nombre: column.text,
    tipo: column.text,
    icono: column.text,
    color: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  {
    indexes: {
      por_espacio: ['espacio_id'],
    },
  },
)

const movimiento = new Table(
  {
    espacio_id: column.text,
    cuenta_id: column.text,
    cuenta_destino_id: column.text,
    categoria_id: column.text,
    tipo: column.text,
    // numeric(14,2) -> text
    monto: column.text,
    currency: column.text,
    fecha: column.text,
    nota: column.text,
    pago_id: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  {
    indexes: {
      por_espacio: ['espacio_id'],
      por_cuenta: ['cuenta_id'],
      por_fecha: ['espacio_id', 'fecha'],
    },
  },
)

const deuda = new Table(
  {
    espacio_id: column.text,
    direccion: column.text,
    contraparte: column.text,
    // numeric(14,2) -> text
    monto_inicial: column.text,
    saldo_pendiente: column.text,
    currency: column.text,
    // date -> text (YYYY-MM-DD)
    fecha_limite: column.text,
    prioridad: column.integer,
    estado: column.text,
    nota: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  {
    indexes: {
      por_espacio: ['espacio_id'],
      por_vencimiento: ['espacio_id', 'fecha_limite'],
    },
  },
)

const pago = new Table(
  {
    espacio_id: column.text,
    deuda_id: column.text,
    // numeric(14,2) -> text
    monto: column.text,
    currency: column.text,
    fecha: column.text,
    nota: column.text,
    movimiento_id: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  {
    indexes: {
      por_espacio: ['espacio_id'],
      por_deuda: ['deuda_id'],
    },
  },
)

/**
 * Esquema completo que PowerSync replica al dispositivo. El nombre de cada
 * propiedad ES el nombre de la tabla en SQLite local y debe coincidir con
 * Postgres.
 */
export const AppSchema = new Schema({
  espacio,
  espacio_miembro,
  perfil,
  cuenta,
  categoria,
  movimiento,
  deuda,
  pago,
})

/** Tipo de la base de datos tipada que PowerSync genera a partir del esquema. */
export type Database = (typeof AppSchema)['types']
