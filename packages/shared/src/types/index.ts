// Tipos del esquema compartidos entre app y backend.
//
// `database.ts` se genera con `pnpm db:types` (supabase gen types) y NO se edita a mano.
// Aquí se reexporta y se añaden tipos derivados/manuales que ambos lados consumen.

// export type { Database } from './database' // descomentar tras el primer `pnpm db:types`

/** Campos transversales presentes en toda tabla de dominio. Ver ARQUITECTURA.md §1. */
export interface CamposTransversales {
  /** UUID generado en el cliente. */
  id: string
  /** Marca de última escritura (base de LWW de fallback). */
  updated_at: string
  /** Soft delete: null = activo. */
  deleted_at: string | null
  /** Espacio de datos (multiusuario/pareja). null = espacio personal. */
  espacio_id: string | null
  /** Moneda del registro. MVP: 'COP'. */
  currency: string
  /** País del registro (ISO). MVP: 'CO'. */
  country: string
}
