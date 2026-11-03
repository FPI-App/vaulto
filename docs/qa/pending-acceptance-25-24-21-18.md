# Reporte de Brechas de Aceptación: Issues #25, #24, #21 y #18

Fecha: 2026-10-31
Rama: `feature/qa-tests`
Autor: QA Antigravity
Destino del informe: `docs/qa/pending-acceptance-25-24-21-18.md`

---

## 1. Inventario de Dispositivos y Estado del Entorno

### 1.1 Inventario Actual del Host (2026-10-31 — Solo Lectura)
- **Ejecución `adb devices` en la sesión de hoy**:
  ```text
  List of devices attached
  emulator-5554	device
  ```
  - Total de dispositivos conectados actualmente en el host: **Exactamente 1 emulador Android (`emulator-5554`, `VaultoQA1`)**.
  - `VaultoQA2` existe en disco (`.cache/android-avd/VaultoQA2.avd`), pero no está iniciado en la sesión actual para no superar el margen de memoria física disponible en Windows (1.36 GB libres).
  - Por tanto, en la sesión de hoy **no se pueden ejecutar nuevas pruebas simultáneas en dos dispositivos locales** sin aprovisionar memoria o conectar hardware adicional.

### 1.2 Distinción con el Entorno Histórico de Dos Dispositivos (2026-10-29 / 2026-10-30)
- **No debe inferirse que las pruebas históricas se limitaron a un dispositivo**.
- El artefacto `docs/validaciones/2026-10-29/e2e-android-autenticado.json` y el documento `docs/VALIDACION-PRIORIDADES-2026-10-29.md` registran la ejecución E2E sobre **DOS emuladores Android simultáneos**:
  - Dispositivo 1 (D1): `emulator-5554` (`VaultoQA1`).
  - Dispositivo 2 (D2): `emulator-5556` (`VaultoQA2`).
  - Conectividad: Metro en `localhost:8082` y pasarela loopback TLS en `127.0.0.1:8084/8085` contra Supabase remoto `pqxvttkyevbkfdhmcmxu` (migraciones 0001–0016).
  - En dicho entorno de dos dispositivos se comprobó de forma autenticada la colisión offline 60+60, el rechazo 23514 en D2, la anulación por interfaz, la sincronización de una operación posterior y el saldo final de la deuda.
