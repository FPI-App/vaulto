# Diagnóstico del arranque nativo y estado de evidencia de #25, #24 y #21 — 2026-10-31

Revisión de DEV, solo de lectura. No se cambió código de producción ni se ejecutaron pruebas, operaciones de dispositivo ni accesos al backend para esta versión. Convención: **Confirmado** (hay un archivo o consulta citado), **Supuesto**, **Desconocido**, **Propuesto**.

Rutas «worktree del orquestador» = `ORQUESTADOR-Codex-Main/` (no están en `feature/dev-features`). El informe de QA es `docs/qa/pending-acceptance-25-24-21-18.md` en la rama `feature/qa-tests` (leído con `git show`, sin tocar ese worktree).

> **Corrección.** La versión anterior de este informe decía que #25 estaba bloqueado por `uploadError: conflict` y que le faltaba un segundo dispositivo. Ambas frases quedan retiradas: (a) `conflict` era una captura intermedia (`issue25-native-blocked.json`, estado `blocked`); las capturas posteriores terminan en `passed`; (b) existe evidencia histórica de dos dispositivos (sección 3, capa C). Lo que sigue pendiente es otra cosa y se precisa abajo.

## 1. Arranque del APK de producto (`c43c9c15`): causa raíz no probada

### Confirmado
- `docs/validaciones/2026-10-31/native-product-startup.json` (worktree del orquestador): APK EAS `c43c9c15-5167-4ae3-8ecf-7d878efefdf8`, perfil `development`, commit `df2b6a8`, instalado con reemplazo y firma coincidente. Android registró dos `INITIALIZATION FAILURE: start timeout state=empty` (10:17:54 y 10:19:27) y un `ANR: process failed to complete startup` (10:22:49); el dashboard no se renderizó (`result: dashboard-not-rendered`, `rootCause: unknown`).
- Esos eventos ocurren antes de que arranque JS, por lo que `app/src/lib/sync/db.ts`, `PowerSyncProvider` y las rutas no pueden provocarlos.
- `app/app.json`, `app/package.json`, `app/eas.json` y `pnpm-lock.yaml` no cambiaron entre `df2b6a8` y `HEAD` (`git diff --stat`).
- Compilación previa `9692ce86`: `SplashScreenManager class not found`. `expo-dev-launcher` busca esa clase por reflexión dentro de un `try/catch` (`node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/DevLauncherController.kt:516`); es un aviso no fatal y no explica un timeout previo a JS.
- Aparte, `docs/validaciones/2026-10-31/issue21-native-anr.json` registra un ANR anterior (05:02:22) con `DevLauncherErrorActivity` en pantalla. Es otro evento, en otro build; no se analizó su causa.

### Observaciones puntuales del emulador (hipótesis, no causa probada)
Lectura de solo lectura de `emulator-5554` durante esta tarea: x86_64, API 36, 2 CPU, ~2 GB de RAM, `MemFree` ≈ 110 MB, swap casi agotado, `ActivityManager` con operaciones lentas en `startProcess`/`bindApplication`, y `artd` indicando que `base.apk` (≈ 311 MB) «has no usable artifacts» (sin dexopt). **Esto es una correlación observada, no una causa demostrada**: no hay traza ANR ni arranque instrumentado que lo conecte con los tres eventos de las 10:17–10:22, que ocurrieron horas antes de esa lectura.

### Desconocido
- Qué hilo bloqueó `Application.onCreate`/`bindApplication` (falta la traza de `/data/anr` del momento).
- Si ocurre con más memoria, tras un dexopt, o en un dispositivo físico.

### Reproducción segura (solo lectura, sin borrar datos)
```sh
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
$ADB -s emulator-5554 shell dumpsys activity exit-info com.vaulto.app
$ADB -s emulator-5554 shell 'grep -E "MemAvailable|SwapFree" /proc/meminfo'
$ADB -s emulator-5554 logcat -d -v time -b main,system,crash | grep -E "com.vaulto.app|ANR in"
```
Para observar un arranque sin `pm clear` ni desinstalar: `adb shell am force-stop com.vaulto.app` y `adb shell am start -W -n com.vaulto.app/.MainActivity` (el `-W` informa `TotalTime`), capturando el logcat antes. Solo con autorización de QA (cambia el estado del emulador): `adb shell cmd package compile -m speed-profile -f com.vaulto.app`.

