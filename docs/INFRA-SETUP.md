---
estado: activo
owner: edav
creado: 2026-06-26
actualizado: 2026-06-26
---

# INFRA-SETUP.md — Provisión de Supabase + PowerSync (edav)

> **Quién:** edav. **Cuándo:** PRIMER workstream del Track B — pone el spine LIVE.
> **Por qué importa:** sin esto no hay sync remoto ni keys. Pero **lmilo NO se bloquea**: desarrolla contra Supabase local (`pnpm supabase:start`) o el modo local de PowerSync mientras esto se completa.
>
> **Regla dura:** ningún secreto va al repo. El `.env` real nunca se commitea (ya está en `.gitignore`). Solo `.env.example` (placeholders) vive en git.

---

## 0. Prerrequisitos

- [ ] Acceso a la org Supabase de **FPI-App** (o crearla).
- [ ] Supabase CLI instalado (`supabase --version`).
- [ ] Docker corriendo (para el entorno local).
- [ ] Cuenta de PowerSync (journeyapps) con acceso al proyecto.
- [ ] Acceso SSH con identidad personal al repo `FPI-App/vaulto`.

---

## 1. Crear el proyecto Supabase

- [ ] Crear proyecto en la org **FPI-App**, nombre `vaulto`.
- [ ] Región: la más cercana a Colombia (ej. `us-east-1` / `sa-east-1` según disponibilidad y latencia).
- [ ] Guardar la **DB password** en el gestor de secretos del equipo (NO en el repo).
- [ ] Anotar **Project URL** y **anon key** (Settings → API). Anotar también la **service_role key** (solo para scripts de servidor; NUNCA va a la app ni al repo).

✅ **Hecho cuando:** el dashboard de Supabase muestra el proyecto `vaulto` activo y tienes URL + anon key + service_role guardadas de forma segura.

---

## 2. Habilitar Auth (correo/contraseña)

- [ ] Authentication → Providers → habilitar **Email** (password).
- [ ] Habilitar recuperación de contraseña (reset por email).
- [ ] Configurar plantillas de correo en español (confirmación / recuperación).
- [ ] Definir la URL de redirección/deep link de la app para el reset (Expo).
- [ ] (MVP) Decidir si se exige confirmación de email; documentar la decisión.

✅ **Hecho cuando:** puedes registrar un usuario por correo/contraseña desde la app y completar un flujo de recuperación de contraseña.

---

## 3. Aplicar el esquema (migraciones)

> El cimiento lo crea edav porque es dueño de la infra; lmilo construye sus tablas encima.

- [ ] Vincular el repo al proyecto remoto: `supabase link --project-ref <ref>`.
- [ ] Crear la migración cimiento (`supabase migration new agrega_cimiento_espacios`):
  - `espacio`, `espacio_miembro` (campos transversales + propios del modelo canónico).
  - Función helper RLS `espacios_del_usuario()` → `select espacio_id from espacio_miembro where user_id = auth.uid() and deleted_at is null`.
  - Trigger genérico `set_updated_at()` para mantener `updated_at`.
  - `gen_random_uuid()` disponible (extensión `pgcrypto` si hace falta).
- [ ] Aplicar local: `pnpm db:migrate` (reset con todas las migraciones).
- [ ] Aplicar remoto: `supabase db push`.
- [ ] Regenerar tipos: `pnpm db:types` (escribe `packages/shared/src/types/database.ts`).
- [ ] Habilitar **RLS en todas** las tablas con su política base por `espacios_del_usuario()`; casos especiales: `espacio` (por `id`), `espacio_miembro` (`user_id = auth.uid()` o pivot), `perfil` (`id = auth.uid()` o miembro).
- [ ] **Alinear docs del spine** (`ARQUITECTURA.md` §1, `supabase/policies/README.md`) al modelo canónico (RLS por pivot, `espacio_id` NOT NULL salvo `espacio`).

✅ **Hecho cuando:** `pnpm db:migrate` corre limpio; las tablas cimiento existen con RLS; `pnpm db:types` genera tipos sin error; una query desde un usuario no devuelve filas de otro espacio.

---

## 4. Provisionar PowerSync

