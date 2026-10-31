# Coordinación pendiente de #24 y #18 — resumen para revisión

Fecha de redacción: 2026-10-31. Preparado por DEV (Claude, rama `feature/dev-features`) solo con inspección local y lecturas de GitHub (`gh issue view`, `gh pr list/checks`). No se contactó a nadie, no se publicó nada, no se tocó el backend remoto ni código de producción. Convención: **Confirmado** (hay archivo o consulta que lo respalda), **Supuesto**, **Desconocido**, **Propuesto**.

> **Aviso de discrepancia.** El encargo dice que no hubo despliegue remoto. Los archivos versionados indican lo contrario: `docs/VALIDACION-PRIORIDADES-2026-10-29.md` (sección «Despliegue y suites completas») y `docs/validaciones/2026-10-29/despliegue-remoto.json` registran que el SQL con SHA-256 `8aa2f82a…115a` (0006–0016) se aplicó en el proyecto `pqxvttkyevbkfdhmcmxu`. El JSON crudo confirma `executed: true`, `exitCode: 0` y `checkedAt: 2026-10-29T23:04:56Z`; la autorización explícita del usuario consta solo como **afirmación del informe de validación versionado** (`VALIDACION-PRIORIDADES-2026-10-29.md`), no como algo que DEV haya verificado. Los criterios del cuerpo del Issue #24 en GitHub siguen sin marcar y su texto dice «no hay evidencia de despliegue remoto de 0012». DEV no pudo verificar quién ejecutó ese despliegue ni la autorización original; hay que confirmarlo antes de dar por válida cualquiera de las dos versiones. Este informe **no** autoriza ni propone un nuevo despliegue.

## 1. Issue #24 — Revisar y desplegar el protocolo de sincronización atómica v1

### 1.1 Compuertas de liberación restantes (criterios del Issue, uno por uno)

| # | Criterio del Issue | Estado | Evidencia o hueco |
|---|---|---|---|
| 1 | PR pequeño contra `feat/edav-sync-cifrado`, coordinado con lmilo | **Superado por el flujo, coordinación abierta.** El contenido llegó a `main` con el PR #29 (fusionado 2026-10-29T23:08:38Z; `089c07e` es ancestro de `HEAD`). No hay evidencia en el repositorio de una revisión de lmilo. | `gh pr list`; **Desconocido:** si lmilo revisó. Requiere coordinación externa. |
| 2 | CI del SHA `d450671` o su sucesor | **Confirmado parcialmente.** El check «Lint, typecheck y pruebas» del PR #29 figura en `pass`. | `gh pr checks 29`. No se ejecutó nada nuevo. Falta CI sobre el SHA final de `main` si cambió después. |
| 3 | Inspección de solo lectura del destino remoto | **Confirmado.** Migraciones 0001–0016, RPC `aplicar_lote_sync` y `cancelar_lote_abono` ejecutables por `authenticated` y no por `anon`, 8 tablas con guard, 0 tablas de dominio sin RLS, 0 concesiones físicas de borrado, esquema `private` no expuesto (HTTP 406 / `PGRST106`), configuración de PowerSync Cloud igual a `powersync/sync-config.yaml` (SHA-256 `4bd50a03…f8b4` en ambos lados), sin errores de replicación y con 8 tablas `public` replicadas. | `docs/validaciones/2026-10-29/despliegue-remoto.json`, `postgrest-private.json`; en el worktree `ORQUESTADOR-Codex-Main` (no está en esta rama): `docs/validaciones/2026-10-30/issue24-backend-readonly-1793421007115.json`, `issue24-private-exposure.json`, `issue24-powersync-config.json`, `issue24-powersync-status.json`. |
| 4 | Preparar y autorizar el despliegue coordinado de backend y clientes | **Preparado; autorización de clientes pendiente.** El SQL y el procedimiento existen (`docs/DESPLIEGUE-PRIORIDADES-MVP1.md`, `docs/validaciones/2026-10-29/despliegue-manifiesto.json`). **Desconocido:** qué clientes (APK, development builds, usuarios con builds anteriores a 0012) siguen en circulación. | Falta la decisión explícita de corte de clientes antiguos y de la distribución del build compatible. Requiere autorización del usuario y coordinación externa. |
| 5 | Verificar RPC por PostgREST, RLS, replicación PowerSync e idempotencia | **Mayormente confirmado, con huecos.** Ver 1.4. | Huecos: el SDK nativo no se ejercitó en la prueba de pérdida de respuesta HTTP; la publicación `powersync` sigue en `FOR ALL TABLES`. |
| 6 | Concurrencia 60+60 y 40+60 sobre principal 100, sin duplicados al reintentar | **60+60 aparece demostrado en dos niveles (carrera SQL y dos emuladores); 40+60 solo en la carrera SQL.** Si estos artefactos satisfacen el criterio tal como lo lee el Issue es **Desconocido**. Ver 1.3 y 1.6. | `carreras-sql-qa.json` (2026-10-29) y `e2e-android-autenticado.json` (2026-10-30). |