## 2. Inventario de dispositivos

- **Sesión del 2026-10-31 (Confirmado):** un solo emulador conectado, `emulator-5554`. Lo corroboran `adb devices` en esta tarea y el informe de QA (sección 1).
- **Evidencia histórica (2026-10-30):** `docs/validaciones/2026-10-29/e2e-android-autenticado.json` (`checkedAt` 2026-10-30T00:30:00Z; campo `clientes`) registra `emulator-5554` (VaultoQA1) y `emulator-5556` (VaultoQA2). La evidencia histórica no queda invalidada por el inventario actual, y el inventario actual no la reproduce.

## 3. Capas de evidencia (qué prueba cada una y qué no)

| Capa | Artefactos y fechas | Qué muestra | Qué NO prueba |
|---|---|---|---|
| **A. Servidor/SQL** | `docs/validaciones/2026-10-29/carreras-sql-qa.json` (2026-10-29T23:04:56Z): casos `60+60 sobre deuda 100` y `40+60 sobre deuda 100`, `passed: true`, reintentos idempotentes. `docs/validaciones/2026-10-29/sql-qa-completa.json`. | Atomicidad e idempotencia en PostgreSQL con dos conexiones simultáneas. | PowerSync, dispositivos, SDK nativo; el propio archivo lo aclara. |
| **B. Servidor remoto por HTTP** | `issue24-25-http-response-loss.json`, `issue24-response-loss-ledger.json`, `issue24-old-client-verified.json` (2026-10-31, en `docs/validaciones/2026-10-30/` del worktree del orquestador). | Reintento tras pérdida de respuesta: `already_applied` y `cancelled`, un recibo por lote; escritura directa de cliente antiguo rechazada con `23514`. | El SDK nativo (`nativeSdkExercised: false`). El archivo conserva `ok: false` y `rejected: false` en el caso de cliente antiguo por un oráculo incorrecto, ya corregido en `issue24-old-client-verified.json`. |
| **C. E2E histórico en dos emuladores** | `e2e-android-autenticado.json` (2026-10-30): «D1 y D2 sin conexion, abono 60 en cada uno»; «D1 reconecta: servidor con 1 pago»; «D2 reconecta: rechazo 23514 -> Revisar abono pendiente -> Anular abono -> cola desbloqueada»; «Operacion posterior en D2 (egreso 20.000) sincroniza»; «Reinicio de la app en D1 sin conexion … conservados»; «pagos 60+40, 11 lotes applied + 1 cancelled». | El escenario de #25 de extremo a extremo con la UI real en dos development builds, backend remoto y datos sintéticos. | 40+60 concurrente entre dispositivos (registra 60 y luego 40 en secuencia). Pérdida de respuesta con SDK nativo (su `noCubierto` la lista). Reinicio de D2 con la cola rechazada pendiente: D2 se reinició solo para forzar el reintento (observación «Desconocido»: no reintentó hasta reiniciar). Ejecución manual única, no repetida. |
| **D. Fixtures nativos de la sesión 2026-10-31 (1 emulador, rutas dev-only)** | #25: `issue25-native-reconnect-same-process.json` (09:23Z, `status: passed`, `decision: cancelled`, outbox 2 → 0, 1 pago de 60.00, saldo 40.00), `issue25-native-owner-b.json` (09:33Z, `rejected`, `propietario-distinto`, `opened: false`, `uploaded: false`), `issue25-native-owner-a-resume.json` (09:37Z, `passed`, mismo `clientIdHash` y `queueHash` en la captura), `issue25-native-ledger.json` (09:57Z, dos lotes `cancelled`, un recibo cada uno). Etapa intermedia `issue25-native-blocked.json` / `issue25-native-ab-test-blocked.json` (`blocked`, `conflict`). | Con el SDK real de PowerSync y SQLCipher en Android: rechazo, solicitud de anulación, reconexión en el mismo proceso, drenado de la cola, aislamiento por propietario y reanudación del dueño. | La UI normal del producto (rutas `qa-*` solo existen en development build, datos sintéticos). Dos dispositivos simultáneos. Pérdida de respuesta real en el conector nativo: `issue25-native-reconnect-same-process.json` simula una caída de red, no una respuesta perdida tras commit del servidor. |
| **E. CI / unitarias** | Pruebas de `app/src/lib/sync/` (`reactivacionSubida.test.ts`, `SyncRecoveryStore.test.ts`, `recuperacionAbonosRechazados.test.ts`), `qaSyncRecovery.test.ts`. | Lógica pura y máquina de estados. | Runtime nativo, SQLCipher, PowerSync nativo. |

