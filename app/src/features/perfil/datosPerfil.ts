export interface DatosPerfil {
  nombre: string
  apellido: string
  username: string
  foto_url?: string | null
  descripcion?: string | null
  ocupacion?: string | null
}

export function normalizarDatosPerfil(datos: DatosPerfil) {
  const nombre = datos.nombre.trim()
  const apellido = datos.apellido.trim()
  const username = datos.username.trim().toLowerCase()
  if (!nombre || !apellido || nombre.length > 80 || apellido.length > 80) {
    throw new Error('Nombre y apellido son obligatorios y admiten hasta 80 caracteres.')
  }
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    throw new Error('El usuario admite entre 3 y 24 letras, números o guion bajo.')
  }
  const descripcion = datos.descripcion?.trim() || null
  const ocupacion = datos.ocupacion?.trim() || null
  if ((descripcion?.length ?? 0) > 500 || (ocupacion?.length ?? 0) > 100) {
    throw new Error('La descripción admite 500 caracteres y la ocupación 100.')
  }
  const foto_url = datos.foto_url?.trim() || null
  if (foto_url) {
    let url: URL
    try {
      url = new URL(foto_url)
    } catch {
      throw new Error('La foto debe ser una URL HTTPS válida.')
    }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || foto_url.length > 2048) {
      throw new Error('La foto debe ser una URL HTTPS sin credenciales.')
    }
  }
  return { nombre, apellido, username, foto_url, descripcion, ocupacion }
}
