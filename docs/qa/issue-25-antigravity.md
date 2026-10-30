# Reporte QA — Issue #25: Recuperación de abonos rechazados (Alcance Local en Memoria)

Fecha: 2026-10-30  
Agente: Antigravity (QA)  
Rama: `feature/qa-tests`  
Base integrada: `290e01d` (DEV Claude)  
Estado: Completado a nivel de pruebas locales en memoria; bloqueado para cierre definitivo por pendientes nativos E2E (Issue #25 permanece abierto).

---

## 1. Alcance real y delimitación técnica

Este reporte documenta exclusivamente las pruebas de comportamiento e integración ejecutadas en memoria mediante Node.js, `node:sqlite` y mocks de Vitest.
**No constituye validación E2E nativa**, no prueba SQLCipher sobre disco, no comprueba reconexión automática de red ni garantiza comportamiento remoto sin el backend real.

---

## 2. Casos evaluados en suite local (`app/src/lib/sync/recuperacionAbonosRechazados.test.ts`)

1. **Caso 1 — Deuda 100 con abonos offline 60+60 en dos bases locales simuladas**:
   - Crea deuda de 100.00 en dos instancias separadas de SQLite en memoria.
   - Aplica abono de 60.00 en cada base de forma aislada, dejando ambos saldos locales en 40.00.
2. **Caso 2 — Rechazo visible al fallar restricción simulada**:
   - Simula error de restricción `23514` en la llamada RPC.
   - `SupabaseConnector` captura `23514`, registra el lote en `SyncRecoveryStore` con decisión `blocked` y eleva `SyncUploadError('conflict')`.
   - La cola local preserva la transacción (no invoca `complete()`).
   - El estado `blocked` queda guardado en la tabla local `vaulto_sync_recovery`.
3. **Caso 3 — Anulación explícita del abono en conflicto y liberación de la cola**:
   - Marca `requestCancellation` en el store (decisión pasa a `requested`).
   - El siguiente intento de `uploadData` invoca RPC `cancelar_lote_abono` con `p_lote_id` y `p_operaciones`.
   - Con recibo simulado `cancelled`, actualiza a `cancelled` en el store y completa la transacción local.
4. **Caso 4 — Operación posterior procesada tras anular el conflicto**:
   - Con la cola liberada tras anular el lote previo, una operación posterior (abono de 40.00) es enviada a `aplicar_lote_sync` y se completa exitosamente (`applied`).
5. **Caso 5 — Recreación de SyncRecoveryStore sobre la misma conexión**:
   - Recrea una nueva instancia de `SyncRecoveryStore` sobre la misma conexión de base de datos activa.
   - Recupera la fila con decisión `requested` y contenido de operaciones intacto.
   - *Delimitación*: No reinicia el motor SQLite ni prueba persistencia tras cierre de proceso sobre archivo cifrado.
6. **Caso 6 — Cambio de cuenta con anulación pendiente**:
   - Al cambiar la sesión a un usuario distinto (`usr-qa-2-intruso`), `SupabaseConnector` detecta el cambio en `requireSession` y detiene la sincronización sin llamar al RPC remoto ni completar la transacción.
   - Al restaurar la sesión del usuario propietario, la llamada a `cancelar_lote_abono` se reanuda y completa normalmente.
7. **Caso 7 — Reintento manual tras error transitorio de red**:
   - Simula fallo transitorio de red (`NETWORK` / `retry`). La decisión se mantiene en `requested` y la cola no se completa.
   - Invocando manualmente `uploadData` en un segundo paso con recibo simulado exitoso, la llamada RPC se retransmite con el mismo `batch_id` y completa la transacción.
   - *Delimitación*: Es una invocación manual secuencial en prueba unitaria; no valida el bucle de reconexión automática ni el daemon de sincronización de PowerSync.
8. **Caso 8 — Fallo local de complete seguido de recibo simulado already_applied**:
   - Simula un fallo en la llamada local `complete()` tras invocar `cancelar_lote_abono`.
   - En la siguiente invocación de `uploadData`, el mock responde con `already_applied`.
   - El conector lo acepta como estado terminal válido y llama a `confirm` y `complete()`.
   - *Delimitación*: Simula un fallo de promesa local y respuesta mockeada; no comprueba idempotencia remota en la base PostgreSQL real ni transacción de servidor.
9. **Caso 9 — Consultas y registros locales filtran por espacio_id**:
   - Verifica que las sentencias SQL de consulta y registro en SQLite local incluyan el filtro `WHERE espacio_id = ?`.
   - *Delimitación*: No valida políticas de seguridad a nivel de fila (RLS) en PostgreSQL ni reglas de sincronización de PowerSync.

---

## 3. Resultados reales de verificación en este worktree

### 3.1 Pruebas de unidad e integración (`vitest`)
```bash
pnpm test
```
- `packages/shared`: 6 archivos pasados, 79 tests pasados (100%).
- `@vaulto/app`: 16 archivos pasados, 114 tests pasados (100%).
  - `src/lib/sync/recuperacionAbonosRechazados.test.ts`: 9 tests pasados.
  - `src/lib/sync/SupabaseConnector.test.ts` (con cambios de Claude integrados): 22 tests pasados.
- Total combinado: 193 tests pasados, 0 fallos.

### 3.2 Comprobación estricta de tipos (`tsc`)
```bash
pnpm typecheck
```
- `packages/shared`: Exitoso, 0 errores.
- `@vaulto/app`: Exitoso, 0 errores.

### 3.3 Linter
```bash
pnpm lint
```
- `packages/shared`: Script ficticio `echo "(pendiente configurar linter)"` (Issue #26 pendiente; no es linter verificado).
- `@vaulto/app`: `expo lint` finalizado exitosamente sin errores ni advertencias.

---

## 4. Disponibilidad de hardware y emuladores (Pruebas Nativas)

- **Comprobación**: Se ejecutó `adb devices` en el entorno; la herramienta `adb` no se encuentra instalada ni configurada en PATH, y no existen variables `ANDROID_HOME` o emuladores en ejecución.
- **Estado de pruebas nativas**: **Pendiente / Bloqueado**.
- **Impacto en Issue #25**: Conforme a los criterios de aceptación del plan y del tablero, el Issue #25 no puede cerrarse ni marcarse como completado de extremo a extremo sin validación en development build nativo con SQLCipher y réplica real con PowerSync.

---

## 5. Clasificación de evidencia

- **Confirmado**:
  - Las 9 pruebas de comportamiento local en memoria pasan consistentemente con Vitest.
  - La suite de regresión de DEV (`SupabaseConnector.test.ts`) se integra y pasa completamente en este worktree.
  - `pnpm typecheck` no presenta errores.
  - `expo lint` en `app` no reporta errores ni advertencias.
  - `packages/shared` no cuenta con linter real configurado aún.
  - No hay emulador ni dispositivo Android disponible localmente para pruebas nativas.
- **Supuesto**:
  - El flujo de `cancelar_lote_abono` en la RPC remota mantendrá la misma semántica que el contrato simulado en los mocks.
- **Desconocido**:
  - Comportamiento y temporizado del daemon de PowerSync en dispositivos móviles al recuperar conectividad tras fallo de subida.
- **Propuesto**:
  - Mantener Issue #25 abierto con bloqueo documentado hasta disponer de una estación de prueba con emulador/dispositivo y development build nativo.
