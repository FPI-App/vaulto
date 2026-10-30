# Supabase — backend de Vaulto

Esto **no es un servidor**: es la configuración versionada del backend gestionado de Vaulto (esquema Postgres, RLS, edge functions y la conexión que alimenta PowerSync). Por eso vive dentro del mismo repo que la app — cambiar el esquema y la app que lo consume es un solo commit atómico.

## Estructura

```
supabase/
├─ migrations/   # Migraciones SQL versionadas (orden = nombre de archivo)
├─ policies/     # Políticas RLS documentadas (referencia legible)
└─ functions/    # Edge functions (Deno)
```

> `migrations/` es la fuente de verdad del esquema. `policies/` documenta las políticas RLS de forma legible para el equipo; las políticas reales se aplican vía migración.

## Requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (para el entorno local)

## Flujo de trabajo

`pnpm db:migrate` ejecuta `supabase db reset`: borra/recrea la base local. Revisa el destino y obtén confirmación del comando exacto antes de usarlo. No es una aplicación incremental de migraciones.

```bash
# Levantar Supabase en local (desde la raíz del repo)
pnpm supabase:start

# Crear una nueva migración
supabase migration new agrega_tabla_movimientos

# Aplicar migraciones (reinicia la DB local con todas las migraciones + seed)
pnpm db:migrate

# Regenerar los tipos TS del esquema en packages/shared
pnpm db:types

# Detener el entorno local
pnpm supabase:stop
```

## Reglas no negociables

1. **RLS obligatorio.** Toda tabla nueva habilita RLS y define sus políticas en la misma migración. Tabla sin política = inaccesible (es el comportamiento correcto, no un bug).
2. **Campos transversales.** Toda tabla de dominio incluye `id` (uuid, cliente), `created_at`, `updated_at`, `deleted_at` y `espacio_id` NOT NULL. La raíz `espacio` no tiene `espacio_id`; `currency` aplica a entidades monetarias y `country` a `espacio`/`perfil`. El acceso se autoriza mediante `espacio_miembro`. Ver `../ARQUITECTURA.md`.
3. **Soft delete.** Borrar = escribir `deleted_at`. No hay DELETE físico en el flujo normal (no se sincroniza fiablemente).
4. **UUID en cliente.** Las PKs son `uuid` generados por la app, no `serial`/`identity`.

## PowerSync

La instancia de PowerSync se conecta a este Postgres y replica el esquema a la SQLite local (cifrada con SQLCipher) de cada dispositivo. La definición del esquema de sincronización del lado cliente vive en `../packages/shared/src/powersync/`. Las reglas de sincronización (qué filas ve cada usuario) deben ser coherentes con las políticas RLS de aquí.

### PowerSync en local

`powersync/` levanta el servicio self-hosted contra el Supabase local, con `sync_rules.yaml` montado tal cual. Con Supabase arriba:

```bash
cp supabase/powersync/.env.example supabase/powersync/.env   # completar JWT_SECRET de `supabase status -o env`
pnpm powersync:start    # http://localhost:8085
pnpm powersync:stop
```

En `app/.env`: `EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321` y `EXPO_PUBLIC_POWERSYNC_URL=http://localhost:8085`. Un teléfono por USB llega a esos puertos con `adb reverse tcp:54321 tcp:54321 && adb reverse tcp:8085 tcp:8085`.

## Convenciones

- Nombres de migración descriptivos en español imperativo: `agrega_tabla_deudas`, `agrega_rls_movimientos`.
- Nombres de tabla/columna de dominio en español (`movimiento`, `saldo_inicial`, `espacio_id`).
- Una migración = un cambio coherente. No mezclar refactors no relacionados.

## RLS aislada sin Supabase CLI

`node scripts/test-rls-local.mjs --check`, desde la raíz, inspecciona exclusivamente
`vaulto-qa-pg-20261028/vaulto_qa`. Requiere un contenedor etiquetado `com.vaulto.purpose=local-rls`,
imagen `postgres:15-bookworm`, pgTAP instalado y ningún puerto publicado.

`--apply-migrations` prepara el esquema y ejecuta los tests. **Requiere confirmación explícita**:
las migraciones contienen DROP de políticas/triggers y los tests incluyen borrados de fixtures.
Solo admite una base vacía o la misma versión ya preparada; nunca resetea una base existente.
`--test` repite las pruebas sobre esa versión sin volver a aplicar migraciones.

El bootstrap de prueba implementa únicamente `auth.users`, `auth.uid()` y los roles usados
por RLS. No emula el servicio Supabase Auth, PostgREST, PowerSync ni los dispositivos.
Los tests usan usuarios ficticios y hacen rollback; una suite pgTAP aprobada no valida sync.
