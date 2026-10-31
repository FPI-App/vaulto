# Continuación de #25, #24, #21 y #18 — 2026-10-30

## Entrega local revisada

- #25: `app/src/lib/sync/reactivacionSubida.test.ts`, `app/package.json` y `pnpm-lock.yaml`. Cuatro casos ejercitan el bucle real de subida de shared-internals 1.4.0 con el conector y recovery store reales; red, cola y primera línea se simulan. No se demostró un fallo de producción y no se modificó el conector para corregir una hipótesis sin reproducción.
- #24: nuevas evidencias en `docs/validaciones/2026-10-30/`: migraciones0001–0016, RLS/guards/grants, esquema private no expuesto, estado PowerSync sin errores y hash de reglas remoto igual a `powersync/sync-config.yaml`. Consultas exclusivamente de lectura; sin despliegues ni SQL DML administrativo.
- #21: inventario y plan nativo en `preflight-25-24-21-2026-10-30.md`; ejecución nativa adicional aún en curso al redactar esta sección.
- #18: README raíz/app/Supabase, ARQUITECTURA, PLAN, INFRA-SETUP, DEMO, policies y plantilla raíz alineados con código. Se conserva el contrato real sin redefinirlo. Revisión DEV en `issue18-actualizacion.md`; hallazgos residuales corregidos por el coordinador: publishable key con compatibilidad legacy, llave SQLCipher aleatoria sin variable global, helper booleano correcto, paths y árboles reales.

## Comandos y resultados del coordinador

- `git merge --no-edit feature/dev-features` y `git merge --no-edit feature/qa-tests`: correctos. `git cherry-pick 10715a4`: incorpora solo revisión documental; no incorpora ediciones abandonadas ni su reversión.
- `pnpm install --frozen-lockfile`: correcto, lockfile sin nueva resolución.
- `pnpm typecheck`: app/shared correctos.
- `pnpm lint`: app/shared correctos con linter real.
- `pnpm test`: 201/201 (79 shared, 122 app), 24 archivos de prueba correctos.
- `git diff --check`: correcto; avisos de normalización CRLF no son fallos.
- PowerSync CLI0.10.3 `fetch config`/`status`: correctos; salida capturada en memoria y reducida a reglas/estado, sin registrar configuración de conexión ni credenciales. Comparación SHA-256 normalizando CRLF: igual. Réplica inicial completada, ocho tablas, sin errores.
- Supabase CLI `db query` mediante el ejecutable ya instalado: una consulta SELECT de metadatos, correcta; resultado en el JSON fechado. No se ejecutó reset, push ni migración.
- GET PostgREST con `Accept-Profile: private`: HTTP406/PGRST106, sin exposición del esquema. TLS verificado con almacén CA del sistema; no se deshabilitó validación.
- Búsqueda de enlaces locales Markdown en documentos revisados: sin destinos faltantes.

## NO verificado en esta entrega local

- La suite del SDK no acredita SQLite cifrado, transporte nativo ni sincronización real. Los resultados nativos se incorporarán desde la entrega QA, conservando lo que permanezca pendiente.
- No hay APK nuevo con expo-blur/linear-gradient ni validación del rediseño en el APK anterior. Exportar JavaScript no equivale a compilar/ejecutar ese APK.
- No se ha confirmado revisión compartida de lmilo, ni enviado mensajes externos en su nombre.
- No se aplicó la propuesta de restringir la publicación Postgres FOR ALL TABLES. Requiere cambio SQL revisado y autorización de despliegue.
- No se borraron archivos legacy ni datos de prueba; no se probará iOS, excluido por decisión previa del usuario.
- Los cierres de Issues conservan gates separados. Este informe no acredita cierre remoto ni publicación del árbol local.

## Ejecución HTTP remota adicional del coordinador

Confirmado en datos sintéticos del usuario QA A, a través de la API pública autenticada; sin SQL administrativo de escritura. Un puente efímero ligado a 127.0.0.1 consume la respuesta exitosa del servidor y destruye el socket antes de entregarla al cliente; el listener se cierra al finalizar. HTTPS upstream conserva validación TLS.

- Aplicación: primera respuesta interna200/applied perdida; cliente observa fallo de red, reintenta mismo contenido/batch y recibe200/already_applied; una sola categoría por ID.
- Anulación: deuda100 con pago60; lote posterior60 rechazado23514. Respuesta interna200/cancelled perdida; repetir cancelación y aplicar ese lote devuelven cancelled; un solo pago y saldo40.
- Recibos: consulta SQL exclusivamente SELECT confirma un recibo por cada lote probado, estados applied/cancelled.
- Cliente anterior: POST directo a categoría con espacio propio rechazado400/23514 y mensaje exacto del guard atómico; lectura posterior confirma cero filas. La primera versión del oráculo esperaba42501 por error y dejó ok:false en su reporte crudo; se conserva ese reporte y se añade `issue24-old-client-verified.json` con el código esperado verificado contra0012 y la ejecución real. No es un fallo del producto.
- Evidencia: `issue24-25-http-response-loss.json`, `issue24-old-client-verified.json`, `issue24-response-loss-ledger.json`. Los fixtures se conservan, sin borrado.
- NO verificado aquí: transporte móvil/SDK nativo, migración o sesión Android. Estos resultados cubren servidor y HTTP real; no sustituyen los pendientes nativos de #25 y #21.

