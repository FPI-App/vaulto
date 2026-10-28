// Helpers de dinero.
//
// Regla de oro: el dinero NO se suma en floats. numeric(14,2) de Postgres viaja
// como string por toda la app (tipos y PowerSync). Aquí se convierte a centavos
// (enteros) para operar sin errores de redondeo binario, y se formatea para COP.
//
// 14,2 => hasta 999.999.999.999,99. En centavos eso son ~1e14, dentro del rango
// seguro de los enteros de JS (Number.MAX_SAFE_INTEGER ≈ 9e15). No se necesita
// BigInt para el MVP, pero las operaciones se mantienen en enteros igualmente.

/** Cantidad de decimales de las monedas que maneja el MVP. COP en la práctica
 *  no usa centavos, pero el esquema es numeric(14,2): trabajamos a 2 decimales. */
const DECIMALES = 2
const FACTOR = 10 ** DECIMALES
const MAX_MONTO_CENTAVOS = 10 ** 14 - 1

/**
 * Convierte un monto string/number a centavos (entero).
 * Acepta el formato que llega de la DB ("1234.50") o un número.
 * Lanza si el valor no es un número finito.
 */
export function aCentavos(monto: string | number): number {
  const n = typeof monto === 'number' ? monto : Number.parseFloat(monto)
  if (!Number.isFinite(n)) {
    throw new TypeError(`Monto inválido: ${JSON.stringify(monto)}`)
  }
  // Math.round evita que 0.1 + 0.2 y similares se filtren al redondear a centavos.
  return Math.round(n * FACTOR)
}

/**
 * Convierte centavos (entero) de vuelta a un string decimal con 2 posiciones,
 * apto para guardar en una columna numeric(14,2).
 */
export function desdeCentavos(centavos: number): string {
  const signo = centavos < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(centavos))
  const entero = Math.trunc(abs / FACTOR)
  const resto = abs % FACTOR
  return `${signo}${entero}.${String(resto).padStart(DECIMALES, '0')}`
}

/**
 * Suma segura de montos en formato string/number. Opera en enteros (centavos)
 * y devuelve un string decimal apto para la DB.
 */
export function sumarMontos(...montos: Array<string | number>): string {
  const totalCentavos = montos.reduce<number>((acc, m) => acc + aCentavos(m), 0)
  return desdeCentavos(totalCentavos)
}

/**
 * Resta segura: `minuendo - sustraendos...`. Devuelve string decimal.
 */
export function restarMontos(
  minuendo: string | number,
  ...sustraendos: Array<string | number>
): string {
  const totalCentavos = sustraendos.reduce<number>(
    (acc, m) => acc - aCentavos(m),
    aCentavos(minuendo),
  )
  return desdeCentavos(totalCentavos)
}

/**
 * Suma en número (no string). Útil para selectores que acumulan y entregan un
 * `number` (p. ej. `DeudasSelectors.getTotalPorDireccion`).
 */
export function sumarANumero(montos: Array<string | number>): number {
  const totalCentavos = montos.reduce<number>((acc, m) => acc + aCentavos(m), 0)
  return totalCentavos / FACTOR
}

/**
 * Formatea un monto como pesos colombianos: "$ 1.234.567".
 * COP no usa decimales en la presentación, así que se redondea a la unidad.
 *
 * @param monto      valor en unidades (string de DB, número o ya en centavos no).
 * @param currency   ISO 4217. MVP: 'COP'. Se deja parametrizable (multimoneda).
 */
export function formatCOP(monto: string | number, currency = 'COP'): string {
  const valor = typeof monto === 'number' ? monto : Number.parseFloat(monto)
  if (!Number.isFinite(valor)) return '—'

  // COP: sin decimales. Otras monedas: 2 decimales por defecto.
  const sinDecimales = currency === 'COP'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: sinDecimales ? 0 : 2,
    maximumFractionDigits: sinDecimales ? 0 : 2,
  }).format(valor)
}

/**
 * Formatea solo el número (sin símbolo de moneda) con separadores de miles
 * colombianos: "1.234.567". Útil en inputs y tablas densas.
 */
export function formatNumero(monto: string | number, currency = 'COP'): string {
  const valor = typeof monto === 'number' ? monto : Number.parseFloat(monto)
  if (!Number.isFinite(valor)) return '—'
  const sinDecimales = currency === 'COP'
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: sinDecimales ? 0 : 2,
    maximumFractionDigits: sinDecimales ? 0 : 2,
  }).format(valor)
}

/**
 * Normaliza lo que el usuario teclea en un input de monto a un string decimal
 * con punto, apto para guardar en una columna numeric(14,2). Devuelve `null` si
 * no es un monto válido, no-negativo y representable como numeric(14,2).
 *
 * Convención es-CO: '.' es separador de miles y ',' el decimal
 * ("1.250.000" -> "1250000.00", "1.250,50" -> "1250.50"). Pensado para reusarse
 * en cuentas, movimientos y deudas.
 */
export function normalizarMontoInput(texto: string): string | null {
  const limpio = texto.trim().replace(/\s/g, '')
  if (!limpio) return null
  // Quita los puntos de miles y convierte la coma decimal en punto.
  const normal = limpio.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normal)) return null
  const n = Number.parseFloat(normal)
  if (!Number.isFinite(n) || n < 0) return null
  const centavos = aCentavos(normal)
  if (!Number.isSafeInteger(centavos) || centavos > MAX_MONTO_CENTAVOS) return null
  return desdeCentavos(centavos)
}

/**
 * Monto de la DB → texto para precargar un input al editar, en convención es-CO.
 * A diferencia de `formatNumero`, NO redondea: si hay centavos los conserva, para
 * que abrir y guardar sin tocar nada no cambie el valor ("25000.50" -> "25.000,50").
 */
export function formatMontoInput(monto: string | number): string {
  const centavos = aCentavos(monto)
  const decimales = centavos % FACTOR === 0 ? 0 : DECIMALES
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(centavos / FACTOR)
}
