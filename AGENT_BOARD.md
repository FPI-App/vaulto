# Vaulto — tablero de orquestación

Actualizado: 2026-10-30. Run Orca: `run_7292d436ace4`.

## Puntos de parada obligatorios — instrucción vigente del usuario

Estas reglas prevalecen sobre las instrucciones de integración del historial.

1. Si hay workers pendientes, esperar con `orca orchestration check --wait --types worker_done,escalation,question --timeout-ms 900000 --json`. Mantener ese proceso observable mediante su handle; un timeout no prueba finalización ni autoriza relanzar workers.
2. Procesar todos los mensajes del lote antes de confirmar su `deliveryId` con `--ack`.
3. Si llega `worker_done` con `outcome: failed`, `escalation` o `question`, reportar al usuario y detener el flujo; no reintentar ni responder la decisión por cuenta propia.
4. Antes de abrir cada PR, crear un gate del coordinador con `orca orchestration gate-create`, pregunta exacta `¿Revisaste el diff y apruebas abrir el PR?` y opciones `["yes","no"]`. Instrucción más reciente del usuario: «yes, aprueba todos los pr tú»; el coordinador puede resolver los gates de apertura y merge tras revisar diff y evidencia, sin volver a preguntar por cada PR.
5. Antes de cada merge o `gh issue close`, crear otro gate con la misma pregunta y opciones, identificando la acción en la tarea asociada. La aprobación de apertura no aprueba merge ni cierre. Un `no` detiene esa acción. La delegación de PR no elimina el gate separado de cierre del Issue.
6. Al terminar cada Issue, entregar resumen de archivos modificados, comandos ejecutados con sus resultados y lo que NO se pudo verificar. Un resumen local no acredita cierre remoto.
7. Sigue vigente la confirmación explícita del comando exacto y destino para `git push`; un gate de PR no la sustituye.

Confirmado al incorporar estas reglas: workers asentados, bandeja sin mensajes pendientes; no hay workers que requieran una espera nueva.

### Gate aprobado — apertura PR #25

- Task del coordinador: `task_61946f5961d7`.
- Gate: `gate_b5fb7c349737`, estado `resolved`, resolución `yes` por respuesta explícita del usuario; verificado en Orca.
- Pregunta: **¿Revisaste el diff y apruebas abrir el PR?** Opciones: `yes` / `no`.
- Diff a revisar: `git diff main..orchestration/issue-25`; head preparado `a2d8f24`.
- Apertura y comandos exactos de push autorizados explícitamente por el usuario. Ambas ramas publicadas. PR #33 abierto: https://github.com/FPI-App/vaulto/pull/33, head `a2d8f24d1752d33ee97814c2906ffd2dc90352c4`. CI remoto en ejecución al abrirlo. #25 mantiene el bloqueo nativo y no se cerrará con estas regresiones. Merge y cierre conservan gates separados.
- CI del PR #33 confirmado correcto: `gh pr checks 33 --watch --interval 10`, exit 0; job «Lint, typecheck y pruebas» pass (39 s), run `41137831998`.
- Gate de MERGE del PR #33: `gate_ba3a42da4d3b`, Task `task_cb810cc3f311`, resuelto `yes` por respuesta explícita del usuario. PR #33 fusionado mediante `gh pr merge 33 --merge --match-head-commit a2d8f24d1752d33ee97814c2906ffd2dc90352c4`; merge `73e5920352422e99515baca54b05575ec02115b6`. Issue #25 permanece abierto por validación nativa pendiente.

### Resumen de entrega #25 — PR fusionado, Issue abierto

- Archivos: `app/src/lib/sync/SupabaseConnector.test.ts`, `app/src/lib/sync/recuperacionAbonosRechazados.test.ts`, `docs/qa/issue-25-antigravity.md`, `AGENT_BOARD.md`.
- Comandos/resultados: 31/31 pruebas afectadas correctas; exportación Android Hermes correcta (2.102 módulos); `git push -u origin orchestration/issue-25` exit 0; `gh pr create --base main --head orchestration/issue-25 --title ... --body-file .cache/orchestration/pr-issue-25.md` creó PR #33; CI remoto correcto.
- NO verificado: reconexión automática, pérdida de respuesta contra servidor real, SQLCipher tras reinicio y sincronización entre dos dispositivos para los pendientes del Issue. Los mocks no cubren esas garantías. El PR ya se fusionó; el Issue no se cerró.

## Ciclo completado — Issue #26

