import type { AbstractPowerSyncDatabase } from '@powersync/react-native'
import { calcularSaldoPendiente, sumarANumero, type DeudasSelectors, type DireccionDeuda, type VencimientoResumen } from '@vaulto/shared'

interface DeudaSelectorRow {
  id: string
  direccion: DireccionDeuda
  contraparte: string
  monto_inicial: string
  currency: string
  fecha_limite: string | null
  prioridad: number
  created_at: string
}

interface PagoSelectorRow {
  deuda_id: string
  monto: string
}

/** Selectores locales, limitados al espacio activo y a filas no eliminadas. */
export class SQLiteDeudasSelectors implements DeudasSelectors {
  constructor(
    private readonly db: AbstractPowerSyncDatabase,
    private readonly espacioId: string,
  ) {}

  private async getDeudas(): Promise<VencimientoResumen[]> {
    const [deudas, pagos] = await Promise.all([
      this.db.getAll<DeudaSelectorRow>(
        `SELECT id, direccion, contraparte, monto_inicial, currency, fecha_limite, prioridad, created_at
         FROM deuda WHERE espacio_id = ? AND deleted_at IS NULL
         ORDER BY fecha_limite IS NULL, fecha_limite ASC, prioridad DESC, created_at ASC`,
        [this.espacioId],
      ),
      this.db.getAll<PagoSelectorRow>(
        `SELECT deuda_id, monto FROM pago WHERE espacio_id = ? AND deleted_at IS NULL`,
        [this.espacioId],
      ),
    ])
    const pagosPorDeuda = new Map<string, string[]>()
    for (const pago of pagos) {
      const montos = pagosPorDeuda.get(pago.deuda_id) ?? []
      montos.push(pago.monto)
      pagosPorDeuda.set(pago.deuda_id, montos)
    }
    return deudas.flatMap((deuda) => {
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
