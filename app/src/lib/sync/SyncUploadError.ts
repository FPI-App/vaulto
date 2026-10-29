const messages = {
  backend: 'La sincronización necesita una actualización del servicio. Tus cambios siguen guardados en este dispositivo.',
  conflict: 'Hay cambios que requieren revisión antes de sincronizar. Conservamos la cola local; revisa tus abonos y los permisos del espacio.',
  protocol: 'No pudimos confirmar la subida de tus cambios. La cola local se conservó para reintentar.',
  retry: 'No se pudo subir la transacción. La cola local se conservó para reintentar.',
} as const

export class SyncUploadError extends Error {
  constructor(readonly code: keyof typeof messages) {
    super(messages[code])
    this.name = 'SyncUploadError'
  }
}
