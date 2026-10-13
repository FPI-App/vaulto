// Formato de fechas de movimientos para la UI (es-CO, hora local del dispositivo).

const FORMATO_DIA = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
const FORMATO_DIA_ANIO = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

/** Clave YYYY-MM-DD del día LOCAL de una fecha (para agrupar por día). */
export function claveDia(fecha: Date): string {
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${m}-${d}`
}

/** "Hoy", "Ayer", "lun, 12 oct" o con año si no es el actual. */
export function etiquetaDia(fecha: Date, hoy = new Date()): string {
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1)
  if (claveDia(fecha) === claveDia(hoy)) return 'Hoy'
  if (claveDia(fecha) === claveDia(ayer)) return 'Ayer'
  return fecha.getFullYear() === hoy.getFullYear() ? FORMATO_DIA.format(fecha) : FORMATO_DIA_ANIO.format(fecha)
}

/**
 * Normaliza el `fecha` que llega de SQLite a Date. El sync puede traer
 * "2026-10-01 10:00:00Z" (con espacio), que Hermes no siempre parsea.
 */
export function parseFecha(iso: string): Date {
  return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
}