Los fixtures de la capa D son aportados por QA y DEV solo los leyó; la ejecución nativa en sí no se repitió.

## 4. Estado por Issue

### #25 — abonos rechazados sin bloquear la cola
- **Aparece demostrado:** criterios 1–3 (anulación explícita atómica e idempotente; estado y acción recuperable; operación posterior sin duplicar pagos) con la capa C en UI real y dos dispositivos, más las capas A, B y D. Criterio 5 (dos development builds con datos sintéticos): la capa C lo describe en su ejecución del 2026-10-30.
- **Parcial o incierto:**
  - Criterio 4 (reinicio, cambio de cuenta, reintento, pérdida de respuesta, IDs y metadatos): reinicio de D1 y cambio de cuenta en el mismo dispositivo (capa C); IDs y metadatos conservados en los fixtures (capa D); pérdida de respuesta solo a nivel HTTP (capa B). **Falta cobertura de pérdida de respuesta/replay con el SDK nativo** y reinicio de D2 con una cola rechazada pendiente.
  - Reintento tardío tras reconectar: **Desconocido** (capa C y `docs/qa/pending-acceptance-25-24-21-18.md`).
  - Si la capa C satisface el criterio 5 tal como lo interpreta el Issue (es una ejecución histórica no repetida, con un build anterior al APK `c43c9c15`) es **Desconocido**; el juicio es del usuario/coordinador.
- **No bloqueado «solo» por falta de un segundo dispositivo.** Lo que impide validar la UI normal del producto en el APK actual es el arranque (sección 1).

### #24 — protocolo atómico
- 60+60: capas A y C. 40+60: solo capa A (en C es secuencial). Idempotencia: capas A y B. Cliente antiguo: capa B. Detalle de compuertas y discrepancias en `docs/qa/issue24-18-coordinacion-pendiente.md`.
- Pendiente: revisión de lmilo (externa), decidir si se repite 60+60/40+60, 40+60 concurrente entre dispositivos y la propuesta de acotar la publicación `powersync`.

### #21 — llave SQLCipher y migración
Evidencia nativa 2026-10-31 en un emulador (worktree del orquestador, `docs/validaciones/2026-10-31/`): `issue21-native-create.json` (05:52Z, `queueEntries: 2`, `queueHash` conservado, `preservedClient: true`, `sourcePreserved: true`), `issue21-process-restart.json`, `issue21-native-resume.json` (05:57Z, `drained: true`, `uploadCalls: 1`, `uploadFailures: 0`, lote `…:1:2`), `issue21-native-ledger.json` (05:59Z, un recibo `applied`).
- **Aparece demostrado en Android (1 dispositivo, ruta dev-only):** copia cifrada que conserva cola y `clientId`, reinicio de proceso, envío exactamente una vez de esa transacción y original conservado.
- **Brechas precisas:**
  1. Cambio de cuenta nativo en el **flujo real del producto** durante/tras la migración: los fixtures prueban `propietario-distinto` (25) y la migración (21) por separado.
  2. La migración ejecutada desde el arranque normal del producto: el APK `c43c9c15` no completa el arranque.
  3. iOS: fuera de alcance por decisión del usuario (`docs/VALIDACION-PRIORIDADES-2026-10-29.md`).
  4. Retirada del original en texto plano: conservado; borrarlo requiere autorización con ruta y comando exactos.
  5. Rechazo con llave incorrecta en development build: no se leyó un artefacto de esta sesión que lo cubra; **Desconocido** (la validación previa es `docs/validaciones/2026-10-29/sqlcipher-android-*.json`).

## 5. Cambios de código en la app
Ninguno necesario con esta evidencia. Las rutas `qa-storage` y `qa-sync-recovery` ya existen en `HEAD`. Lo pendiente es validación (arranque del APK, SDK nativo con pérdida de respuesta, dos dispositivos si se quiere repetir), no código.
