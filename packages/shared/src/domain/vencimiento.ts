// Texto de urgencia de un vencimiento para el dashboard. Solo depende de
// `VencimientoResumen.fecha_limite` (contrato DeudasSelectors), no del modelo de deudas.

/**
 * Días enteros desde `hoy` (día local) hasta `fechaLimite` (YYYY-MM-DD).
 * 0 = vence hoy, negativo = vencida.
 */
export function diasHastaVencimiento(fechaLimite: string, hoy: Date = new Date()): number {
  const [anio, mes, dia] = fechaLimite.split('-').map(Number)
  if (!anio || !mes || !dia) throw new TypeError(`Fecha límite inválida: ${fechaLimite}`)
  // Date.UTC con los componentes LOCALES de hoy: compara días de calendario sin
  // que el horario de verano o la hora del día metan medio día de diferencia.
  const limite = Date.UTC(anio, mes - 1, dia)
  const base = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((limite - base) / 86_400_000)
}

export function etiquetaVencimiento(fechaLimite: string | null, hoy: Date = new Date()): string {
  if (!fechaLimite) return 'Sin fecha límite'
  const dias = diasHastaVencimiento(fechaLimite, hoy)
  if (dias < -1) return `Venció hace ${-dias} días`
  if (dias === -1) return 'Venció ayer'
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  return `Vence en ${dias} días`
}
