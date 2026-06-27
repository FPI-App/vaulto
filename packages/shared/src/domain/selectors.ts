// Contrato de integración entre tracks.
//
// Esta es la ÚNICA costura entre Track A (dashboard / lmilo) y Track B
// (deudas / edav). Vive en packages/shared para que nadie espere a nadie:
//   - El dashboard (Track A) consume `DeudasSelectors` a través de la interfaz.
//   - Track B implementa `DeudasSelectors` cuando su feature esté lista.
//   - Mientras tanto, el dashboard usa `NoopDeudasSelectors`, que devuelve
//     0 / [] y no bloquea el desarrollo de Track A.
//
// Regla: si cambias esta interfaz, lo acuerdan ambos tracks. No es opcional.

import type { DireccionDeuda } from '../types'

/**
 * Resumen de un vencimiento próximo de deuda, pensado para pintarse directo en
 * el dashboard sin que Track A conozca el modelo interno de deudas.
 */
export interface VencimientoResumen {
  /** id de la deuda (para navegar al detalle). */
  deuda_id: string
  /** Nombre de la contraparte a mostrar. */
  contraparte: string
  /** Dirección de la deuda (define color/sentido en la UI). */
  direccion: DireccionDeuda
  /** Saldo pendiente como string decimal (numeric(14,2)). Ver domain/money. */
  saldo_pendiente: string
  /** Moneda del saldo (ISO 4217). */
  currency: string
  /** Fecha límite (ISO 8601 date, YYYY-MM-DD). null si no tiene. */
  fecha_limite: string | null
}

/**
 * Selectores de deudas que el dashboard necesita.
 *
 * Track B implementa esta interfaz leyendo de la SQLite local (PowerSync).
 * Track A solo depende de la interfaz, nunca de la implementación.
 */
export interface DeudasSelectors {
  /**
   * Total agregado del saldo pendiente para una dirección de deuda.
   * @returns el total como número (en unidades de la moneda, ya sumado de forma
   *          segura). El dashboard lo formatea con `formatCOP`.
   */
  getTotalPorDireccion(direccion: DireccionDeuda): Promise<number>

  /**
   * Próximos vencimientos ordenados por urgencia (fecha límite ascendente),
   * limitados a `limite` filas.
   */
  getProximosVencimientos(limite: number): Promise<VencimientoResumen[]>
}

/**
 * Implementación nula del contrato. El dashboard la usa hasta que Track B
 * provea la real. No lanza, no consulta nada: devuelve valores vacíos seguros.
 *
 * Inyéctala como default y reemplázala por la impl de Track B vía el contenedor
 * de dependencias / contexto de la app.
 */
export class NoopDeudasSelectors implements DeudasSelectors {
  async getTotalPorDireccion(_direccion: DireccionDeuda): Promise<number> {
    return 0
  }

  async getProximosVencimientos(_limite: number): Promise<VencimientoResumen[]> {
    return []
  }
}

/** Instancia compartida lista para usar como default. */
export const noopDeudasSelectors: DeudasSelectors = new NoopDeudasSelectors()
