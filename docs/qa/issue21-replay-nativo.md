# Validación de Replay Nativo: Issue #21

Fecha: 2026-10-31  
Rama: `feature/qa-tests` (base `42ee322`)  
Dispositivo de ejecución: `emulator-5554` (`VaultoQA1`, Android API 36)  
Servidor Metro: `127.0.0.1:8086` (commit de integración `a56afb0`)  
Backend remoto de validación: Supabase `pqxvttkyevbkfdhmcmxu`

---

## 1. Resumen Ejecutivo y Estado

Se inició la verificación técnica del replay remoto para el **Issue #21** utilizando el fixture dev-only implementado por DEV Claude en `c4441fb` (integrado en `a56afb0`), el cual incorpora los modos `remote-create` y `remote-resume` en `app/src/app/qa-storage.tsx` y helpers de dominio en `app/src/lib/db/qaStorageRemote.ts`.

Se estableció exitosamente la conectividad con el servidor Metro 8086 y la carga del bundle en el emulador Android. No obstante, la ejecución de la ruta del fixture quedó bloqueada en el paso previo de autenticación de UI debido a inconsistencias de longitud en la automatización de entrada de la contraseña por ADB.

Por instrucción del coordinador y usuario, se suspendió la automatización de UI para liberar el AVD y permitir una entrada controlada, entregando un reporte técnico honesto sin declarar pruebas nativas como aprobadas. El Issue #21 permanece **Abierto**.

---

## 2. Lo que SÍ se ejecutó y confirmó

1. **Configuración de Red y Metro 8086**:
   - Se configuró el reenvío de puertos mediante `adb reverse tcp:8086 tcp:8086` hacia `emulator-5554`.
   - Se habilitó un proxy loopback en `127.0.0.1:8086` (`scratch/proxy-8086.mjs`) para puentear peticiones IPv4 de ADB hacia el proceso Metro del coordinador que escucha en `[::1]:8086` (PID 30324), sin alterar certificados ni bypass de TLS.
   - Se consultó y verificó el manifiesto de Expo dev-client en `http://127.0.0.1:8086/` (SDK 58.0.0, Hermes bytecode).

2. **Carga del Bundle en AVD1**:
   - Se realizó un arranque frío limpio de `com.vaulto.app` en `emulator-5554` mediante un intent único de dev-launcher:
     ```sh
     adb shell am start -a android.intent.action.VIEW -d "exp+vaulto://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8086"
     ```
   - La aplicación cargó el bundle correctamente desde Metro 8086 y renderizó la pantalla de autenticación nativa.

3. **Pruebas de Contrato Unitarias (DEV `c4441fb`)**:
   - Se verificaron localmente las 13 pruebas unitarias de contrato de `app/src/lib/db/qaStorageRemote.test.ts` (validación de propietario, estructura de categorías sintéticas y serialización de estado), resultando todas correctas.

---

## 3. Delimitación del Bloqueo Técnico en UI

1. **Requisito del Fixture `remote-create`**:
   - `qa-storage.tsx` exige sesión activa de Supabase (`if (remote && (initializing || !session)) return;`) para validar la identidad del propietario (`currentOwner`) contra el espacio asignado antes de armar la fuente plaintext aislada.
2. **Falla en Automatización de Contraseña**:
   - Al intentar iniciar sesión con Usuario A mediante script ADB en el formulario de la app, el búfer de entrada virtual del emulador registró 23 caracteres en el XML de UI en lugar de los 24 caracteres requeridos por el fixture sintético de QA.
   - La API de autenticación remota responde HTTP 200 con el UID esperado cuando se consulta de forma directa con las credenciales de QA, confirmando que las credenciales son válidas y que el fallo es exclusivamente de la automatización de entrada de texto en el emulador.
   - La interfaz de la app mostró `Invalid login credentials`, impidiendo la navegación autenticada hacia `/qa-storage?mode=remote-create`.

---

## 4. Estado de Verificación y Pendientes

| Criterio | Estado | Evidencia / Observación |
| :--- | :--- | :--- |
| **Metro 8086 cargado en AVD1** | **Confirmado** | Manifest 200, bundle Hermes cargado, UI dev-client operativa en `emulator-5554`. |
| **Pruebas de contrato `qaStorageRemote`** | **Confirmado** | 13/13 pruebas pasadas en Vitest (`qaStorageRemote.test.ts`). |
| **Ejecución `remote-create` nativa** | **Pendiente / Bloqueado** | Requiere sesión activa en UI; bloqueado por entrada de credenciales en el emulador. |
| **Ejecución `remote-resume` (drenado)** | **Pendiente** | Requiere ejecución exitosa previa de `remote-create` y force-stop. |
| **Confirmación de IDs en backend remoto** | **Pendiente** | Se verificará tras el drenado remoto de la cola migrada. |

---

## 5. Próximos Pasos Coordinados

1. El coordinador asumirá el control de entrada de credenciales en `emulator-5554` con verificación de longitud previa a la pulsación de `Entrar`.
2. Una vez establecida la sesión de Usuario A, se ejecutará el deep link `/qa-storage?mode=remote-create` y se capturará el reporte JSON.
3. Se procederá con `adb shell am force-stop com.vaulto.app` y la reapertura en `/qa-storage?mode=remote-resume` para certificar la transmisión de la misma cola migrada.
