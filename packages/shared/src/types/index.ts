// Tipos del esquema de datos de Vaulto, compartidos entre app y backend.
//
// Estos tipos reflejan EXACTAMENTE las tablas de `supabase/migrations/0001_init.sql`
// y el AppSchema de PowerSync (`../powersync/schema.ts`). Nombres de tabla/campo
// idénticos en SQL, tipos y PowerSync: es un contrato, no una sugerencia.
//
// `database.ts` se genera con `pnpm db:types` (supabase gen types) y NO se edita
// a mano. Estos tipos son la cara "de dominio" que ambos lados consumen sin
// depender del tipo generado.

// ----------------------------------------------------------------------------
// Enums del dominio (uniones de strings; coinciden con los CHECK del SQL)
// ----------------------------------------------------------------------------

/** Tipo de cuenta de dinero. */
export type TipoCuenta = 'banco' | 'efectivo'

/** Tipo de categoría. */
export type TipoCategoria = 'ingreso' | 'egreso'

/** Tipo de movimiento. */
export type TipoMovimiento = 'ingreso' | 'egreso' | 'transferencia'

/** Dirección de una deuda. */
export type DireccionDeuda = 'yo_debo' | 'me_deben'

/** Estado de una deuda. */
export type EstadoDeuda = 'activa' | 'saldada'

/** Rol de un miembro dentro de un espacio. */
export type RolEspacio = 'owner' | 'miembro'

// ----------------------------------------------------------------------------
// Campos transversales
// ----------------------------------------------------------------------------

/**
 * Marcas de auditoría y ciclo de vida presentes en TODA tabla de dominio.
 * Ver ARQUITECTURA.md §1.
 */
export interface CamposBase {
  /** UUID generado en el cliente (offline-first). */
  id: string
  /** Marca de creación (ISO 8601). */
  created_at: string
  /** Marca de última escritura (base del LWW de fallback). ISO 8601. */
  updated_at: string
  /** Soft delete: null = activo. ISO 8601 cuando está borrado. */
  deleted_at: string | null
}

/**
 * Campos transversales de las tablas que pertenecen a un espacio.
 * El `espacio` (raíz) NO los incluye porque él mismo ES el espacio.
 */
export interface CamposEspacio extends CamposBase {
  /** Espacio de datos al que pertenece la fila (unidad de aislamiento). */
  espacio_id: string
}

/** Campos de las entidades monetarias. */
export interface CamposMonetarios {
  /** Moneda del registro (ISO 4217). MVP fija 'COP'. */
  currency: string
}

// ----------------------------------------------------------------------------
// Entidades (1:1 con las tablas del esquema)
// ----------------------------------------------------------------------------

/** Unidad de aislamiento de datos. Raíz del tenant (modo pareja futuro). */
export interface Espacio extends CamposBase {
  nombre: string
  /** Usuario creador (FK a auth.users). */
  owner_user_id: string
  /** Moneda base del espacio (ISO 4217). MVP: 'COP'. */
  base_currency: string
  /** País del espacio (ISO 3166-1 alpha-2). MVP: 'CO'. */
  country: string
}

/** Pertenencia de un usuario a un espacio. Pivot de toda la RLS. */
export interface EspacioMiembro extends CamposEspacio {
  /** Usuario miembro (FK a auth.users). */
  user_id: string
  rol: RolEspacio
}

/** Perfil del usuario. `id` = auth.uid() (1:1 con auth.users). [Track B] */
export interface Perfil extends CamposEspacio {
  nombre: string
  apellido: string
  /** Único en todo el sistema. */
  username: string
  foto_url: string | null
  descripcion: string | null
  ocupacion: string | null
  /** País del perfil (ISO 3166-1 alpha-2). MVP: 'CO'. */
  country: string
  onboarding_completo: boolean
}

/** Cuenta de dinero (banco/efectivo). [Track A] */
export interface Cuenta extends CamposEspacio, CamposMonetarios {
  nombre: string
  tipo: TipoCuenta
  banco: string | null
  /** Saldo de apertura. Decimal con 2 posiciones como string para no perder
   *  precisión (numeric(14,2)). */
  saldo_inicial: string
  archivada: boolean
}

/** Categoría de ingreso/egreso. [Track A] */
export interface Categoria extends CamposEspacio {
  nombre: string
  tipo: TipoCategoria
  icono: string | null
  color: string | null
}

/** Transacción: ingreso, egreso o transferencia. [Track A] */
export interface Movimiento extends CamposEspacio, CamposMonetarios {
  /** Cuenta origen (FK a cuenta). */
  cuenta_id: string
  /** Cuenta destino (FK a cuenta). Solo en transferencias; null en el resto. */
  cuenta_destino_id: string | null
  /** Categoría (FK a categoria). null en transferencias o sin clasificar. */
  categoria_id: string | null
  tipo: TipoMovimiento
  /** Monto numeric(14,2) como string para preservar precisión. */
  monto: string
  /** Fecha del movimiento (ISO 8601). */
  fecha: string
  nota: string | null
  /** Puente débil hacia el abono de deuda que originó el movimiento. */
  pago_id: string | null
}

/** Deuda en cualquier dirección. [Track B] */
export interface Deuda extends CamposEspacio, CamposMonetarios {
  direccion: DireccionDeuda
  /** Nombre/descripción de la contraparte (texto libre en MVP). */
  contraparte: string
  /** Monto numeric(14,2) como string. */
  monto_inicial: string
  /** Saldo restante numeric(14,2) como string. */
  saldo_pendiente: string
  /** Fecha límite (ISO 8601 date, sin hora). null = sin fecha. */
  fecha_limite: string | null
  /** Mayor número = más prioritaria. */
  prioridad: number
  estado: EstadoDeuda
  nota: string | null
}

/** Abono a una deuda. Puente Deuda<->Movimiento. [Track B] */
export interface Pago extends CamposEspacio, CamposMonetarios {
  /** Deuda abonada (FK a deuda). */
  deuda_id: string
  /** Monto numeric(14,2) como string. */
  monto: string
  /** Fecha del abono (ISO 8601). */
  fecha: string
  nota: string | null
  /** Movimiento de caja asociado al abono, si lo hay (FK a movimiento). */
  movimiento_id: string | null
}

// ----------------------------------------------------------------------------
// Mapa de nombre de tabla -> tipo de fila. Útil para helpers genéricos de DB.
// Las claves coinciden EXACTAMENTE con los nombres de tabla en SQL/PowerSync.
// ----------------------------------------------------------------------------
export interface SchemaTables {
  espacio: Espacio
  espacio_miembro: EspacioMiembro
  perfil: Perfil
  cuenta: Cuenta
  categoria: Categoria
  movimiento: Movimiento
  deuda: Deuda
  pago: Pago
}

/** Nombres de tabla válidos del esquema de Vaulto. */
export type NombreTabla = keyof SchemaTables
