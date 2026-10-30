// Al arrancar con sesión guardada, el árbol de navegación se vuelve a montar dos
// veces (aparece la sesión y luego se abre la base local) y expo-router termina
// en «/». Se recuerda la ruta con la que abrió la app (recarga en web o deep
// link) para restaurarla cuando las pestañas ya están montadas.

const RUTAS_DE_ACCESO = ['/login', '/register', '/reset', '/set-password', '/auth', '/onboarding']

let captured = false
let pending: string | null = null

/** Solo cuenta la primera ruta que ve la app; las siguientes se ignoran. */
export function rememberInitialPath(path: string): void {
  if (captured) return
  captured = true
  if (path !== '/' && !RUTAS_DE_ACCESO.some((r) => path.startsWith(r))) pending = path
}

/** Devuelve la ruta pendiente una sola vez. */
export function takeInitialPath(): string | null {
  const path = pending
  pending = null
  return path
}