- [ ] Crear instancia PowerSync (journeyapps), conectada al Postgres del proyecto Supabase.
- [ ] Crear el **rol/usuario de réplica** en Postgres que PowerSync usa para leer cambios (least-privilege); guardar sus credenciales en el secretos del equipo.
- [ ] Configurar la conexión (host, puerto, db, usuario réplica, password) en PowerSync.
- [ ] Definir las **Sync Rules** coherentes con RLS: cada dispositivo baja solo filas de los espacios del usuario (mismo criterio que `espacios_del_usuario()`). Respetar `deleted_at` (las filas soft-deleted se sincronizan pero la app las filtra).
- [ ] Definir el **esquema de sync del lado cliente** en `packages/shared/src/powersync/` coherente con las migraciones.
- [ ] Anotar el **PowerSync URL** (endpoint de la instancia).

✅ **Hecho cuando:** la instancia PowerSync está conectada y "healthy"; las sync rules compilan; el esquema cliente en `packages/shared/src/powersync/` corresponde a las tablas del modelo canónico.

---

## 5. Configurar el conector y las credenciales del backend

- [ ] Configurar el **connector** que la app usa para autenticar contra PowerSync con el token de sesión de Supabase (la sesión de Supabase Auth firma el acceso a PowerSync).
- [ ] Verificar que el token de Supabase es aceptado por PowerSync (audiencia/claims correctos).
- [ ] Confirmar least-privilege: el rol de réplica solo lee lo necesario; la app nunca usa la service_role key.

✅ **Hecho cuando:** un usuario logueado en la app obtiene un token válido y PowerSync acepta la conexión de sync con ese token.

---

## 6. Llenar y compartir `.env` (de forma segura)

- [ ] Copiar `cp .env.example .env`.
- [ ] Completar:
  - `EXPO_PUBLIC_SUPABASE_URL=` (paso 1)
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY=` (paso 1; pública por diseño, la seguridad la da RLS)
  - `EXPO_PUBLIC_POWERSYNC_URL=` (paso 4)
- [ ] **NO commitear** el `.env` (verificar `git status` — debe estar ignorado).
- [ ] Compartir las keys con lmilo por canal seguro (gestor de secretos del equipo / 1Password / mensaje cifrado), **nunca por el repo, PR, ni chat en claro**.
- [ ] La llave de SQLCipher NO va en el `.env` de producción: se deriva por usuario y se guarda en `expo-secure-store`. `SQLCIPHER_DEV_KEY` es solo para desarrollo local.

✅ **Hecho cuando:** lmilo tiene las 3 keys públicas por canal seguro; el `.env` real no aparece en `git status`; ningún secreto está en el historial de git.

---

## 7. Verificar sync con 2 dispositivos

- [ ] Build de desarrollo en 2 dispositivos (SQLCipher/PowerSync no corren en Expo Go): `pnpm app:prebuild` + `pnpm app:android`/`app:ios`.
- [ ] Loguear el **mismo usuario/espacio** en ambos.
- [ ] En dispositivo A: crear un registro (ej. una cuenta o deuda) **offline**; en B verificar que aparece al reconectar A.
- [ ] Edición concurrente: editar campos distintos del mismo registro en A y B; confirmar el comportamiento de merge esperado (per-field donde aplique; LWW como fallback).
- [ ] Soft delete: borrar en A (escribe `deleted_at`); confirmar que desaparece en B.
- [ ] Aislamiento: loguear un segundo usuario de **otro espacio**; confirmar que NO ve datos del primero.

✅ **Hecho cuando:** un cambio hecho offline en un dispositivo aparece en el otro al sincronizar; el soft delete se propaga; un usuario de otro espacio no ve datos ajenos. **Esto es el Checkpoint B.0: avisa a lmilo que el spine está LIVE.**

---

## Notas de seguridad (no negociables)

- `EXPO_PUBLIC_*` son públicas por diseño; la seguridad real es **RLS** (servidor) + **SQLCipher** (dispositivo).
- La **service_role key** y la password de réplica son secretos de servidor: NUNCA en la app, el repo, ni el `.env` que se comparte con la app.
- RLS ≠ cifrado local: ambos son necesarios, ninguno sustituye al otro.
- Si una key se filtra: rotarla en Supabase/PowerSync y actualizar el `.env` del equipo de inmediato.
