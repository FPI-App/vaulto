# Pendientes de edav — entrega local

## Confirmado

Rama `feat/edav-pendientes-mvp`, creada desde `8772101` (SDK 58 publicado).
Se consultaron los issues abiertos asignados a `edav404` mediante la API GitHub:
#2, #6, #16, #17 y #18. Las tres tareas de código/documentación ya tenían implementación
base; esta entrega completa huecos y añade pruebas de regresión.

| Tarea | Trabajo realizado |
|---|---|
| #16 Deudas y abonos | Historial reactivo por deuda/espacio con fecha, monto y nota; bloqueo de envío repetido; validación en el repositorio; moneda del pago heredada de la deuda. |
| #17 Dominio/selectores | Pruebas SQL reales para totales, vencimientos, límites, saldadas, soft delete e aislamiento; se conserva el contrato del dashboard. |
| #18 Documentación | README de la app y owners alineados al provider real; se distingue configuración SQLCipher de cifrado efectivamente verificado. |
| #2 Identidad | Perfil con foto HTTPS, validación y edición de opcionales; onboarding local idempotente con rollback integral. |

La foto se edita por enlace HTTPS. No hay subida a Storage desde cámara/galería.
Las colisiones de username se comprueban contra las filas locales; el constraint de
Postgres sigue siendo la garantía de unicidad global al sincronizar.

## Verificación local

- 21 pruebas de la app sobre validaciones y SQLite en memoria: pasan.
- 62 pruebas del dominio compartido: pasan.
- Typecheck de la app: pasa.
- ESLint de fuentes: sin errores; permanecen tres advertencias anteriores.
- Exportación web Expo SDK 58: pasa (1628 módulos).
- Checklist React: hooks antes de retornos, formularios ligados al usuario, acciones
  duplicadas bloqueadas y operaciones de escritura desde eventos.
- CI: la primera ejecución remota falló con Node 20 porque no soporta `node:sqlite`.
  El workflow se alinea a Node 26.8.1 (la versión local validada) e incorpora `pnpm test`.

Las pruebas de SQLite usan una base `:memory:` con tablas mínimas. Verifican las
mutaciones y sus transacciones, pero no emulan PowerSync ni las políticas de Postgres.

## Pendiente de entorno e intervención

- #6 no está terminado: faltan `app/.env`, `supabase/powersync/.env`, Supabase CLI y
  ADB/Android SDK accesibles. No se probaron sync entre dos dispositivos, RLS remoto
  ni el development build nativo.
- No se aplicaron migraciones ni se modificaron datos remotos.
- El cifrado local no está confirmado: el driver se compila con SQLCipher pero
  `lib/sync/db.ts` no aprovisiona una llave. Hace falta preparar una migración segura
  para bases existentes antes de cambiar su apertura; SecureStore hoy guarda la sesión.
- La PAT previamente rechaza escrituras en Projects. El conector GitHub sigue
  sin estar disponible; no se cambiaron estados ni se cerraron issues.
- Rama publicada con autorización del usuario. PR draft [#20](https://github.com/FPI-App/vaulto/pull/20)
  contra `feat/edav-track-b`; la integración permanece pendiente de revisión.
