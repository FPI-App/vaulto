# ADR 0001 — Un solo repositorio (mono) para Vaulto

**Estado:** Aceptada · **Fecha:** 2026-06 · **Decisores:** edav, lmilo

## Contexto

Hay que decidir si Vaulto vive en un solo repositorio (app + Supabase + paquete compartido) o se divide en repos separados de frontend y backend. El equipo es de 2 personas. El "backend" es Supabase gestionado: migraciones SQL, RLS, edge functions y la conexión que alimenta PowerSync — no un servidor con runtime propio.

El documento maestro (§7.2, repo `docs`) ya recomendaba: *"Estructura de repo simple, NO monorepo de 5 paquetes: app + supabase + docs"*. `docs` se extrajo a su propio repo, así que `vaulto` queda con app + supabase + un paquete compartido.

## Decisión

Un solo repositorio `vaulto` con workspaces de pnpm: `app/` (Expo), `packages/shared` (tipos + dominio + esquema PowerSync) y `supabase/` (migraciones, RLS, functions). Sin separar frontend y backend.

## Razones

1. **El backend no es un backend.** Es configuración versionada del esquema, no un servicio con ciclo de despliegue propio. No hay frontera real que justifique un repo aparte.
2. **Commits atómicos app + migración.** Cambiar esquema y la app que lo consume es un solo commit revisable, con un único punto de rollback. En split son dos PRs coordinados a mano — overhead que 2 devs se saltarán, desincronizando app y esquema.
3. **Tipos compartidos sin ceremonia.** Tipos generados de Postgres + esquema PowerSync + dominio puro los consumen ambos lados. En mono: workspace local. En split: duplicar (se desincroniza), publicar paquete privado (absurdo para 2) o submódulos (frágiles).
4. **CI más simple.** Un pipeline, un set de secrets, path filters para distinguir cambios.
5. **El riesgo dominante es no terminar.** Toda ceremonia cross-repo resta energía a llegar a la primera transacción real.

## Por qué un solo `packages/shared`

El brief original pedía `app/shared/backend/docs/infra` — premature abstraction para 2 devs. Solo se justifica UN paquete compartido por tres cosas que cruzan cliente/servidor: tipos del esquema, dominio puro y esquema PowerSync. No hay `infra/` (Supabase + EAS son la infra) ni `backend/` como paquete (es `supabase/`).

## Cuándo reconsiderar

Si aparece un servicio real con runtime propio (parser server-side, jobs de push en Render), primero vive como `services/` dentro de este repo; solo se extrae si su cadencia de despliegue diverge de verdad. No se anticipa hoy.

## Consecuencias

- (+) Cambios esquema+app atómicos, tipos sin desincronización, onboarding y CI simples.
- (−) El repo mezcla TS/Expo con SQL/Deno y un clone trae todo. Irrelevante para 2 devs que tocan ambos lados.
