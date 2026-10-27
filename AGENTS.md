# Vaulto

## Contexto y objetivo

App de finanzas personales offline-first para Colombia/LATAM. El MVP incluye cuentas, categorías, movimientos, deudas, abonos y dashboard. El alcance y la propiedad de archivos se definen en `docs/PLAN-MVP1.md`; consulta ese documento antes de implementar una feature.

## Stack y estructura

- `app/`: Expo, React Native, TypeScript y Expo Router.
- `packages/shared/`: tipos, dominio puro, contrato `DeudasSelectors` y esquema PowerSync.
- `supabase/`: migraciones, RLS, pruebas SQL y configuración de PowerSync.
- `docs/`: plan, decisiones y documentación técnica.
- Gestor: pnpm; respeta la versión fijada en `package.json` y `pnpm-lock.yaml`.

## Convenciones y propiedad

- Español en documentación y commits; TypeScript estricto, comillas simples y sin punto y coma.
- lmilo: cuentas, categorías, movimientos y dashboard (Track A).
- edav: infraestructura, onboarding, perfil, deudas, pagos e implementación de selectores de deudas (Track B).
- Conserva la interfaz existente en `packages/shared/src/domain/selectors.ts`; el dashboard consume ese contrato.
- Los cambios en infraestructura compartida de la app requieren el proceso de coordinación descrito en el plan.
- El modelo canónico del plan manda sobre documentación anterior: aislamiento por espacio y membresía, montos decimales y soft delete.
- Aplica las reglas globales del usuario sobre secretos, borrados, bases de datos y confirmación explícita para `git push`.

## Comandos y verificación

- Instalación: `pnpm install --frozen-lockfile`.
- Calidad: `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- Pruebas SQL: `pnpm db:test`, solo con un entorno local preparado.
- Desarrollo: `pnpm app:dev`; los módulos nativos de SQLite/PowerSync requieren development build.
- Consulta los scripts antes de ejecutar operaciones de infraestructura: `db:migrate` ejecuta `supabase db reset` y requiere revisión del destino y autorización antes de usarlo.
- Prueba el dominio sin red. Las pruebas de TypeScript no sustituyen las pruebas nativas, de RLS ni de sincronización entre dispositivos.
- Distingue Confirmado, Supuesto, Desconocido y Propuesto. Registra solo verificaciones ejecutadas y conserva los informes locales existentes.
