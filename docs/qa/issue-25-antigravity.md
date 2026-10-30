# Reporte QA — Issue #25: Recuperación de abonos rechazados

Fecha: 2026-10-30  
Agente: Antigravity (QA)  
Rama: `feature/qa-tests`  
Base integrada: `290e01d` (DEV Claude)  

---

## 1. Resumen ejecutivo

Se implementó y ejecutó la suite completa de pruebas de comportamiento y recuperación de sincronización en `app/src/lib/sync/recuperacionAbonosRechazados.test.ts`, cubriendo todos los casos solicitados para el Issue #25. Adicionalmente, se integró el commit `290e01d` de DEV (Claude) y se verificó la suite global (`packages/shared` y `@vaulto/app`), logrando 100% de éxito en ejecución de pruebas, comprobación de tipos (`tsc`) y linting (`expo lint`).

---

## 2. Cobertura de casos verificados

La nueva suite de pruebas de QA valida de forma exhaustiva los siguientes 9 escenarios:

1. **Deuda 100 con abonos offline 60+60**:
   - Creación de deuda por monto 100.00 en dos bases locales independientes (simulación de dos dispositivos).
   - Aplicación local de abono de 60.00 en cada base de forma aislada, dejando ambos saldos locales en 40.00.
2. **Rechazo visible**:
   - Subida a Supabase mediante `uploadData` simulando fallo por check constraint de saldo negativo (`código 23514`).
   - `SupabaseConnector` captura `23514`, registra el lote en `SyncRecoveryStore` con estado `blocked` y eleva `SyncUploadError('conflict')`.
   - Se preserva la transacción en la cola local (`complete()` no es invocado).
   - El estado de bloqueo y operaciones es visible y consultable.
3. **Anulación explícita**:
   - El usuario solicita la anulación del abono (`requestCancellation`).
   - La decisión transiciona a `requested`.
   - El siguiente ciclo de `uploadData` detecta `requested` y llama al RPC `cancelar_lote_abono` en vez de `aplicar_lote_sync`.
   - Al recibir confirmación `status: 'cancelled'`, se marca `cancelled` en el store y se ejecuta `complete()`, liberando la cola.
4. **Operación posterior válida**:
   - Tras liberar la cola anulando el conflicto previo, una operación subsiguiente válida (abono de 40.00) es enviada mediante `aplicar_lote_sync` y se completa exitosamente (`status: 'applied'`).
5. **Reinicio**:
   - Persistencia durable en base SQLite: al instanciar un nuevo `SyncRecoveryStore` sobre la misma base, se recupera íntegro el lote con su decisión (`requested`) y se retoma la subida.
6. **Cambio de cuenta con anulación pendiente**:
   - Con un lote en anulación pendiente para `usr-qa-1`, al cambiar la sesión a otro usuario `usr-qa-2`, `SupabaseConnector` detecta el cambio de sesión y aborta de inmediato antes de llamar al servidor o completar la transacción.
   - Al restaurar la sesión original, la anulación se envía y confirma correctamente.
7. **Reintento tras reconexión**:
   - Falla transitoria de red (`NETWORK` / `retry`) durante la cancelación: se conserva el estado `requested` y la cola no se completa.
   - Al reconectar, el reintento se ejecuta de forma idempotente con el mismo `p_lote_id` y parámetros.
8. **Pérdida de respuesta sin duplicados**:
   - Cuando el servidor ya procesó la operación o cancelación pero la respuesta local se interrumpió, el reintento recibe `already_applied`.
   - El conector lo acepta como válido tanto para subida como para cancelación, confirmando la resolución sin duplicar registros.
9. **Aislamiento de usuario/espacio**:
   - Las operaciones, recuperaciones y pagos de un espacio no interfieren ni alteran los registros de otro espacio diferente.

---

## 3. Comandos ejecutados y resultados reales

### 3.1 Pruebas unitarias y de integración (`vitest`)
```bash
pnpm test
```
**Resultado**:
- `packages/shared`: 6 archivos de prueba pasados, 79 tests pasados (0 fallos).
- `@vaulto/app`: 16 archivos de prueba pasados, 114 tests pasados (0 fallos).
  - Incluye `app/src/lib/sync/recuperacionAbonosRechazados.test.ts` (9 tests pasados).
  - Incluye `app/src/lib/sync/SupabaseConnector.test.ts` con cambios de Claude (22 tests pasados).

### 3.2 Comprobación de tipos (`tsc`)
```bash
pnpm typecheck
```
**Resultado**:
- `packages/shared`: Exitoso, 0 errores.
- `@vaulto/app`: Exitoso, 0 errores.

### 3.3 Linter (`eslint` / `expo lint`)
```bash
pnpm lint
```
**Resultado**:
- `packages/shared`: Exitoso.
- `@vaulto/app`: Exitoso, 0 errores, 0 advertencias.

---

## 4. Estado de emuladores y pruebas nativas

- **Confirmado**: Se verificó la disponibilidad de `adb` y emuladores/dispositivos Android locales. El comando `adb` no se encuentra disponible en el entorno de ejecución actual y no hay variables de entorno `ANDROID_HOME`/`ANDROID_SDK_ROOT` configuradas.
- **Pendiente nativo**: No se equivalen las pruebas de unidad/integración en memoria a una prueba nativa E2E. La validación en builds de desarrollo con SQLite cifrado (`op-sqlite` / SQLCipher) y réplica en vivo con PowerSync permanece pendiente para el entorno con hardware o emulador configurado.

---

## 5. Clasificación de evidencia

- **Confirmado**:
  - Toda la suite en memoria pasa al 100% (193 tests totales).
  - La lógica de `SupabaseConnector` y `SyncRecoveryStore` soporta anulación, reinicio, cambio de sesión, pérdida de respuesta y reintentos sin bloqueo indebido ni descarte incorrecto de lotes.
  - El código cumple con TypeScript estricto, comillas simples y sin punto y coma.
- **Supuesto**:
  - En un dispositivo real, la reconexión de red reactivará el bucle de sincronización conforme a los eventos del conector de PowerSync.
- **Desconocido**:
  - Latencia o comportamiento exacto del daemon de PowerSync en reconexiones bajo enlaces móviles inestables sin disparador explícito de cola.
- **Propuesto**:
  - En el siguiente ciclo con emulador disponible, ejecutar un test E2E en build de desarrollo (`expo run:android`) validando la alternancia online/offline con dos clientes simultáneos.
