# Issue #18 — revisión DEV del diff de documentación del coordinador

Revisión de **solo lectura** del diff local del worktree `ORQUESTADOR-Codex-Main` (README, ARQUITECTURA, app/README, supabase/policies/README, DEMO, PLAN-MVP1, INFRA-SETUP) y de `docs/validaciones/2026-10-30`, contrastado con el código de esta rama. Este archivo es lo único que DEV aporta; no se replican ni modifican los documentos del coordinador. Sin cambios de código, SQL ni configuración desplegada.

## Aclaración de proceso

Antes de recibir el cambio de alcance, DEV redactó su propia versión de estas ediciones y la confirmó en `9f32bdb`. Al llegar la instrucción de no replicar los archivos del coordinador, se deshizo con `24434a8` (`git revert`, sin reescribir historia). Esos dos commits quedan en el historial de `feature/dev-features`; el árbol resultante no contiene esas ediciones. El coordinador debe tomar solo el commit que añade este informe y no `9f32bdb` ni su reversión.

## Hallazgos contra el código (contradicciones residuales)

| # | Dónde | Hallazgo | Evidencia en el código |
|---|---|---|---|
| 1 | `.env.example` (raíz) líneas 14-15 | Sigue declarando `SQLCIPHER_DEV_KEY=clave_solo_para_desarrollo_local` bajo «Cifrado local». La documentación corregida dice que la llave es aleatoria de 32 bytes por usuario y que no hay llave global. | Búsqueda de `SQLCIPHER_DEV_KEY` en `.ts`, `.tsx`, `.js` y `.mjs` sin coincidencias; `databaseKeys` usa `getRandomBytesAsync(32)`. Proponer retirar la variable o marcarla como no usada. |
| 2 | `app/README.md` línea 25 | Pide `EXPO_PUBLIC_SUPABASE_ANON_KEY`; la plantilla `app/.env.example` usa `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `app/src/lib/supabase.ts` acepta ambas (PUBLISHABLE primero). | `app/src/lib/supabase.ts` líneas 19-20. El mismo nombre antiguo sigue en `docs/INFRA-SETUP.md:102` y en `docs/PLAN-MVP1.md` B.0.5. |
| 3 | `app/README.md` línea 84 | Sigue diciendo que cada feature tiene un `README-OWNER.md`. | No existe ninguno en `app/src/features/*`. La propiedad está en `docs/PLAN-MVP1.md`. |
| 4 | `app/README.md` líneas 61-67 | El árbol de `lib/` quedó con sangría rota y desordenado (`supabase.ts` desplazado respecto de `lib/`); no lista `db/`, `espacio/`, `deudas/`, `ui/` ni `navigation/`, y `sync/` sigue descrito solo como «base OP-SQLite + conector». | `ls app/src/lib` muestra `auth db deudas espacio navigation powersync sync ui supabase.ts`. |
| 5 | `README.md` línea 42 | `sync/` sigue descrito como «Integración PowerSync, cola, resolución de conflictos», contradiciendo que el merge por campo y el LWW no existen. El árbol también omitió `lib/db/` (llaves, sesiones, migración legacy). | `ARQUITECTURA.md` §2 corregido; `app/src/lib/db/LegacyDatabaseMigration.ts` existe. |
| 6 | `supabase/README.md` líneas 3 y 11 | Aún menciona edge functions y `functions/` (Deno), mientras el README raíz ya no las lista. | `supabase/functions` solo contiene `.gitkeep`. |
| 7 | `docs/PLAN-MVP1.md` | La nota «Estado contrastado» es clara, pero los 21 checklists conservan casillas sin marcar y B.0.5 sigue usando `ANON_KEY`. La nota lo declara, así que es aceptable. | Ver hallazgo 2. |

## Coincidencias confirmadas con el código

- **Noop:** `app/README.md:83` («La noop solo se usa mientras no hay espacio») coincide con `DeudasSelectorsProvider.tsx` (`espacioId ? new SQLiteDeudasSelectors(...) : noopDeudasSelectors`).
- **Llave SQLCipher:** `ARQUITECTURA.md` y el runbook corregido dicen 32 bytes aleatorios por usuario en `expo-secure-store`; coincide con `databaseKeys`.
- **Reglas Cloud frente a local:** `powersync/sync-config.yaml` es Sync Streams `edition: 3`; `supabase/sync_rules.yaml` usa `bucket_definitions` y el servicio local fija `journeyapps/powersync-service:1.27.0`. La distinción documentada es correcta y no afirma equivalencia literal.
- **Perfil:** el sync entrega `perfil` con `id = auth.user_id()`; la RLS permite leer perfiles del mismo espacio. La nota del coordinador lo describe bien.
- **Variables de `pnpm infra:check`:** `scripts/check-infra.mjs` lee `app/.env` y `app/.env.local`, igual que dice `app/README.md:103` y que la instrucción `Copy-Item app/.env.example app/.env`.
- **Rutas:** `domain/selectors.ts`, `features/deudas/data/deudasSelectors.ts` y `lib/supabase.ts` existen; ya no quedan `contracts/deudas-selectors.ts`, `lib/supabase/` ni `env.ts`.
- **Guard de lotes:** la nota de `supabase/policies/README.md` sobre el trigger de lote se corresponde con `exigir_lote_sync` en `0012_aplica_lotes_sync_atomicos.sql`.
- **pnpm:** `package.json` fija `pnpm@9.12.0`; los comandos usan `--frozen-lockfile`.
- **Migración legacy y recuperación:** implementadas en `LegacyDatabaseMigration`, `SyncRecoveryStore` y `cancelar_lote_abono` (0013+); la redacción conserva como pendientes #21 (replay remoto tras migración y reinicio) y #25.

## Comandos ejecutados (solo lectura)

- `git -C ORQUESTADOR-Codex-Main status --short`, `diff --stat` y `diff` de los siete documentos.
- Búsquedas con `grep` de `Falta el flujo`, `noop`, `Edge`, `functions`, `SQLCIPHER_DEV_KEY`, `infra:check`, `AsyncStorage`, `README-OWNER`, `contracts/`, `ANON_KEY` y `deriv`.
- Existencia de rutas con `ls` y `[ -e ]`; lectura de `scripts/check-infra.mjs`, `DeudasSelectorsProvider.tsx` y `0012_*.sql`.
- No se ejecutaron `lint`, `typecheck` ni `test`; el coordinador informó 201 pruebas, tipos y lint en verde.

## NO verificado

- Los hechos del preflight remoto (migraciones 0001–0016, 8 triggers, RLS en 8 tablas, RPC solo para `authenticated`, 0 concesiones DELETE/TRUNCATE) y la coincidencia byte a byte de la configuración Cloud los informó el coordinador; DEV no tuvo acceso remoto y no los repitió.
- Contenido de `docs/validaciones/2026-10-30` más allá de las referencias hechas desde los documentos; no se auditó archivo por archivo.
- Cualquier prueba nativa, de dispositivo o de sincronización entre dispositivos; los criterios pendientes de #18 (PR #22 y rama atómica #23/#24, reconciliación completa de runbooks, coordinación con lmilo) siguen pendientes.
- Los documentos históricos (`VALIDACION-SYNC-CIFRADO-2026-10-27.md`, `INICIO-TRACK-B`, `ENTREGA-PENDIENTES-EDAV`, `AVANCE-TRACK-B`, `DIAGNOSTICO-*`) no se revisaron en esta pasada.
- El soporte de Sync Streams en la imagen autoalojada 1.27.0 sigue sin comprobar.

## Preguntas opcionales

- ¿Se quita `SQLCIPHER_DEV_KEY` del `.env.example` o se conserva marcada como obsoleta?
- ¿Se actualiza `ANON_KEY` a `PUBLISHABLE_KEY` también en el plan y el runbook, o se deja como compatibilidad histórica?