- Issue: [#26 — Sustituir el lint ficticio de packages/shared por una verificación real](https://github.com/FPI-App/vaulto/issues/26).
- Estado: CLOSED y Done en el Project, verificados tras autorización explícita del usuario. Gate `gate_aff7f6bce8db` resuelto yes; Task `task_51e58afa1187` completada. Código integrado mediante PR #34, merge `ae93ace42fcb7c7418498429128d4c1ba604573d`, con CI correcto (run `41139141904`, 49 s).
- Cierre ejecutado: `gh issue close 26 --repo FPI-App/vaulto` exit 0; `gh project item-edit` marcó Done, confirmado por lectura del Project. Archivos del Issue: `packages/shared/eslint.config.js`, `packages/shared/package.json`, `pnpm-lock.yaml`, reporte QA y este tablero. Comandos de lint/tipos/tests y sus resultados se conservan abajo; no se repitieron pruebas de código para este cierre administrativo ni se ejecutaron pruebas nativas nuevas.
- Issues abiertos tras el cierre: #25, #24, #21, #18, #17, #16, #6 y #2 (épica Track B), confirmados con `gh issue list --state open --limit 100`.
- Gate de apertura del PR de lint: `gate_fc85b1f44b0a`, Task `task_b6daaaa25133`, resuelto `yes` por delegación explícita del usuario tras revisión del coordinador. La publicación de las ramas ya estaba autorizada.

### Revisión de los demás PR solicitada por el usuario

- Confirmado por `git merge-base --is-ancestor`: heads de PR #20 (`519ab796`) y #22 (`79cbb4c2`) ya son ancestros de `origin/main`. Son borradores históricos, no features nuevas pendientes.
- PR #31 head `21325ba07544196bce81d36ea0cb2b41c5ba9f45` y PR #32 head `7d43de44ac40a2bbddca6e85e328a62b6bc5dc84`: revisión paralela en solo lectura contra base `73e5920`, ejes Standards y Spec.
- Claude: Task `task_a73c2fb668fb`, Dispatch `ctx_0bdd92400c8a`. Antigravity: Task `task_e89e76378d80`, Dispatch `ctx_ab3c0f83252f`. Ambos iniciados y en espera con el comando exacto solicitado; detener/reportar ante failed, escalation o question.
- Ambas revisiones entregadas con `worker_done succeeded`; lotes procesados completos y confirmados después de registrar hallazgos y disponer de las sesiones. Sin cambios de los reviewers.
- Standards: PR31 sin bloqueante declarado, con salvedades sobre alcance compartido, web sin cifrar y duplicación de conexión. PR32 aprobado. Spec: PR31 requiere corregir suma flotante y armonizar layout con PR32; PR32 aprobado. No se mezclan estos dos ejes de evaluación.

### Integración PR31 y PR32 — fusionada en main

- PR conjunto #35 fusionado en main: `1fcf35e9cc31240fb380b1e6ec250909b19d6fa6`. CI del head `1c4a7ce01a6dfe1cdd85d626623df45c28d9aab4` correcto (run `41143036636`, 46 s).
- Gate de merge #35: `gate_2f8ba7f32b15`, Task `task_7277434b2305`, resuelto yes por aprobación delegada. GitHub marcó también #31 y #32 MERGED al incorporar sus commits con historia. No se cerraron Issues por ese merge.
- PR históricos #20/#22 marcados listos y fusionados en sus bases originales con CI correcto y heads ya presentes en main. Gates `gate_ced1ce0be5f8` / `gate_0050c6b9e809`, merges `66209e8f` / `8d1e9c48`. Sin cambios nuevos de producto en main por esa limpieza.

- Entregas aceptadas: DEV `2447e78` y QA `64e877c`, ambos `worker_done succeeded`. Sesiones dispuestas mediante worker-release (retención de terminales preexistentes) y lotes completos procesados antes de ack. Sin workers pendientes.
- Integradas ambas ramas en `orchestration/issue-26` conservando los heads originales #31 `21325ba` y #32 `7d43de4` como ancestros. El coordinador verificó que el layout coincide con el rediseño y que useDashboard/eas.json conservan la demo.
- QA: 197 pruebas correctas (79 shared + 118 app), tipos/lint correctos, reporte `docs/qa/pr31-32-integracion.md`; solo añadió la prueba de 63 líneas y el reporte. El coordinador ejecutó las cuatro regresiones sobre el árbol final: 4/4 correctas. Instalación frozen del orquestador correcta.
- Gate de apertura de integración: `gate_9edcb8e61e41`, Task `task_5ab1bc1a8755`, resuelto yes por aprobación delegada tras revisar las entregas. Publicar con el comando ya autorizado; el merge requiere CI remoto del SHA exacto y otro gate.
- Resumen de cambios correctivos: `DeudasScreen.tsx`, `data/calcularTotalesDeudas.ts`, `data/calcularTotalesDeudas.test.ts`, `lib/sync/db.web.ts`, layout integrado y reporte QA. El resto corresponde a los diffs originales de rediseño/demo ya revisados.
- NO verificado en esta integración: APK nuevo, ejecución Android con expo-blur/linear-gradient, dos dispositivos con los casos pendientes de #25 ni build web de producción. DEV sí exportó Android Hermes (2.179 módulos); no equivale a APK.

- El coordinador confirmó el bug visible del resumen: `0.01 + 2.01 + 0.48` con floats produce `2.4999999999999996` y se muestra como COP 2; la suma de centavos produce 2.50 y se muestra como COP 3.
- DEV Claude: Task `task_8ea475bc8fe8`, Dispatch `ctx_1025098f2f11`; integrar main, PR31 y PR32 conservando historia; resolver layout con TabBar del rediseño y Categorías accesible; usar helper de centavos en resumen; bloquear base web sin cifrar fuera de desarrollo. Sin push ni EAS remoto.
- DEV Claude (resultado): completado localmente en `feature/dev-features`, SHA final `2447e78`, sin push. Merges con historia original: main `4188353`, rediseño `699d382`, demo `1ef20aa`; único conflicto `(app)/_layout.tsx` resuelto con TabBar del rediseño y Categorías/Cuentas como rutas sin href:null; `useDashboard` (lastSyncedAt) y perfil EAS preview de PR32 conservados. Commits exclusivos del fix: `d7ae53f` (totales con sumarANumero + guard `!__DEV__` en db.web.ts), `ecc41ce` (extrae `calcularTotalesDeudas` en app/src/features/deudas/data/calcularTotalesDeudas.ts, solo activas con saldo conocido, ambas direcciones), `2447e78` (lint readonly T[]). Verificado: `pnpm install --frozen-lockfile` (con red, 8 paquetes nuevos), `pnpm lint` y `pnpm typecheck` sin errores ni warnings, `pnpm test` 79 shared + 114 app, `expo export -p android` correcto (2179 módulos, salida ignorada .cache/dev-merge-android). Límite: bundle no prueba ejecución nativa; expo-blur/linear-gradient requieren recompilar el development build; el guard web se razona por __DEV__ de Metro, sin build web de producción ejecutada.
- QA Antigravity: Task `task_d85c92fa78d3`, Dispatch `ctx_ba91212a79ea`; prueba significativa de `calcularTotalesDeudas` con centavos, dirección, saldadas y conflictos; verificar integración y reporte `docs/qa/pr31-32-integracion.md`. Sin modificar producción ni publicar.
- QA Antigravity (resultado): completado localmente en `feature/qa-tests`, merge de DEV `2447e78` (`2ad7085`) y SHA final de QA `64e877c`, sin push ni PR. Suite significativa `app/src/features/deudas/data/calcularTotalesDeudas.test.ts` (63 líneas) verifica que `'0.01' + '2.01' + '0.48'` acumula `2.5` (`formatCOP` produce `$ 3`) y no la deriva de coma flotante `2.4999999999999996`; verifica separación por dirección `me_deben`/`yo_debo`, exclusión de saldadas/conflicto null y lista vacía. Verificación ejecutada: `pnpm install --frozen-lockfile` correcto; `pnpm test` 79 shared + 118 app = 197/197 pruebas pasadas; `pnpm typecheck` 0 errores; `pnpm lint` 0 errores y 0 warnings (`eslint src` + `expo lint`). Revisión estática de integración: guard `!__DEV__` verificado en `db.web.ts`; layout `_layout.tsx` conserva TabBar del rediseño, rutas cuentas/categorias accesibles sin `href: null` y refresco de `useDashboard` con `lastSyncedAt`. Verificación DEV citada: bundle Hermes Android 2.179 módulos. Limitaciones/pendientes: ejecución y validación nativa APK con `expo-blur`/`linear-gradient` y sync multi-dispositivo permanecen pendientes de entorno nativo. Reporte entregado: `docs/qa/pr31-32-integracion.md`.
- Orquestador: espera exacta `orca orchestration check --wait --types worker_done,escalation,question --timeout-ms 900000 --json`. No aprobar integración si falla un worker o hay escalation/question; detener y reportar.
- La publicación conjunta usará `orchestration/issue-26`, cuyo comando exacto de push ya fue autorizado. Creará PR de integración separado del #34 ya fusionado y gates rastreables por aprobación delegada.
- Publicación e integración realizadas: `git push -u origin orchestration/issue-26` exit 0; `gh pr create ... --body-file .cache/orchestration/pr-ui-demo.md` creó #35; `gh pr checks 35 --watch --interval 10` exit 0; `gh pr merge 35 --merge --match-head-commit 1c4a7ce01a6dfe1cdd85d626623df45c28d9aab4` correcto.

### Pendientes de la app — evidencia más reciente del tracker

- #25: cambio de cuenta con anulación pendiente, pérdida de respuesta remota y retraso del reintento al reconectar. El flujo 60+60, anulación y operación posterior ya fue probado en Android; no se presenta como trabajo sin empezar.
- #21: migración cifrada ya implementada y probada en Android. Falta demostrar reenvío exactamente una vez de la transacción pendiente tras migrar y reiniciar. Conservar originales; cualquier retirada requiere autorización exacta. iOS fuera de alcance según comentario del Issue.
- #24: backend 0001–0016 y RPC ya desplegados y probados desde Android. Falta mismo lote tras perder confirmación remota, bloqueo real del cliente antiguo y cotejar reglas PowerSync desplegadas con `sync_rules.yaml`. Restringir publicación a ocho tablas es una propuesta, no una migración autorizada.
- #6: dos Android, offline/reinicio/convergencia, soft delete y aislamiento ya probados. Falta purga local tras revocar membresía y entrega segura de configuración/checkpoint B.0 a lmilo.
- #16/#17: funcionalidad presente; completar evidencia de cierre de abonos/KPIs sobre integración final y pendientes anteriores. PR32 agrega refresco tras checkpoints de sync.
- #18: reconciliar README/plan/runbooks y checklist con estado real; los cuerpos de varios Issues conservan diagnóstico anterior al despliegue.
- Tras rediseño: recompilar APK con expo-blur y expo-linear-gradient y validar navegación/visuales en Android. Bundle JavaScript correcto no sustituye APK ni prueba nativa. Web es herramienta de desarrollo, no almacenamiento cifrado de producción.
- Base inicial de verificación: `main` `2ba0875`. Rama `orchestration/issue-26`; incluye ahora la integración local #25 como dependencia para publicar/fusionar primero PR #25 y después PR #26 sin conflicto del tablero. El diff del segundo PR se revisa contra main actualizado tras el primero.

### [DEV] Claude — #26

- Rama existente `feature/dev-features`; crear commits exclusivos de #26 sin mezclar cambios de #25. No reescribas historia.
- Configura lint real en `packages/shared`, compatible con TS estricto, comillas simples y sin punto y coma. Respeta pnpm 9.12.0 y ESLint 9 de la app; reutiliza versiones resueltas cuando sea viable. Declara dependencias directas requeridas; no dependas accidentalmente de hoisting/transitivas.
- Propiedad: `packages/shared/package.json`, configuración ESLint de shared, lockfile y ajustes mínimos de lint en shared si son necesarios. No modifiques la interfaz DeudasSelectors, app/ ni dominio de negocio ni reformatees masivamente. Comunica antes cualquier cambio que salga de este alcance.
- Lee #26, plan y manifiestos; usa Context7. Referencia ya verificada por el coordinador: ESLint 9.39.3, flat config `languageOptions.parser`; CLI `--stdin --stdin-filename` para demostrar fallo sin crear/borrar archivos temporales.
- Aceptación: lint analiza fuentes TS y falla con infracción real mediante stdin; pnpm lint, typecheck y test correctos; lockfile compatible con instalación frozen. Entrega commits exclusivos de #26, comandos y resultados reales. Sin push, PR, merge remoto ni cierre.
- Estado: completado localmente; Task `task_e16999b133a6`, Dispatch `ctx_7d75ff5125ff`. SHA exclusivo de #26: `4c33de8` (sobre `290e01d` de #25; cherry-pick aislado de ese único commit). Sin push/PR/merge.
  - Archivos: `packages/shared/package.json` (lint `eslint src` + devDependencies directas `eslint`/`@eslint/js` ^9.39.5, `@typescript-eslint/parser`/`eslint-plugin` ^8.71.2), `packages/shared/eslint.config.js` (nuevo, flat config), `pnpm-lock.yaml` (+12 líneas, solo el importer de shared; mismas versiones ya resueltas). Sin cambios en `app/`, `selectors.ts` ni dominio.
  - Confirmado (ejecutado): `pnpm install --frozen-lockfile --offline` correcto; `pnpm lint` (shared con ESLint real + app) sin errores; `pnpm typecheck` correcto; `pnpm test` 79 shared + 105 app (esta rama incluye las de #25; sobre main serían 101 app). Stdin negativo (`const x = "a";` en `src/domain/…ts`): exit 1 con reglas `quotes` y `semi`; `any` explícito: exit 1 con `@typescript-eslint/no-explicit-any`; positivo (`export const x = 'a'`): exit 0. Sin archivos temporales.
  - Reglas: `@eslint/js` recommended, `typescript-eslint/eslint-recommended`, `no-explicit-any`, `no-unused-vars` TS con `argsIgnorePattern: '^_'` (necesario por parámetros `_direccion/_limite` en `selectors.ts`; evita tocar el contrato), `quotes` single y `semi` never (reglas núcleo, obsoletas en ESLint 9 pero activas; no se añadió `@stylistic`).
  - Limitaciones: lint sin información de tipos (no `recommended-type-checked`); alcance `src/**/*.ts`; Context7 no disponible entre mis herramientas, la API se verificó contra la instalación local (`configs['flat/eslint-recommended']` existe en 8.71.2) y la ejecución real. CI remoto: Desconocido, no verificado.

### [QA] Antigravity — #26

- Rama existente `feature/qa-tests`; #25 ya entregado, no seguir ampliándolo.
- Propiedad: reporte nuevo `docs/qa/issue-26-antigravity.md`; no modificar configuración, lockfile, código de producción ni escribir tests que reproduzcan la configuración.
- Valida independientemente los commits de #26 de Claude: lint shared analiza `src/**/*.ts`, una infracción real produce exit 1 y un ejemplo válido exit 0; usa stdin/filename y registra regla activada. No crear archivos temporales que requieran borrados.
- Verifica cobertura de domain/types/powersync y que DeudasSelectors no cambió. Ejecuta calidad del conjunto cuando exista el SHA final; no dupliques suites completas sin cambio nuevo. CI remoto es pendiente hasta PR, no se presume por pasar localmente.
- Alcance de #26 no requiere Expo Go ni dispositivos. No publiques ramas ni PR ni cierres Issues. Entrega SHA local, reporte preciso y estado en esta sección; termina el turno, no entres en bucle.
- Estado: completado localmente; Task `task_da652ecb1b63`, Dispatch `ctx_2c68f7cdffd2`. SHA de validación `7af5e29` (reporte sobre `0b3e3d1`, cherry-pick local de DEV `4c33de8`). Sin push remoto, PR ni merge.
  - Confirmado (ejecutado): `pnpm install --frozen-lockfile` correcto; cobertura confirmada de 19 archivos (15 domain, 1 types, 2 powersync, 1 index raíz) vía `eslint src --format json` con 0 errores y 0 advertencias.
  - Pruebas stdin sin archivos temporales: fallo con exit 1 en `src/domain/prueba.ts` por reglas `quotes`, `semi` y `@typescript-eslint/no-unused-vars`; fallo con exit 1 en `src/types/prueba.ts` por `@typescript-eslint/no-explicit-any`; caso positivo en `src/powersync/prueba.ts` con exit 0.
  - Contrato de integración: `git diff 2ba0875..HEAD -- packages/shared/src/domain/selectors.ts` sin cambios (DeudasSelectors intacto).
  - Calidad: `pnpm typecheck` correcto (0 errores); `pnpm lint` correcto (shared `eslint src` + app `expo lint`); `pnpm test` 193/193 pasados (79 shared + 114 app en esta rama).
  - Reporte entregado: `docs/qa/issue-26-antigravity.md`. CI remoto: Pendiente hasta publicación de PR.

### Reglas de ejecución del ciclo #26

- Orquestador: DEV `4c33de8` verificado e integrado como `63d271b` en rama aislada `orchestration/issue-26`.
- Confirmado por ejecución propia: `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (79 shared + 101 app) y `pnpm infra:test` (12) correctos.
- Confirmado por ejecución propia: ESLint analiza 19 archivos (15 domain, 1 types, 2 powersync, 1 index); 0 errores y 0 advertencias. stdin con `export const lintProbe: any = 1` bajo `src/domain/lint-probe.ts` falla con exit 1 por `@typescript-eslint/no-explicit-any`; el mismo ejemplo con `number` da exit 0. No se añadió `--rule` ni se crearon archivos temporales.
- Diferencia de conteos esperada: ramas DEV/QA contienen pruebas #25; la integración aislada #26 conserva las 101 pruebas app de main. No se arrastran pruebas de sincronización al PR de lint.
- Preparación final de integración secuencial: #25 se fusionó localmente como ancestro de #26. El único conflicto fue AGENT_BOARD.md (add/add), resuelto conservando el tablero más reciente de #26 con historial #25. Se repiten las pruebas sobre el conjunto final; publicar/mergear #25 primero evita que su código figure como cambio nuevo del PR de lint.
- Confirmado por el orquestador en conjunto final: `pnpm test` correcto, 79 shared + 114 app = 193 pruebas. Los 12 tests de infraestructura ya pasaron y no hubo cambios posteriores en scripts/infra. No quedan terminales supervisados pendientes de liberar; las sesiones preexistentes se conservan por Orca.
- Confirmado en el mismo conjunto final: `pnpm lint` y `pnpm typecheck` correctos después de integrar ambas entregas y resolver el tablero.
- QA aceptado: commit `7af5e29`, solo reporte independiente; worktree QA limpio. Integrado por cherry-pick sin arrastrar #25.
- Confirmado: el usuario autorizó ambos comandos exactos de push; `git push -u origin orchestration/issue-25` y `git push -u origin orchestration/issue-26` terminaron con exit 0 hacia `https://github.com/FPI-App/vaulto`. PR #26 todavía sin abrir: requiere gate humano propio y respeta el orden de integración después del PR #33. CI y cierre remoto pendientes.
- Último escaneo confirmado: no hay ítems Todo; #25 y #26 figuran In Progress. Los otros Issues ya In Progress no se reasignan automáticamente.
- Cuerpos de PR preparados en `.cache/orchestration/pr-issue-25.md` y `pr-issue-26.md` (ignorados). Publicar, abrir PR, mergear y cerrar requieren los puntos de parada vigentes de la cabecera; CI correcto por sí solo no autoriza merge ni cierre. Solo #26 puede cerrarse tras cumplir todos los checks y gates; #25 conserva el bloqueo nativo.

PROHIBIDO BORRAR ARCHIVOS O CARPETAS, INCLUIDOS TUS TEMPORALES (REMOVE-ITEM, RM, DEL, ERASE, RD, RMDIR O EQUIVALENTES). PROHIBIDO IMPRIMIR SECRETOS. ENMASCARA PASSWORD, TOKEN, COOKIE, AUTHORIZATION Y CADENAS DE CONEXIÓN EN LOGS Y REPORTES.

- NO hacer push. NO escrituras DB. NO git add -f, reset --hard ni clean. El orquestador recibe commits locales y solicita confirmación del comando exacto de publicación cuando el resultado esté listo.
- Las secciones inferiores son HISTORIAL de #25; no son la tarea activa ni autorizan nuevas acciones sobre #25.

## Historial — Issue #25

- Issue: [#25 — Resolver abonos rechazados sin bloquear la cola de sincronización](https://github.com/FPI-App/vaulto/issues/25)
- Prioridad: P0. Selección: único P0 abierto en Todo; los demás P0 ya están In Progress.
- Estado: entregas locales integradas y verificadas; Issue abierto/bloqueado por validación nativa pendiente. Se permite pasar al siguiente Todo sin declarar resuelto #25.
- Confirmado: main inicial `2ba0875`; Claude y Antigravity ya tienen sesiones en sus worktrees.
- Confirmado: comentario del Issue reporta validación previa 60+60, anulación y operación posterior en dos Android. No repetir implementación existente por ignorar esa evidencia.
- Pendiente: cambio de cuenta con anulación pendiente, pérdida de respuesta y causa del reintento retrasado después de reconectar.
- Confirmado: SQLite cifrada y PowerSync requieren development build; un bundle no prueba ejecución nativa ni sincronización E2E.

## [DEV] Claude

- Rama: `feature/dev-features`.
- Worktree: `C:/Users/Emman/orca/workspaces/Vaulto/DEV-Claude-Features`.
- Estado: completado parcialmente (pendientes nativos); Task `task_6dd9a8640631`, Dispatch `ctx_7e526dee0d2d`; commits locales `a901ca9` y el de títulos (ver `git log`), sin push; las pruebas de pérdida de respuesta y reintento no simulan recibos del servidor ni reconexión automática.
  - Confirmado (Vitest; `pnpm test` 105/105, `pnpm typecheck` y `pnpm lint` sin errores): la anulación `requested` sobrevive al cambio de sesión sin llamar al servidor y se retoma al volver; las bases de dos cuentas no se cruzan; perder la respuesta de `cancelar_lote_abono` reintenta con el mismo `p_lote_id` y completa una sola vez; el rechazo 23514 se registra una vez y el reintento aplica con el mismo lote. Archivo modificado: `app/src/lib/sync/SupabaseConnector.test.ts` (solo pruebas; sin cambios de producción porque no hay fallo reproducible en la lógica actual).
  - Desconocido: causa del reintento tardío tras reconectar. Supuesto (lectura de `@powersync/shared-internals` 2.4.0, no ejecutado): tras un error de subida sin conexión el bucle de subida termina y solo se reactiva con la primera línea de sync o una escritura CRUD local; `vaulto_sync_recovery` no es tabla CRUD, así que «Anular abono» no despierta la subida, y el SDK no expone `triggerCrudUpload`. Propuesto: verificar en development build con logs de PowerSync antes de cambiar código.
  - Pendiente nativo: sin pruebas en dispositivo/SQLCipher/PowerSync ni sync entre dispositivos; los mocks no son E2E.
- Lee este tablero en la ruta absoluta del orquestador y consulta `AGENTS.md`, `docs/PLAN-MVP1.md`, el Issue #25 completo y sus comentarios antes de editar.
- Revisa recuperación de abonos rechazados en `app/src/lib/sync/`, `app/src/features/deudas/` y pruebas existentes. Aísla y corrige los pendientes reales del Issue, conservando atomicidad, idempotencia, IDs, historial, cola y metadatos PowerSync.
- Investiga reintento después de reconectar; cubre reinicio, cambio de cuenta con cancelación pendiente y pérdida de respuesta. Coordina infraestructura compartida mediante PR pequeño con alcance explícito.
- No reescribas el contrato DeudasSelectors ni toques Track A. No cambies SQL remoto ni credenciales. No agregues Jest/RNTL: el proyecto usa Vitest; coordina cualquier necesidad nueva.
- Mantén cambios en tu rama y commits en español. No hagas push, merge remoto ni cierres Issues; el orquestador prepara la integración y presenta el comando de push si requiere confirmación.
- Entrega SHA, archivos modificados, comandos/resultados y limitaciones; marca esta sección completada o bloqueada con evidencia. Actualiza solo tu sección de este archivo compartido, sin sobrescribir QA.

## [QA] Antigravity

- Rama: `feature/qa-tests`.
- Worktree: `C:/Users/Emman/orca/workspaces/Vaulto/QA-Antigravity-Tests`.
- Estado: completado localmente con bloqueo nativo para Issue #25 (permanece abierto). Commit local correctivo `780675f` (previamente se envió `853cf8e` a `origin/feature/qa-tests`; alto total a publicaciones remotas acatado, sin push adicional).
  - Confirmado (Vitest): `pnpm test` con 193/193 tests pasados (79 en shared, 114 en app). Incluye regresiones de DEV (`290e01d`) en `SupabaseConnector.test.ts` y suite local en `app/src/lib/sync/recuperacionAbonosRechazados.test.ts` (9 tests pasados).
  - Confirmado (Tipos y linter): `pnpm typecheck` exitoso (0 errores); `pnpm lint` con `expo lint` en app limpio (0 errores, 0 advertencias); `packages/shared` conserva script ficticio (Issue #26).
  - Delimitación técnica de casos: caso 1 simula 60+60 en 2 bases locales en memoria; caso 2 captura 23514 simulado y registra decision blocked; caso 3 solicita anulación a `cancelar_lote_abono` y libera cola; caso 4 procesa lote posterior válido; caso 5 recrea store sobre la misma conexión activa; caso 6 detiene sync ante cambio de sesión; caso 7 reintenta manualmente tras error de red; caso 8 maneja fallo local de `complete()` con recibo simulado `already_applied`; caso 9 filtra consultas locales por `espacio_id` sin validar RLS ni réplica PowerSync.
  - Bloqueo nativo: comprobado `adb devices` no disponible en PATH. Pruebas E2E en development build nativo con SQLCipher y réplica real con PowerSync permanecen pendientes; Issue #25 no puede cerrarse de extremo a extremo sin entorno nativo.
  - Reporte entregado: `docs/qa/issue-25-antigravity.md`.

## Integración y aceptación

- DEV aceptado por orquestador: `a901ca9` + `290e01d`, solo `SupabaseConnector.test.ts`; diff sin errores de whitespace, worktree DEV limpio. Integrados localmente en `orchestration/issue-25`.
- Para QA: puedes fusionar `290e01d` en tu rama para validar el conjunto. No esperar un push; las ramas y objetos Git ya están compartidos localmente.
- Revisión preliminar QA: caso 5 recrea un store sobre la misma conexión, no reinicia SQLite; caso 7 invoca uploadData manualmente, no dispara reconexión; caso 8 simula fallo de complete, no pérdida de respuesta RPC; caso 9 filtra filas locales, no prueba RLS/aislamiento de sync. Ajustar nombres e informe o mejorar pruebas antes de entrega. Evitar duplicar las cuatro regresiones ya entregadas por DEV.
- QA `853cf8e` REQUIERE CORRECCIÓN ANTES DE ACEPTAR: el reporte aún afirma cobertura exhaustiva, reinicio durable, reconexión idempotente y ausencia de duplicados remotos sin comprobarlos. Cambiar títulos y descripción a alcance real: recreación de store en misma conexión; reintento manual; fallo local de complete + recibo simulado; filtrado local sin RLS/sync. Registrar lint shared como ficticio, no linter verificado. Mantener #25 abierto/bloqueado por E2E nativo. No afirmar 0 advertencias sin salida de ejecución. No repetir pruebas duplicadas; distinguir evidencia propia del reporte del orquestador. Entregar commit correctivo e informe preciso.
- Incidencia confirmada: Antigravity publicó `853cf8e2b8108520a185c33c0429422feb587eb1` en `origin/feature/qa-tests` pese a la instrucción de no hacer push. Verificado con `git ls-remote` y `git fetch`. Se envió seguimiento urgente y el agente reconoció la restricción. Sin borrados ni reversión destructiva; pendiente corregir QA localmente antes de PR.
- Confirmado por orquestador tras integrar DEV: 22/22 pruebas del conector correctas; exportación Android Hermes correcta (2.102 módulos), salida ignorada `.cache/orchestration/issue-25-android`. No demuestra ejecución nativa ni Expo Go con módulos nativos.
- QA correctivo `780675f` integrado en `orchestration/issue-25`; orquestador ejecutó 31/31 pruebas de ambas suites correctas. Se aceptan como pruebas locales. Las cuatro líneas con espacios finales del encabezado del reporte son saltos Markdown, no código.
- Supervisión QA: Task `task_903630145b7b` agotó tres intentos por `agent_readiness timeout`, último Dispatch `ctx_7c567da3da84`. No se fingió worker_done; la entrega real se recibió mediante tablero y SHA local. La tarea de adopción está fallida, aunque el trabajo QA local sí fue entregado.
- Pendiente para publicar la integración: confirmación del comando exacto `git push -u origin orchestration/issue-25` hacia `https://github.com/FPI-App/vaulto`. No cerrar #25 automáticamente al integrar estas regresiones.
- Confirmado: las regresiones DEV pasan con producción actual. Desconocido: causa del reintento tardío y comportamiento remoto tras pérdida de respuesta. No cerrar #25 sin evidencia nativa pendiente.

- Confirmado por el orquestador sobre main inicial: `pnpm typecheck` correcto; `pnpm test` con 79 shared + 101 app correctas; `pnpm lint` termina correcto, pero shared conserva un script ficticio (Issue #26). Estos resultados son línea base, no validación de cambios futuros.

- Orquestador: verificar diffs/SHAs de ambas ramas; integrar en una rama `orchestration/issue-25` basada en main, antes de publicar PR hacia main. No integrar primero en main, porque dejaría el PR sin cambios.
- Ejecutar typecheck, lint y tests pertinentes, más comprobación de bundle cuando corresponda. Pruebas nativas y sincronización se registran separadas.
- Cerrar #25 y mover a Done únicamente si se cumplen sus criterios verificables. Un bloqueo nativo mantiene el Issue abierto.
- Próximo elegible: #26 (P2, Todo). Los Issues In Progress no se toman sin nueva evidencia o reasignación.

## Reglas obligatorias para ambos agentes

PROHIBIDO BORRAR ARCHIVOS O CARPETAS, INCLUIDOS TUS TEMPORALES (REMOVE-ITEM, RM, DEL, ERASE, RD, RMDIR O EQUIVALENTES). PROHIBIDO IMPRIMIR SECRETOS. ENMASCARA PASSWORD, TOKEN, COOKIE, AUTHORIZATION Y CADENAS DE CONEXIÓN EN LOGS Y REPORTES.

- No ejecutes reset --hard, clean, migraciones destructivas ni operaciones SQL de escritura. No uses git add -f ni incluyas archivos ignorados, .env o credenciales.
- Distingue Confirmado, Supuesto, Desconocido y Propuesto. Conserva informes existentes.
