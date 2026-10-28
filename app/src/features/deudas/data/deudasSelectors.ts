import type { AbstractPowerSyncDatabase } from '@powersync/react-native'
import { calcularSaldoPendiente, sumarANumero, type DeudasSelectors, type VencimientoResumen } from '@vaulto/shared/domain'
import type { DireccionDeuda } from '@vaulto/shared/types'

interface DeudaSelectorRow {
  id: string
  direccion: DireccionDeuda
  contraparte: string
  monto_inicial: string
  currency: string
  fecha_limite: string | null
  prioridad: number
  created_at: string
  pago_monto: string | null
}

/** Selectores locales, limitados al espacio activo y a filas no eliminadas. */
export class SQLiteDeudasSelectors implements DeudasSelectors {
  constructor(
    private readonly db: Pick<AbstractPowerSyncDatabase, 'getAll'>,
    private readonly espacioId: string,
  ) {}

  private async getDeudas(): Promise<VencimientoResumen[]> {
    // Una consulta evita combinar principal y pagos de snapshots diferentes.
    const filas = await this.db.getAll<DeudaSelectorRow>(
      `SELECT d.id, d.direccion, d.contraparte, d.monto_inicial, d.currency,
              d.fecha_limite, d.prioridad, d.created_at, p.monto AS pago_monto
       FROM deuda d LEFT JOIN pago p ON p.deuda_id = d.id
         AND p.espacio_id = d.espacio_id AND p.deleted_at IS NULL
       WHERE d.espacio_id = ? AND d.deleted_at IS NULL
       ORDER BY d.fecha_limite IS NULL, d.fecha_limite ASC, d.prioridad DESC, d.created_at ASC, d.id`,
      [this.espacioId],
    )
    const deudas = new Map<string, DeudaSelectorRow>()
    const pagosPorDeuda = new Map<string, string[]>()
    for (const fila of filas) {
      deudas.set(fila.id, fila)
      const montos = pagosPorDeuda.get(fila.id) ?? []
      if (fila.pago_monto !== null) montos.push(fila.pago_monto)
      pagosPorDeuda.set(fila.id, montos)
    }
    return [...deudas.values()].flatMap((deuda) => {
      const saldo = calcularSaldoPendiente(deuda.monto_inicial, pagosPorDeuda.get(deuda.id) ?? [])
      return saldo === '0.00' ? [] : [{
        deuda_id: deuda.id,
        contraparte: deuda.contraparte,
        direccion: deuda.direccion,
        saldo_pendiente: saldo,
        currency: deuda.currency,
        fecha_limite: deuda.fecha_limite,
      }]
    })
  }

  async getTotalPorDireccion(direccion: DireccionDeuda): Promise<number> {
    const deudas = await this.getDeudas()
    return sumarANumero(deudas
      .filter((deuda) => deuda.direccion === direccion)
      .map((deuda) => deuda.saldo_pendiente))
  }

  async getProximosVencimientos(limite: number): Promise<VencimientoResumen[]> {
    const cantidad = Number.isFinite(limite) ? Math.max(0, Math.floor(limite)) : 0
    if (cantidad === 0) return []
    const deudas = await this.getDeudas()
    return deudas
      .filter((deuda) => deuda.fecha_limite !== null)
      .slice(0, cantidad)
  }
}
