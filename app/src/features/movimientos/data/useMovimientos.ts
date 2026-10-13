// Hooks reactivos de lectura de Movimientos. El filtrado va en SQL para no
// traer a JS más filas de las que se pintan.
import { useQuery } from '@powersync/react-native'
import type { TipoMovimiento } from '@vaulto/shared'

/** Fila de la lista con los nombres ya resueltos (cuentas/categoría pueden estar borradas). */
export interface MovimientoListado {
  id: string
  tipo: TipoMovimiento
  monto: string
  currency: string
  fecha: string
  nota: string | null
  pago_id: string | null
  cuenta_id: string
  cuenta_nombre: string | null
  cuenta_destino_id: string | null
  cuenta_destino_nombre: string | null
  categoria_id: string | null
  categoria_nombre: string | null
  categoria_icono: string | null
  categoria_color: string | null
}

export interface FiltrosMovimientos {
  tipo: TipoMovimiento | null
  /** Movimientos donde la cuenta es origen O destino. */
  cuentaId: string | null
  categoriaId: string | null
  /** Rango [desde, hasta) en ISO; null = sin límite. */
  desde: string | null
  hasta: string | null
}

// Tope de filas pintadas. El MVP no pagina; con filtro de mes rara vez se alcanza.
const LIMITE = 500

export function useMovimientos(
  espacioId: string | null,
  f: FiltrosMovimientos,
): { movimientos: MovimientoListado[]; cargando: boolean } {
  // Cada filtro se anula con "? IS NULL" para mantener una sola consulta
  // parametrizada en vez de concatenar SQL según qué filtros estén activos.
  // Fechas con julianday(): lo escrito en el dispositivo trae 'T' y lo que baja
  // del sync puede traer espacio; como texto no ordenan ni comparan igual.
  const { data, isLoading } = useQuery<MovimientoListado>(
    `SELECT m.id, m.tipo, m.monto, m.currency, m.fecha, m.nota, m.pago_id,
            m.cuenta_id, c.nombre AS cuenta_nombre,
            m.cuenta_destino_id, cd.nombre AS cuenta_destino_nombre,
            m.categoria_id, cat.nombre AS categoria_nombre, cat.icono AS categoria_icono, cat.color AS categoria_color
     FROM movimiento m
     LEFT JOIN cuenta c ON c.id = m.cuenta_id
     LEFT JOIN cuenta cd ON cd.id = m.cuenta_destino_id
     LEFT JOIN categoria cat ON cat.id = m.categoria_id
     WHERE m.espacio_id = ? AND m.deleted_at IS NULL
       AND (? IS NULL OR m.tipo = ?)
       AND (? IS NULL OR m.cuenta_id = ? OR m.cuenta_destino_id = ?)
       AND (? IS NULL OR m.categoria_id = ?)
       AND (? IS NULL OR julianday(m.fecha) >= julianday(?))
       AND (? IS NULL OR julianday(m.fecha) < julianday(?))
     ORDER BY julianday(m.fecha) DESC, julianday(m.created_at) DESC
     LIMIT ${LIMITE}`,
    [
      espacioId ?? '',
      f.tipo, f.tipo,
      f.cuentaId, f.cuentaId, f.cuentaId,
      f.categoriaId, f.categoriaId,
      f.desde, f.desde,
      f.hasta, f.hasta,
    ],
  )
  return { movimientos: data, cargando: isLoading }
}

export interface MovimientoRow {
  id: string
  tipo: TipoMovimiento
  monto: string
  cuenta_id: string
  cuenta_destino_id: string | null
  categoria_id: string | null
  fecha: string
  nota: string | null
  pago_id: string | null
}

export function useMovimiento(id: string): { movimiento: MovimientoRow | null; cargando: boolean } {
  const { data, isLoading } = useQuery<MovimientoRow>(
    `SELECT id, tipo, monto, cuenta_id, cuenta_destino_id, categoria_id, fecha, nota, pago_id
     FROM movimiento WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  )
  return { movimiento: data[0] ?? null, cargando: isLoading }
}