- **Incertidumbre de versión de APK**: La prueba histórica de dos dispositivos se ejecutó sobre un APK development previo a la incorporación de dependencias nativas del rediseño visual (`expo-blur` y `expo-linear-gradient` de PR #31/#37).

### 1.3 Estado del Build de Producto Reciente y Bloqueo Nativo (2026-10-31)
- Build EAS 1 (`9692ce86-65a2-41ee-bd76-b6e3561b6f7b`): finalizado, pero falló en el arranque mostrando pantalla blanca por ausencia de la clase nativa `SplashScreenManager` al ocultar el splash.
- Build EAS 2 (`c43c9c15-5167-4ae3-8ecf-7d878efefdf8`): commit base `df2b6a836bcc2a0170732eb823d27f5fcb7b905c`, instalado con firma coincidente (`adb install -r`).
- Al ejecutar el producto normal (`com.vaulto.app`), Android registró fallas de inicialización consecutivas (`start timeout state=empty`, PIDs 9070 y 9174) y un bloqueo general `ANR` (PID 9282) antes de inicializar la carga de JavaScript (`docs/validaciones/2026-10-31/native-product-startup.json`).
- La interfaz de usuario normal del producto (Dashboard de deudas) **no fue renderizada** en el build reciente. La causa raíz permanece como **Desconocida**.
- Las rutas auxiliares de desarrollo dev-only (`/qa-storage`, `/qa-sync-recovery`) sí operaron aisladamente dentro del entorno dev-client en puerto 8086.
- **Plataforma iOS**: **Excluida / No verificada** conforme a la decisión explícita previa del usuario (fuera del alcance del MVP1).

---

## 2. Reconciliación de Criterios de Aceptación por Issue

### Issue #25: Resolver abonos rechazados sin bloquear la cola de sincronización

- **Estado General**: **Abierto** (Protocolo, anulación en UI, concurrencia en dos dispositivos e idempotencia históricamente verificados; pendientes: reproducción nativa de pérdida de respuesta HTTP en cliente móvil, diagnóstico del reintento tardío y renderizado en el build de producto reciente).
- **Reconciliación de Criterios**:
  1. *Definir la corrección/anulación explícita respetando atomicidad e idempotencia; no descartar silenciosamente transacciones ni recortar saldos a cero*:
     - **Estado**: **Confirmado**.
     - **Capa y Evidencia**: Capa backend y protocolo. RPC `cancelar_lote_abono` en migraciones 0013–0016 registra recibo atómico en `private.vaulto_sync_lote` con estado `cancelled`. En la prueba con desconexión y reintento (`docs/validaciones/2026-10-30/issue24-25-http-response-loss.json`), el reintento devolvió `{ status: 'cancelled', protocol: 1 }`, conservando la deuda en 100.00 COP con un único pago de 60.00 COP y saldo de 40.00 COP (`docs/validaciones/2026-10-30/issue24-response-loss-ledger.json`). En la suite de concurrencia SQL (`docs/validaciones/2026-10-29/carreras-sql-qa.json`), dos conexiones simultáneas con 60+60 aplicaron un lote y rechazaron el sobrepago sin residuos ni alteración indebida de saldos.
  2. *Presentar estado y acción recuperable al usuario conservando el historial necesario*:
     - **Estado**: **Confirmado históricamente en UI móvil / Pendiente en build de producto reciente**.
     - **Capa y Evidencia**:
       - En el E2E histórico con dos emuladores (`docs/validaciones/2026-10-29/e2e-android-autenticado.json`, caso D2 reconecta): tras el rechazo 23514, la UI de D2 presentó «Revisar abono pendiente», permitió confirmar «Anular abono», desbloqueó la cola y convergió el historial al abono aplicado en D1.
       - En las pruebas nativas del SDK reciente (`docs/validaciones/2026-10-31/issue25-native-reconnect-same-process.json`): la ruta dev `qa-sync-recovery` registró los eventos `requested-by-user`, `requested` y `decision: cancelled`.
       - Límite actual: En el APK empaquetado reciente (`c43c9c15`), la UI del producto final no pudo ser evaluada debido al bloqueo de inicio/ANR (`docs/validaciones/2026-10-31/native-product-startup.json`).
  3. *Reconciliar el lote rechazado y demostrar que una operación válida posterior puede sincronizarse sin duplicar pagos*:
     - **Estado**: **Confirmado**.
     - **Capa y Evidencia**:
       - E2E Android en dos dispositivos (`docs/validaciones/2026-10-29/e2e-android-autenticado.json`): D1 aplica 60; D2 es rechazado con 23514 y anula el abono; inmediatamente después, una operación posterior en D2 (egreso de 20.000 COP) sincronizó correctamente, el historial convergió y un abono posterior de 40 en D1 saldó la deuda (saldo 0) totalizando en el servidor 11 lotes applied + 1 cancelled sin pagos duplicados.
       - Pruebas SQL concurrentes (`docs/validaciones/2026-10-29/carreras-sql-qa.json`): casos 60+60 y 40+60 sobre deuda 100 confirmaron la resolución de sobrepagos sin duplicidad.
       - Fixture nativo SDK real (`docs/validaciones/2026-10-31/issue25-native-reconnect-same-process.json` y `issue25-native-ledger.json`): cola reducida de 2 a 0, 1 pago de 60.00 COP y saldo 40.00 COP con 2 lotes en estado `cancelled`.
  4. *Cubrir reinicio, cambio de cuenta, reintento y pérdida de respuesta; conservar IDs y metadatos PowerSync*:
     - **Estado**: **Confirmado con salvedad en pérdida de respuesta nativa**.
     - **Capa y Evidencia**:
       - Reinicio sin conexión: Verificado en D1 (`e2e-android-autenticado.json`: reinicio de la app en D1 sin conexión conservó sesión, abono pendiente y KPI Debo 40) y en reinicio de proceso 2026-10-31 (`issue21-process-restart.json`).
       - Cambio de cuenta: Verificado históricamente en D2 con la secuencia A → B → C → A (`e2e-android-autenticado.json`, donde cada usuario vio únicamente su espacio y A conservó sus datos); verificado también en sesión de un dispositivo el 2026-10-30 (`docs/qa/issue25-24-21-ejecucion.md`) y el 2026-10-31 (`issue25-native-owner-b.json` y `issue25-native-owner-a-resume.json`). No es correcto afirmar que el cambio A/B/A solo se probó en un emulador: históricamente se ejecutó en D2 dentro de la malla de dos emuladores.
       - Reintento: Confirmado idempotente en RPC `cancelar_lote_abono` (`carreras-sql-qa.json` y `issue24-25-http-response-loss.json`).
       - Pérdida de respuesta: Validado a nivel HTTP/proxy sintético (`issue24-25-http-response-loss.json`), pero **NO reproducido nativamente en la aplicación móvil** (declarado explícitamente como no cubierto en el cliente en `e2e-android-autenticado.json:43`). Esta brecha permanece abierta.
  5. *Verificar el escenario en development builds con dos dispositivos y datos sintéticos*:
     - **Estado**: **Confirmado históricamente (2026-10-29/30) / Pendiente de repetición en build actual**.
     - **Capa y Evidencia**:
       - Verificado plenamente el 2026-10-29/30 en `docs/validaciones/2026-10-29/e2e-android-autenticado.json` utilizando dos emuladores (`emulator-5554` y `emulator-5556`) con tres usuarios sintéticos (`A`, `B`, `C`), cubriendo abonos offline 60+60, anulación en D2 y convergencia total.
       - La limitación actual es que dicha prueba no ha sido repetida sobre el build de producto reciente (`c43c9c15`) debido al bloqueo de inicio/ANR, y el inventario del host a 2026-10-31 solo tiene activo `emulator-5554`.
  6. *Causa del reintento tardío tras reconexión*:
     - **Estado**: **Desconocido**.
     - **Capa y Evidencia**: Observado en D2 durante el E2E histórico (`e2e-android-autenticado.json`: "aviso 'retry' sin cambio en ~60 s; se resolvió al reiniciar la app"). El harness unitario (`reactivacionSubida.test.ts`) descartó defectos en el bucle abstracto del SDK, pero la causa física en el cliente móvil no está dilucidada.

---

### Issue #24: Revisar y desplegar el protocolo de sincronización atómica v1

- **Estado General**: **Abierto** (Protocolo, RPCs, RLS, replicación, concurrencia SQL y concurrencia en 2 dispositivos móviles plenamente confirmados; pendientes: revisión de PR #37 con lmilo, autorización de restricción de publicación SQL y repetición en build actual).
- **Reconciliación de Criterios**:
  1. *Abrir y revisar PR pequeño contra feat/edav-sync-cifrado; coordinar con lmilo porque afecta la subida de las ocho tablas*:
     - **Estado**: **Pendiente**.
     - **Capa y Evidencia**: PR #37 fue abierto por edav desde `orchestration/issue-26` hacia `main` (commit head actual `b721bab4b4443fdc89a31d6d9f6dbdcb68d9c6c3`, históricamente `a914e2d`). La revisión conjunta y coordinación con lmilo está pendiente. Por directiva de AGENTS.md, QA no contacta a colaboradores externos.
  2. *Verificar CI del SHA exacto*:
     - **Estado**: **Confirmado**.
     - **Capa y Evidencia**: GitHub Actions en ejecución 41192959696 (duración 41 s) aprobó la totalidad de las 230 pruebas (79 shared + 151 app), `typecheck` y `lint` para el SHA actual `b721bab4b4443fdc89a31d6d9f6dbdcb68d9c6c3` (la ejecución histórica 41192681667 sobre `a914e2d` también resultó aprobada en 46 s).
  3. *Inspeccionar en solo lectura el destino remoto, migraciones aplicadas, grants y exposición del esquema private*:
     - **Estado**: **Confirmado (Modo Solo Lectura)**.
     - **Capa y Evidencia**:
       - `docs/validaciones/2026-10-30/issue24-backend-readonly-1793421007115.json`: destino Supabase `pqxvttkyevbkfdhmcmxu` verificado con migraciones 0001–0016; 8 tablas del dominio con RLS activo (`guarded_domain_tables: 8`, `domain_tables_without_rls: 0`); 0 concesiones de borrado físico (`physical_delete_grants: 0`); RPCs `aplicar_lote_sync` y `cancelar_lote_abono` restringidas a `authenticated`.
       - `docs/validaciones/2026-10-30/issue24-private-exposure.json`: consulta HTTP a PostgREST con `Accept-Profile: private` devolvió HTTP 406 (`PGRST106`), comprobando que el esquema `private` no está expuesto.
       - `docs/validaciones/2026-10-30/issue24-powersync-status.json` y `issue24-powersync-config.json`: replicación activa sin errores para las 8 tablas, con hash SHA-256 remoto idéntico a `powersync/sync-config.yaml` (`4bd50a03b6bc6edf09402608b0c4ae64b9a0b3d8e509220aa6b0b99399c8f8b4`).
  4. *Preparar y autorizar el despliegue coordinado de backend y clientes: clientes nuevos requieren RPC y clientes antiguos dejan de poder escribir directamente tras 0012*:
     - **Estado**: **Confirmado rechazo a cliente antiguo / Pendiente autorización de publicación**.
     - **Capa y Evidencia**:
       - Rechazo de cliente anterior: comprobado en `docs/validaciones/2026-10-30/issue24-old-client-verified.json`. Petición de escritura directa sin protocolo atómico rechazada con HTTP 400 y SQLSTATE `23514` por statement trigger `exigir_lote_sync`, con 0 filas insertadas.
       - Restricción de publicación PostgreSQL: La propuesta de restringir la publicación `powersync` (definida como `FOR ALL TABLES` en 0003) a las 8 tablas del dominio permanece como **Propuesto** y requiere autorización previa y migración SQL.
  5. *Aplicar únicamente los cambios aprobados y verificar RPC mediante PostgREST, RLS, replicación PowerSync e idempotencia*:
     - **Estado**: **Confirmado**.
     - **Capa y Evidencia**: Replay idempotente validado mediante proxy de intercepción en `docs/validaciones/2026-10-30/issue24-25-http-response-loss.json` (respuesta `already_applied` al reenviar lote tras pérdida de socket, 1 fila persistida, 0 duplicados). Replicación PowerSync confirmada sin errores en `issue24-powersync-status.json`.
  6. *Validar concurrencia 60+60 y 40+60 sobre principal 100 con datos sintéticos; sin duplicados al reintentar*:
     - **Estado**: **Confirmado**.
     - **Capa y Evidencia**:
       - Capa SQL: `docs/validaciones/2026-10-29/carreras-sql-qa.json` (`test-sync-concurrency.mjs` con dos conexiones PostgreSQL simultáneas) confirmó 60+60 (un lote aplicado, sobrepago rechazado sin residuos; reintento idempotente) y 40+60 (saldo final correcto; reintento idempotente).
       - Capa Móvil / PowerSync: `docs/validaciones/2026-10-29/e2e-android-autenticado.json` confirmó en vivo en dos emuladores Android concurrentes (`emulator-5554` y `emulator-5556`) que 60+60 offline aplica en D1 y rechaza en D2 con 23514, y 40+60 salda la deuda en el servidor con 11 lotes applied + 1 cancelled sin duplicados.
       - Capa HTTP Replay: `docs/validaciones/2026-10-30/issue24-25-http-response-loss.json` confirmó reintento idempotente tras socket destruido.

---

### Issue #21: Implementa llave SQLCipher y migración segura de bases locales

- **Estado General**: **Abierto** (Replay nativo comprobado en Android; integración en flujo de arranque del producto final bloqueada por ANR).
- **Reconciliación de Criterios**:
  1. *Generar una llave fuerte por usuario y guardarla en SecureStore; nunca imprimirla, versionarla ni almacenarla en .env*:
     - **Estado**: **Confirmado**.
     - **Capa y Evidencia**: `app/src/lib/db/databaseKeys.ts` genera llaves aleatorias de 32 bytes con `getRandomBytesAsync(32)` y las almacena en `expo-secure-store`. No se imprimen ni se versionan. La variable ficticia `SQLCIPHER_DEV_KEY` fue excluida del código activo.
  2. *Detectar y migrar de forma segura las bases existentes, conservando registros y la cola de escrituras pendientes; validar la copia antes de sustituir archivos*:
     - **Estado**: **Confirmado en Android**.
     - **Capa y Evidencia**:
       - Creación y exportación de cola: `docs/validaciones/2026-10-31/issue21-native-create.json` (`queueEntries: 2`, `queueHash: e2e4ec1881c5`, `preservedQueue: true`, `preservedClient: true`, `sourcePreserved: true`). Las bases originales en texto plano se mantuvieron intactas sin sustitución destructiva.
       - Reinicio forzado verificado: `docs/validaciones/2026-10-31/issue21-process-restart.json` (cambio de PID 3336 a 3924 tras `force-stop`).
       - Drenado remoto y reanudación: `docs/validaciones/2026-10-31/issue21-native-resume.json` (SDK PowerSync drenó 2 operaciones, 1 llamada de subida, 1 transacción completada, lote `cece8db4-dae0-49d9-8b56-1fd5231fa47d:1:2`).
       - Recibo en ledger remoto: `docs/validaciones/2026-10-31/issue21-native-ledger.json` (1 recibo `applied`).
  3. *Mantener aislamiento entre cuentas y funcionamiento tras reiniciar, cerrar sesión y volver a entrar*:
     - **Estado**: **Confirmado en Android**.
     - **Capa y Evidencia**: Verificado históricamente en D2 en la secuencia A → B → C → A (`docs/validaciones/2026-10-29/e2e-android-autenticado.json`). Aislamiento re-validado en `emulator-5554` con bases de datos independientes por usuario (`vaulto.<userId>.sqlite`) en `docs/qa/issue25-24-21-ejecucion.md`. Rechazo de apertura por tercero verificado en `docs/validaciones/2026-10-31/issue25-native-owner-b.json` (`propietario-distinto`).
  4. *Probar en development builds Android/iOS que el archivo no se abre sin la llave correcta y que el flujo recupera errores sin borrar información*:
     - **Estado**: **Confirmado en Android / Excluido en iOS**.
     - **Capa y Evidencia**: En Android, el intento de apertura sin la clave correspondiente se bloquea preservando el archivo original. iOS queda fuera de alcance.
  5. *Documentar y solicitar autorización explícita para cualquier operación destructiva sobre archivos existentes*:
     - **Estado**: **Confirmado**.
     - **Capa y Evidencia**: Las bases en texto plano originales se preservan íntegramente (`sourcePreserved: true`). No se ha autorizado ni ejecutado borrado de archivos locales.
  6. *Reenvío exactamente una vez de una transacción pendiente tras migrar y reiniciar (#6)*:
     - **Estado**: **Confirmado en Android**.
     - **Capa y Evidencia**: `issue21-native-resume.json` y `issue21-native-ledger.json` registran exactamente 1 llamada de subida y 1 recibo `applied` para el lote migrado.

---

### Issue #18: Alinear docs del spine al modelo canónico

- **Estado General**: **Abierto** (Documentación técnica y análisis completados; revisión compartida con lmilo pendiente).
- **Reconciliación de Criterios**:
  1. *Actualizar ARQUITECTURA.md §1 y supabase/policies/README.md: RLS por pivot `espacio_miembro` y `espacio_id` NOT NULL (salvo `espacio`), reemplazando la versión por `user_id` suelto*:
     - **Estado**: **Confirmado en documentación**.
     - **Capa y Evidencia**: Commit `8f68b6f572ba0e28fba49cc90be5f7a3e932da5b` en PR #37 actualizó `ARQUITECTURA.md` y `supabase/policies/README.md`, reflejando la pertenencia por membresía, el trigger de sincronización atómica, llaves de 32 bytes y reglas de PowerSync.
  2. *Revisar e integrar documentación de PR #22 y rama atómica (#23, #24)*:
     - **Estado**: **Confirmado**.
     - **Capa y Evidencia**: Integrado en la rama `orchestration/issue-26` (PR #37). DEV revisó el diff en `docs/qa/issue18-actualizacion.md` contrastando el código contra la documentación.
  3. *Reconciliar checklists/rutas antiguas del plan, README y runbooks con lo realmente implementado, sin presentar pruebas pendientes como ejecutadas*:
     - **Estado**: **Confirmado**.
     - **Capa y Evidencia**: El coordinador corrigió los hallazgos de DEV (unificación de `PUBLISHABLE_KEY` sobre `ANON_KEY`, eliminación de variable ficticia de cifrado y notas de estado contrastadas).
  4. *Confirmar coordinación con lmilo en la revisión compartida*:
     - **Estado**: **Pendiente**.
     - **Capa y Evidencia**: La revisión compartida con lmilo no se ha efectuado. No se han remitido mensajes a canales externos.

---

## 3. Matriz de Diferenciación de Pruebas: Capas y Alcances Reales

| Capa / Categoría | Herramienta y Entorno | Alcance Realmente Acreditado | Lo que NO Acredita (Brechas / Incertidumbres) |
| :--- | :--- | :--- | :--- |
| **CI / Pruebas Unitarias** | GitHub Actions (run actual 41192959696 sobre SHA `b721bab`, histórico 41192681667), Vitest (`230 pruebas: 79 shared + 151 app`), `tsc`, ESLint | Tipos estáticos, reglas de formato, dominio puro (cálculos de deudas y saldos), helpers puros (`qaStorageRemote`, `qaSyncRecovery`), y máquina de estados abstracta de reintentos (`reactivacionSubida.test.ts`). | No valida el runtime nativo de SQLite, bibliotecas nativas compiladas (`libop-sqlite.so`, `libpowersync.so`), `expo-secure-store` en hardware ni caídas reales de radio móvil. |
| **SQL Concurrente / pgTAP** | `test-sync-concurrency.mjs` y `test-rls-local.mjs` contra PostgreSQL local/remoto | Concurrencia transaccional pura 60+60 y 40+60 (`carreras-sql-qa.json`), RLS y grants (`sql-qa-completa.json`). | No prueba PowerSync Cloud, transporte móvil ni la máquina de estados de la aplicación Android. |
| **Backend / HTTP Remoto** | PostgREST y RPCs en Supabase `pqxvttkyevbkfdhmcmxu` mediante proxy local con intercepción socket-drop (`test-drop-proxy.mjs`) | Idempotencia en servidor de `aplicar_lote_sync` y `cancelar_lote_abono`, recibos en `private.vaulto_sync_lote`, permisos de roles y rechazo de clientes anteriores con SQLSTATE 23514. | No acredita la experiencia en dispositivo móvil ni la recuperación ante caídas nativas de red en el cliente. |
| **E2E Dos Dispositivos (Histórico)** | `emulator-5554` (`VaultoQA1`) y `emulator-5556` (`VaultoQA2`) simultáneos (`e2e-android-autenticado.json`, 2026-10-29/30) | Colisión offline 60+60 en dos emuladores, D1 aplica, D2 rechazo 23514 y anulación en UI, sync de operación posterior en D2, reinicio offline en D1, abono final 40 y cambio multi-cuenta D2 (A → B → C → A). | Ejecutado sobre APK de desarrollo histórico (previo a PR #31/#37). No reprodujo pérdida de respuesta de red nativa en el móvil. No cubre el build reciente. |
| **Nativo Dev-Only (1 AVD — Reciente)** | `emulator-5554` (`VaultoQA1`), dev-client cargando rutas aisladas `/qa-storage` y `/qa-sync-recovery`, proxy Metro loopback (2026-10-31) | Exportación a SQLCipher en disco Android, preservación de cola/clientId tras force-stop, drenado con SDK PowerSync nativo y rechazo de apertura a terceros. | Limitado a rutas dev sintéticas. Ejecutado en exactamente **1 emulador Android** (inventario actual del host). No valida la interfaz del producto. |
| **Build de Producto EAS (Reciente)** | APK de desarrollo EAS (`c43c9c15-5167-4ae3-8ecf-7d878efefdf8`), instalado con firma en `emulator-5554` (2026-10-31) | Descarga de binario compilado e instalación con reemplazo de paquete (`adb install -r`). | **No Verificado / Bloqueado**: El proceso termina en `START TIMEOUT` y `ANR` antes de cargar JS (`native-product-startup.json`). Dashboard de producto no renderizado. |

---

## 4. Registro de Comandos y Evidencias Exactas

| Comando / Verificación | Parámetros / Entrada | Resultado Exacto Registrado | Ruta de Artefacto / Fuente |
| :--- | :--- | :--- | :--- |
| `adb devices` (Host actual) | N/A (solo lectura, 2026-10-31) | `emulator-5554 device` (1 solo emulador activo en host actual) | Inspección directa en sesión de trabajo |
| E2E multi-dispositivo (Histórico) | 2 AVDs simultáneos (`emulator-5554` y `emulator-5556`, 2026-10-29/30) | 60+60 offline: D1 aplica, D2 rechazo 23514 y anulación; D1 reinicio offline; D2 sync posterior; D1 pago 40 salda deuda; D2 A→B→C→A | `docs/validaciones/2026-10-29/e2e-android-autenticado.json` |
| Carreras SQL concurrentes | `node scripts/test-sync-concurrency.mjs` (2 conexiones Postgres, 2026-10-29) | 60+60 y 40+60 sobre deuda 100 aprobados con reintentos idempotentes | `docs/validaciones/2026-10-29/carreras-sql-qa.json` |
| `gh pr view 37` | `--json statusCheckRollup` | CI exitoso en run 41192959696 (41 s, SHA `b721bab`; histórico run 41192681667, 46 s, SHA `a914e2d`) | GitHub Actions / PR #37 |
| Inspección RLS y migraciones (Supabase CLI) | Destino `pqxvttkyevbkfdhmcmxu` | Migraciones 0001–0016; 8 tablas con RLS; 0 grants de borrado físico; RPC solo authenticated | `docs/validaciones/2026-10-30/issue24-backend-readonly-1793421007115.json` |
| `powersync fetch config` / `status` | Comparación SHA-256 | Hash `4bd50a03...` idéntico a `powersync/sync-config.yaml`; réplica inicial completada sin errores | `docs/validaciones/2026-10-30/issue24-powersync-config.json`, `issue24-powersync-status.json` |
| PostgREST esquema privado | `Accept-Profile: private` | HTTP 406 (`PGRST106`), `privateExposed: false` | `docs/validaciones/2026-10-30/issue24-private-exposure.json` |
| PostgREST cliente directo sin RPC | `POST /rest/v1/categoria` (token válido) | HTTP 400, SQLSTATE `23514`, 0 filas insertadas | `docs/validaciones/2026-10-30/issue24-old-client-verified.json` |
| Replay HTTP con pérdida de respuesta | `POST /rest/v1/rpc/aplicar_lote_sync` | Reintento devuelve `already_applied`, 1 sola fila en categoría | `docs/validaciones/2026-10-30/issue24-25-http-response-loss.json` |
| Cancelación HTTP con pérdida de respuesta | `POST /rest/v1/rpc/cancelar_lote_abono` | Reintento devuelve `cancelled`, saldo 40 COP, 0 pagos adicionales | `docs/validaciones/2026-10-30/issue24-25-http-response-loss.json`, `issue24-response-loss-ledger.json` |
| Fixture nativo `remote-create` | Deep link `/qa-storage?mode=remote-create` (2026-10-31) | Exportación a SQLCipher completada, 2 entradas en cola preservadas, fuente intacta | `docs/validaciones/2026-10-31/issue21-native-create.json` |
| Detención forzada de app | `adb shell am force-stop com.vaulto.app` (2026-10-31) | PID anterior 3336 terminado; nuevo proceso verificado con PID 3924 | `docs/validaciones/2026-10-31/issue21-process-restart.json` |
| Fixture nativo `remote-resume` | Deep link `/qa-storage?mode=remote-resume` (2026-10-31) | SDK PowerSync drena 2 operaciones, 1 transacción completada, lote `cece8db4-...:1:2` | `docs/validaciones/2026-10-31/issue21-native-resume.json` |
| Verificación SELECT de lote migrado | `SELECT FROM private.vaulto_sync_lote` (2026-10-31) | 1 recibo `applied` para el lote migrado | `docs/validaciones/2026-10-31/issue21-native-ledger.json` |
| Caída y reconexión en mismo proceso | Fixture `/qa-sync-recovery`, detención de puente (2026-10-31) | SDK reconectó, outbox=0, recibo `cancelled`, 1 pago 60 COP, saldo 40 COP | `docs/validaciones/2026-10-31/issue25-native-reconnect-same-process.json` |
| Intento de apertura por usuario B | Fixture `/qa-sync-recovery` de A con sesión B (2026-10-31) | Rechazado con `propietario-distinto`, `opened: false`, `uploaded: false` | `docs/validaciones/2026-10-31/issue25-native-owner-b.json` |
| Reanudación por usuario A | Fixture `/qa-sync-recovery` reabierto por A (2026-10-31) | Cola persistida, outbox=0, saldo 40 COP, resultado `passed` | `docs/validaciones/2026-10-31/issue25-native-owner-a-resume.json` |
| Verificación SELECT recibos cancelados | `SELECT FROM private.vaulto_sync_lote` (2026-10-31) | Recibos `cancelled` para lotes `b2957f76...` y `7446c2fd...` | `docs/validaciones/2026-10-31/issue25-native-ledger.json` |
| Lanzamiento APK producto EAS | Intent de inicio hacia `MainActivity` (2026-10-31) | `START TIMEOUT` (PIDs 9070, 9174) y `ANR` (PID 9282). UI no renderizada | `docs/validaciones/2026-10-31/native-product-startup.json` |

---

## 5. Prerrequisitos Humanos y de Infraestructura Identificados

1. **Prerrequisitos Humanos (Bloqueos de Aprobación y Coordinación)**:
   - **Revisión formal de lmilo**: Imprescindible para avanzar en la integración de PR #37 y en el cierre de los Issues #18 y #24. La coordinación con lmilo está pendiente y fuera del alcance directo de QA.
   - **Autorización de migración SQL para publicación PowerSync**: La restricción de `powersync FOR ALL TABLES` hacia las tablas específicas del dominio permanece como propuesta y requiere revisión de impacto y autorización administrativa.
   - **Autorización para depuración de archivos legacy**: Las copias de bases SQLite sin cifrar se mantienen en disco local y su eliminación requiere aprobación expresa.

2. **Prerrequisitos de Infraestructura y Dispositivos**:
   - **Investigación y resolución del ANR de inicio**: Resolver la falla de arranque nativo en el APK antes de poder certificar la experiencia de usuario y el dashboard en producción.
   - **Aprovisionamiento de memoria / segundo dispositivo para nuevas pruebas concurrentes**: Aunque la prueba histórica de dos dispositivos está comprobada en `e2e-android-autenticado.json`, repetir el escenario con el APK actual requiere liberar memoria en el host (> 3 GB libres) para iniciar `VaultoQA2` o conectar un teléfono físico.
   - **Prueba nativa de pérdida de confirmación en cliente móvil**: Reproducir la pérdida de socket directamente en el cliente nativo Android durante una subida, más allá del proxy HTTP sintético.

---

## 6. Mínimo Siguiente Paso Seguro de Validación (Minimum Safe Next Validation)

1. **Para Issue #25**:
   - Diagnosticar el fallo de arranque del APK mediante inspección de símbolos de React Native / Hermes y ciclo del Splash Screen en Android Logcat, sin modificar código de producción a ciegas.
   - Instrumentar una prueba de desconexión de red a nivel de radio móvil/ADB en el cliente nativo para validar el manejo de pérdida de confirmación directamente en la app.
2. **Para Issue #24**:
   - Solicitar a través del coordinador la revisión técnica de lmilo sobre PR #37.
   - Evaluar con el equipo la necesidad y autorización de aplicar la migración que acota la publicación PostgreSQL antes del paso a producción.
3. **Para Issue #21**:
   - Comprobar que el flujo ordinario de inicio de sesión abra la base cifrada de forma transparente tras superar el ANR de arranque.
   - Mantener las bases en texto plano preservadas hasta orden de limpieza.
4. **Para Issue #18**:
   - Presentar a lmilo el informe de alineación documental contenido en PR #37 para su aprobación final.