### 1.2 Riesgo de compatibilidad cliente/servidor de 0012

- **Confirmado (diseño):** `public.exigir_lote_sync` (`supabase/migrations/0012_aplica_lotes_sync_atomicos.sql`, línea 160 y siguientes) lanza `23514` ante cualquier INSERT/UPDATE directo de `authenticated` si `vaulto.sync_protocol` no vale `1`. Solo `aplicar_lote_sync` activa esa marca (líneas 106–107). Los grants de INSERT/UPDATE se conservan; lo que protege es el trigger.
- **Confirmado (remoto):** una escritura directa sintética de cliente antiguo recibió HTTP 400 con código `23514` y no persistió filas (`issue24-old-client-verified.json`, 2026-10-31, worktree del orquestador). Esto corrige el supuesto de `VALIDACION-PRIORIDADES-2026-10-29.md` («falta comprobarlo»). Una sonda anterior esperaba `42501` por error; el propio archivo documenta la corrección. El archivo `issue24-25-http-response-loss.json` conserva `"rejected": false` y `"ok": false` en ese caso por el oráculo equivocado; no debe citarse como éxito global.
- **Riesgo (Confirmado):** un cliente anterior a 0012 deja de poder escribir de inmediato. Su cola local queda pendiente y las lecturas siguen funcionando. Un cliente nuevo contra un servidor sin la RPC muestra «el servicio necesita actualización» y conserva la cola (`docs/PROTOCOLO-SYNC-ATOMICO.md`, «Compatibilidad y despliegue pendiente»). Como el remoto ya tiene 0012, el riesgo se concentra en dispositivos con builds antiguos.
- **Desconocido:** cuántos dispositivos con build antiguo hay y si las colas pendientes de ellos se pueden reenviar con un build nuevo (la identidad `clientId:primer:último` y la migración de #21 deben conservarse). No hay evidencia de esa verificación para un cliente real antiguo.
- **Propuesto (no ejecutado):** no revertir 0012; distribuir un build compatible y comunicar el corte. Cualquier corrección va como migración nueva revisada (`docs/DESPLIEGUE-PRIORIDADES-MVP1.md`, «Recuperación ante fallos»).

### 1.3 Validación 60+60, 40+60 e idempotencia: qué existe y qué falta

- **Carrera SQL local** — `docs/validaciones/2026-10-29/carreras-sql-qa.json` (`checkedAt` 2026-10-29T23:04:56Z; comando `node scripts/test-sync-concurrency.mjs`; destino `vaulto-qa-pg-20261028/vaulto_qa_race_1793314974542`). Casos `60+60 sobre deuda 100` («un lote aplicado, sobrepago rechazado sin residuos; reintento idempotente») y `40+60 sobre deuda 100` («saldo final correcto; reintento idempotente»), ambos `passed: true`. El propio archivo aclara: dos conexiones PostgreSQL simultáneas, **no valida PowerSync ni dispositivos**.
- **E2E en dos emuladores contra el backend remoto** — `docs/validaciones/2026-10-29/e2e-android-autenticado.json` (`checkedAt` 2026-10-30T00:30:00Z). Detalle caso por caso y límites en 1.6.
- **Pérdida de respuesta HTTP, API pública sintética** — `issue24-25-http-response-loss.json` y `issue24-response-loss-ledger.json` (2026-10-31, worktree del orquestador): la aplicación y la cancelación ya confirmadas devuelven `already_applied` y `cancelled` al reintentar, con un recibo por lote. `nativeSdkExercised: false`.
- **Falta (sujeto a lo que decidan el usuario y QA):**
  1. Si una repetición independiente de 60+60 y 40+60 sigue siendo necesaria, y quién la ejecuta; no hay una repetición posterior a 2026-10-30.
  2. Idempotencia por pérdida de respuesta con el SDK nativo en el conector real. Depende de que el APK arranque; ver `docs/qa/continuacion-25-24-21-18.md` (timeout/ANR, causa no probada).
  3. 40+60 **concurrente entre dos dispositivos**: el E2E registra 60 seguido de un abono final de 40, no una carrera 40+60 en dos dispositivos.

### 1.4 Evidencia que ya existe (resumen con rutas)

| Hecho | Ruta |
|---|---|
| 60 aserciones pgTAP históricas; suites completas con 75 aserciones tras 0014–0016 en `vaulto_qa` | `docs/PROTOCOLO-SYNC-ATOMICO.md`; `docs/validaciones/2026-10-29/sql-qa-completa.json` |
| Despliegue remoto 0006–0016, RPC, grants y RLS | `docs/validaciones/2026-10-29/despliegue-remoto.json` |
| `private` no expuesto por PostgREST | `docs/validaciones/2026-10-29/postgrest-private.json` |
| Pruebas del conector (recibos, pérdida de confirmación, errores sanitizados) | `app/src/lib/sync/SupabaseConnector.test.ts`; `docs/PROTOCOLO-SYNC-ATOMICO.md` |
| Cliente antiguo rechazado, PowerSync Cloud igual al canónico, solo lectura | `docs/validaciones/2026-10-30/` (worktree `ORQUESTADOR-Codex-Main`, no incluido en esta rama) |

Esas verificaciones no se repitieron aquí. DEV no ejecutó pruebas, SQL ni consultas remotas.

### 1.5 Hallazgos abiertos relacionados

- **Propuesto:** la publicación `powersync` (0003) está `FOR ALL TABLES`; `replication_schemas` remoto incluye `auth`, `private`, `public`, `realtime`, `storage`, `supabase_migrations` y `vault` (`issue24-backend-readonly-1793421007115.json`). El servicio solo entrega las 8 tablas `public` por reglas, pero restringir la publicación exige migración revisada y autorización aparte.
- **Desconocido:** retraso del reintento tras reconectar y parada del stream tras Fast Refresh (`e2e-android-autenticado.json`).
- **Confirmado:** no hay retención ni purga de los recibos de `private.vaulto_sync_lote` (`docs/PROTOCOLO-SYNC-ATOMICO.md`).

### 1.6 Inventario de dispositivos: sesión actual frente a evidencia histórica

- **Sesión del 2026-10-31 (observado por DEV con `adb devices`):** un solo emulador conectado, `emulator-5554`. No hay un segundo dispositivo confirmado. Esto describe el inventario actual; no invalida la evidencia histórica.
- **Evidencia histórica (2026-10-30, `e2e-android-autenticado.json`, campo `clientes`):** APK de desarrollo en `emulator-5554` (VaultoQA1) y `emulator-5556` (VaultoQA2), Metro en localhost y pasarela QA loopback con TLS verificado en el host. Backend `pqxvttkyevbkfdhmcmxu`, migraciones 0001–0016. DEV solo leyó el JSON y no repitió la ejecución.

Casos del archivo histórico (todos `passed: true`) y lo que sugieren:

| Caso registrado | Qué sugiere | Criterio relacionado |
|---|---|---|
| «D1 y D2 sin conexion, abono 60 en cada uno; ambos muestran saldo 40 localmente» | 60+60 offline concurrente sobre deuda 100 en dos dispositivos | #25 escenario; #24 criterio 6 |
| «Reinicio de la app en D1 sin conexion … abono pendiente y KPI Debo 40 conservados» | La cola persiste tras reiniciar sin red (en D1) | #25 «reinicio» |
| «D1 reconecta: servidor con 1 pago (60, Abono D1), saldo 40» | Solo un lote se aplica | #24 criterio 6 |
| «D2 reconecta: rechazo 23514 -> Revisar abono pendiente -> Anular abono -> cola desbloqueada» | Rechazo del lote de D2 y anulación explícita desde la UI | #25 criterios 1–3 |
| «Operacion posterior en D2 (egreso 20.000) sincroniza; historial de D2 converge a Abono D1» | Una operación válida posterior sincroniza tras la anulación | #25 criterio 3 |
| «Abono final 40 en D1: deuda saldada, saldo 0; servidor pagos 60+40, 11 lotes applied + 1 cancelled» | Deuda saldada sin pagos duplicados; un recibo `cancelled` | #24 criterio 6 (parcial; es secuencial, no 40+60 concurrente) |
| «Cambio de cuenta en D2 A -> B -> C -> A …» | Aislamiento al cambiar de cuenta en el mismo dispositivo | #25 «cambio de cuenta» (parcial) |

Limitaciones que el propio archivo registra: tras reconectar, D2 **no reintentó la subida rechazada hasta reiniciar la app** («Desconocido»); el stream de descarga de D2 dejó de aplicar checkpoints tras un Fast Refresh hasta reiniciar; la revocación solo se verificó en la UI («Supuesto»). Su lista `noCubierto` incluye la pérdida de confirmación de un lote aplicado (solo pgTAP y pruebas del conector), la escritura directa de un cliente anterior a 0012 (cubierta después, el 2026-10-31, por `issue24-old-client-verified.json`), el APK standalone en emulador (fallo TLS por antivirus) e iOS (fuera de alcance por decisión del usuario).

**Qué aparece demostrado a la luz de esos artefactos**
- #25: el escenario base («dos dispositivos … abonos de 60 sobre deuda de 100 … el segundo resuelve su rechazo y puede continuar») se ejecutó en dos development builds con datos sintéticos, con rechazo, anulación explícita y operación posterior (criterios 1, 2, 3 y parte del 5).
- #24: 60+60 en SQL y en dos emuladores; idempotencia por reenvío en SQL y por pérdida de respuesta HTTP sintética; el remoto acepta el protocolo.

**Qué no prueban o sigue incierto**
- El criterio 4 de #25 completo: la pérdida de respuesta con el SDK nativo no se ejercitó; el reinicio documentado fue en D1 sin red (D2 se reinició para forzar el reintento); el cambio de cuenta no se probó con una cola rechazada pendiente. La conservación de `clientId`, IDs de lote y cola con el SDK nativo es **Desconocida** según ese archivo.
- 40+60 concurrente entre dispositivos, iOS y dispositivo físico.
- La carrera SQL no valida PowerSync ni dispositivos; el E2E es una ejecución manual única que DEV no reprodujo.
- **Si estos artefactos satisfacen los criterios actuales del Issue #25 es Desconocido**: ese juicio es del usuario/coordinador. `docs/qa/pending-acceptance-25-24-21-18.md` no existía en el worktree del orquestador al redactar esta corrección, así que no se contrastó con él. No se modificó nada en GitHub.

### 1.7 Autorizaciones y coordinación que siguen necesarias

- Confirmar con el usuario si el despliegue del 2026-10-29 fue el aprobado y cerrar la discrepancia con el cuerpo del Issue.
- Autorización explícita del usuario para: repetir pruebas con escrituras sintéticas en el remoto, corte de clientes antiguos y cualquier migración nueva (incluida la restricción de la publicación).
- Coordinación externa con lmilo (el protocolo afecta la subida de las ocho tablas, incluidas las de Track A). Nadie lo ha contactado desde esta rama.
- El cierre del Issue no corresponde a DEV; solo procede con evidencia de cada criterio.

## 2. Issue #18 — Alinear docs del spine al modelo canónico

Conciliación de solo lectura del cuerpo remoto del Issue (`gh issue view 18 --repo FPI-App/vaulto --json body,state`: **OPEN**, seguimiento del 29/10/2026) y de los hallazgos históricos 1–7 de `docs/qa/issue18-actualizacion.md` frente al árbol documental **actual** de `ORQUESTADOR-Codex-Main` (HEAD `b721bab`, rama `orchestration/issue-26`, PR #37 abierto; el árbol rastreado estaba limpio, solo había archivos sin rastrear en `docs/validaciones/2026-10-31/`). DEV leyó esos archivos sin modificarlos. Marcas: **Corregido** (la contradicción ya no está en el árbol actual), **Sigue desactualizado**, **Requiere lmilo**, **Desconocido**.

### 2.1 Documentación frente a infraestructura desplegada

- **Documentación (alcance de #18):** el texto de `ARQUITECTURA.md`, `supabase/policies/README.md`, READMEs, plan y runbooks. El Issue dice: «Documentar no prueba despliegue».
- **Infraestructura desplegada (alcance de #6/#24):** migraciones remotas, PowerSync Cloud y sync entre dispositivos. Lo que los documentos dicen sobre ello (p. ej. `docs/PLAN-MVP1.md`, «Estado contrastado — 2026-10-30», filas «Confirmado» de 0001–0016 y de #24) es una afirmación documental respaldada por `validaciones/`; DEV no la revalidó en esta tarea. Ninguna fila de #18 requiere desplegar nada.

### 2.2 Elementos actuales del Issue #18

El cuerpo remoto contiene la frase inicial (actualizar `ARQUITECTURA.md` §1 y `supabase/policies/README.md`, «Confirmar con lmilo antes de la primera migración») y tres casillas, **todas sin marcar** en GitHub.

| Elemento del Issue | Estado según el árbol actual | Evidencia (ruta y línea/sección) | Pendiente |
|---|---|---|---|
| Actualizar `ARQUITECTURA.md` §1: pivot `espacio_miembro`, `espacio_id` NOT NULL salvo `espacio` | **Corregido** en el texto | `ARQUITECTURA.md` §1 «Modelo canónico del esquema» (línea 7); línea 20 («la autorización se resuelve mediante `espacio_miembro`, no con un `user_id` suelto»); subsección «Por qué `espacio_id` es obligatorio» (línea 24; línea 25 sobre filas huérfanas); línea 58 (propiedad y grants 0007/0008/0010/0011). | Confirmación de lmilo (ver abajo). |
| Actualizar `supabase/policies/README.md` | **Corregido** | `supabase/policies/README.md` línea 5 («El pivot `espacio_miembro` es el corazón del modelo»), línea 7 (aislamiento por espacio, no por `user_id`), línea 3 (trigger de lote desde 0012; 0013–0016) y línea 40 (propietario de `espacio`). | Confirmación de lmilo. |
| «Confirmar con lmilo antes de la primera migración» | **Requiere lmilo.** Es texto histórico: las migraciones 0001–0016 ya existen y, según los documentos, están aplicadas; la condición «antes de la primera migración» ya no es alcanzable. | `docs/PLAN-MVP1.md` línea 29: «no se ha enviado un aviso externo a lmilo en esta ejecución». | Decidir si se reinterpreta como confirmación posterior. DEV no contactó a nadie. |
| ☐ Revisar e integrar documentación de PR #22 y de la rama atómica (#23, #24) | **Integrado en el repositorio; casilla sin marcar.** PR #22 y PR #29 aparecen `MERGED` (`gh pr list`); `ARQUITECTURA.md` §2, «Estado implementado en 0012–0016» (línea 46) y `docs/PROTOCOLO-SYNC-ATOMICO.md` reflejan el protocolo. Ediciones posteriores de documentación: PR #37, abierto. Revisión de DEV: `docs/qa/issue18-actualizacion.md`. | Líneas citadas; último commit de `ARQUITECTURA.md`: `8f68b6f`. | Que el responsable marque la casilla; la revisión del PR #37 sigue abierta. |
| ☐ Reconciliar checklists/rutas antiguas del plan, README y runbooks sin presentar pruebas pendientes como ejecutadas | **Mayormente corregido, con residuos.** Ver 2.3 y 2.4. | `docs/PLAN-MVP1.md` líneas 16–29 («Estado contrastado») declaran que las casillas históricas sin marcar no prueban ausencia de código; `docs/INFRA-SETUP.md` línea 19 distingue provisión de estado confirmado. | Residuos de 2.4. |
| ☐ Confirmar coordinación con lmilo en la revisión compartida | **Requiere lmilo / revisión externa pendiente.** No consta ninguna revisión de lmilo. | `docs/PLAN-MVP1.md` línea 29 dice expresamente que no se envió aviso; `ARQUITECTURA.md`, `supabase/policies/README.md` y `docs/DESPLIEGUE-PRIORIDADES-MVP1.md` no registran confirmación. | Revisión de lmilo. DEV no inventa ni solicita ninguna. |
| «Documentar no prueba despliegue…» | **Consistente.** | `supabase/policies/README.md` línea 3: «La existencia del archivo en Git no prueba su aplicación remota». | — |

### 2.3 Hallazgos históricos 1–7 de `docs/qa/issue18-actualizacion.md`

| # | Hallazgo histórico | Estado actual | Evidencia en el árbol actual |
|---|---|---|---|
| 1 | `.env.example` declaraba `SQLCIPHER_DEV_KEY` | **Corregido** | `.env.example` líneas 14–16: «No configurar una llave SQLCipher global en variables de entorno». `SQLCIPHER_DEV_KEY` no aparece en `.env.example`, `README.md`, `app/README.md` ni `docs/*.md`. |
| 2 | `app/README.md`, `INFRA-SETUP.md` y plan usaban `ANON_KEY` | **Corregido** (se adoptó `PUBLISHABLE_KEY`, con `ANON_KEY` como compatibilidad) | `app/README.md` líneas 25–26 («`ANON_KEY` sigue admitida como alternativa legacy»); `docs/INFRA-SETUP.md:102`; `docs/PLAN-MVP1.md:175` (B.0.5); `app/.env.example` líneas 13–14. |
| 3 | `app/README.md` mencionaba `README-OWNER.md` inexistentes | **Corregido** | Sin coincidencias de `README-OWNER` en `app/README.md`, `README.md` ni `docs/PLAN-MVP1.md`; los archivos tampoco existen en `app/src/features/*`. |
| 4 | Árbol de `lib/` de `app/README.md` incompleto o mal indentado | **Corregido** | `app/README.md` líneas 64–73 listan `supabase.ts`, `powersync/`, `sync/`, `db/`, `auth/` (línea 69), `deudas/`, `espacio/`, `navigation/` y `ui/`. |
| 5 | `README.md` describía `sync/` con «resolución de conflictos» y omitía `lib/db/` | **Corregido** | `README.md` líneas 41–43: `powersync/` (provider), `db/` («Llaves, sesiones y migración legacy»), `sync/` («PowerSync, outbox y recuperación por RPC»). |
| 6 | `supabase/README.md` mencionaba edge functions/Deno | **Corregido** | `supabase/README.md` línea 12: «Reservado; sin funciones Deno implementadas»; la línea 3 describe esquema, RLS y RPC. |
| 7 | `docs/PLAN-MVP1.md` conservaba checklists sin marcar y B.0.5 con `ANON_KEY` | **Parcialmente corregido** | La nota de contraste (líneas 16–29) existe y B.0.5 usa `PUBLISHABLE_KEY` (línea 175). Siguen 21 casillas sin marcar y 0 marcadas (`grep -c`), p. ej. A.1 (línea 139) y B.0.1/B.0.3 (líneas 171 y 173): la nota las declara históricas, pero **siguen siendo ambiguas** frente a lo implementado. |

Esta tabla comprueba el estado actual; no repite la revisión de DEV sobre el diff local anterior.

### 2.4 Residuos y puntos no verificados

- **Sigue desactualizado (parcial):** las 21 casillas históricas sin marcar de `docs/PLAN-MVP1.md` (hallazgo 7). Marcarlas o archivarlas es una decisión editorial del coordinador o del equipo.
- **Sin conciliar:** `docs/INICIO-TRACK-B-2026-10-26.md`, `docs/ENTREGA-PENDIENTES-EDAV-2026-10-26.md`, `docs/AVANCE-TRACK-B-2026-10-28.md`, `docs/DIAGNOSTICO-*` y `docs/VALIDACION-SYNC-CIFRADO-2026-10-27.md` no se revisaron. Por ejemplo, `AVANCE-TRACK-B-2026-10-28.md` líneas 5–6 afirma que #18 está «In Progress»: es una afirmación histórica.
- **No existen o no se revisaron a fondo:** `docs/infra/` no existe en `ORQUESTADOR-Codex-Main`; `docs/decisiones/` solo contiene `0001-repo-mono.md` (no se comprobó su relación con #18). De `docs/DEMO-MVP1.md` y `docs/DESPLIEGUE-PRIORIDADES-MVP1.md` solo se buscaron términos obsoletos (`edge`, `SQLCIPHER_DEV`, `ANON`, `README-OWNER`, `contracts/`) sin coincidencias; no se auditaron completos.
- **Desconocido:** el soporte de Sync Streams en la imagen autoalojada `journeyapps/powersync-service:1.27.0` (`docs/INFRA-SETUP.md` línea 79 lo trata como distinción documentada); no se comprobó.
- **Historial de esta rama:** `9f32bdb` y su reversión `24434a8` siguen en `feature/dev-features`. Al integrar, tomar solo el informe de #18 (ver `docs/qa/issue18-actualizacion.md`, «Aclaración de proceso»).

### 2.5 Qué sigue pendiente de revisión externa

- Confirmación de lmilo de `ARQUITECTURA.md` §1 y `supabase/policies/README.md` (casilla 3 y frase inicial del Issue). **No consta que haya ocurrido; DEV no la da por hecha.**
- Revisión del PR #37, que concentra las ediciones de documentación posteriores.
- Marcar las casillas del Issue: corresponde al responsable tras la revisión; DEV no modifica GitHub.

## 3. Resumen revisable por el coordinador (tras aprobación del usuario)

1. **#24:** el backend remoto está, según los archivos, en 0001–0016 con RPC, RLS, grants y PowerSync alineados; el cliente antiguo es rechazado con `23514`; 60+60 tiene evidencia SQL local y E2E en dos emuladores (2026-10-30); 40+60 solo en SQL local; la idempotencia, en SQL y en pérdida de respuesta HTTP sintética. La sesión del 2026-10-31 solo tuvo un emulador conectado; eso no invalida la evidencia histórica ni la reemplaza. Quedan: aclarar la discrepancia sobre el despliegue, revisión de lmilo, decidir si hace falta repetir 60+60/40+60 y la idempotencia con el SDK nativo (bloqueada por el arranque del APK), decisión sobre clientes antiguos y la propuesta de restringir la publicación `powersync`.
2. **#18:** el texto de `ARQUITECTURA.md` §1 y `supabase/policies/README.md` ya refleja el modelo canónico y seis de los siete hallazgos históricos están corregidos; el séptimo (21 casillas históricas del plan) queda parcial. Siguen abiertos los documentos históricos no revisados y la confirmación de lmilo, que no consta. Es corrección documental, no prueba de despliegue (ver 2.1–2.5).
3. **No ocurrió en esta tarea:** pruebas, escrituras remotas, comentarios, contacto con personas, push, PR ni cierre de issues. Se necesitan coordinación externa y autorización del usuario para cualquier despliegue o escritura remota.

## 4. Verificación hecha para este informe

- Lectura de `AGENTS.md`, `docs/PLAN-MVP1.md`, `docs/PROTOCOLO-SYNC-ATOMICO.md`, `docs/DESPLIEGUE-PRIORIDADES-MVP1.md`, `docs/VALIDACION-PRIORIDADES-2026-10-29.md`, `docs/qa/issue18-actualizacion.md`, `supabase/migrations/0012_*.sql` y los JSON de `docs/validaciones/2026-10-29/` y (solo lectura, otro worktree) `2026-10-30/`.
- `gh issue view 24` y `18`, `gh pr list` y `gh pr checks 29` (lecturas).
- `git merge-base --is-ancestor 089c07e HEAD` → 0 (el PR #29 está en esta rama).
- Corrección posterior: relectura de `e2e-android-autenticado.json` y `carreras-sql-qa.json` por ruta absoluta en el worktree `ORQUESTADOR-Codex-Main` y de `gh issue view 25`.
- Sin pruebas ni linters: solo se modifica documentación.