## Evidencia nativa y estado final — 2026-10-31

### #21 — llave/migración y replay en Android

- `issue21-native-create.json`: fixture nativo real exportado a SQLCipher; validación de llave correcta/incorrecta; dos operaciones pendientes preservadas con `clientId` y cola idénticos; no hubo conexión antes de terminar la exportación.
- `issue21-process-restart.json`: proceso de la app detenido y vuelto a abrir con PID distinto, sin limpiar datos.
- `issue21-native-resume.json`: SDK PowerSync y conector Supabase reales reabrieron como el propietario original, drenaron las dos operaciones y confirmaron la transacción en 60 s; copia original conservada.
- `issue21-native-ledger.json`: SELECT remoto confirma un recibo `applied` para el mismo lote.

### #25 — reactivación y cambio de propietario

- `issue25-native-reconnect-same-process.json`: se detuvo el puente QA que transporta HTTPS y WebSocket, se observó `connected:false`, se solicitó cancelar con outbox=2 y se restauró el mismo puente. El SDK reconectó en el mismo proceso, canceló la operación inválida, vació la cola y confirmó un único pago de 60 con saldo 40.
- `issue25-native-owner-b.json`: con el fixture solicitado por A, la sesión B obtuvo `propietario-distinto`, `opened:false`, `uploaded:false`.
- `issue25-native-owner-a-resume.json`: A volvió a abrir exactamente el mismo cliente/lote/hash tras B; outbox=0, un pago de 60, saldo 40 y resultado `passed`.
- `issue25-native-ledger.json`: consulta SELECT remota confirma un recibo `cancelled` por cada lote nativo. Se conserva la sesión/cola QA; no se borró ningún dato.
- La app Auth no pudo completar la primera llamada de sign-out mientras no había transporte; el cierre local de la sesión del fixture sucedió antes de llamar Auth. Con el puente restaurado, sign-out terminó y se pudo iniciar B.

### Build y vista de producto

- EAS build `9692ce86-65a2-41ee-bd76-b6e3561b6f7b` terminó correctamente desde el SHA `df2b6a8`. Se descargó el APK, se verificó que la firma coincidiera con la instalada y se instaló con `adb install -r` (sin borrar datos).
- La primera apertura del producto mostró blanco. El log nativo reportó que no encontraba `SplashScreenManager`; el layout espera `useFonts` y retorna `null` mientras carga. Se agregó `expo-splash-screen ~58.0.12`, plugin SDK 58, `preventAutoHideAsync()` y ocultamiento al completar o fallar la carga de Inter.
- Build EAS actualizado `c43c9c15-5167-4ae3-8ecf-7d878efefdf8`: en curso al momento de editar este informe. No se da por verificado el dashboard normal hasta instalar ese APK y observar contenido.

### Archivos y comandos verificados

- Código QA: `app/qa-native-entry.tsx`, `app/src/app/qa-storage.tsx`, `app/src/app/qa-sync-recovery.tsx`, `app/src/lib/db/qaStorageRemote.ts`, `app/src/lib/db/qaSyncRecovery.ts` y sus pruebas.
- Arranque normal: `app/app.json`, `app/package.json`, `app/src/app/_layout.tsx`, `pnpm-lock.yaml`.
- `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`: correctos. `pnpm test`: 230/230 (79 shared + 151 app).
- `adb install -r <APK>`: correcto; `apksigner verify --print-certs`: el SHA-256 de firma del APK nuevo coincidió con el anterior. La inspección remota de los lotes fue exclusivamente `SELECT`.

### Pendiente / no verificado

- Concurrencia del caso #25 en dos dispositivos: solo se usó un AVD y dos propietarios alternados. No se probó iOS.
- Vista normal de Vaulto sobre el build corregido: pendiente de terminar, instalar y observar el segundo build EAS.
- #24: no se autorizó ni aplicó migración; el destino remoto observado ya tiene 0012–0016. La revisión coordinada del cambio de publicación de las ocho tablas sigue pendiente con lmilo.
- #18: queda confirmación/revisión compartida de lmilo; no se envió mensaje externo.
- CI del SHA final de PR #37, merge del PR y cierre de los cuatro Issues: aún pendientes de sus gates separados.
