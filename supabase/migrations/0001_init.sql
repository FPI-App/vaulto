-- ============================================================================
-- Vaulto — Migración inicial (MVP1)
-- ============================================================================
-- Esquema completo de la capa de datos: tablas de dominio con los campos
-- transversales obligatorios, índices, trigger genérico de updated_at y TODAS
-- las políticas RLS.
--
-- Modelo de aislamiento: el `espacio` es la unidad de datos. Cada fila lleva
-- `espacio_id`. La visibilidad/edición se decide por pertenencia al espacio vía
-- la tabla pivot `espacio_miembro`. Esto soporta el modo pareja futuro SIN
-- migración disruptiva (basta con insertar un segundo miembro).
--
-- Convenciones (ver ARQUITECTURA.md):
--   - PK uuid generada en cliente (default gen_random_uuid() como red de
--     seguridad). Offline-first: la app crea registros sin red ni colisiones.
--   - Soft delete: borrar = escribir `deleted_at`. No hay DELETE físico.
--   - updated_at mantenido por trigger.
--   - currency/country preparan multimoneda aunque el MVP opere en COP/CO.
--
-- Idempotente donde es razonable (IF NOT EXISTS / CREATE OR REPLACE / guardas
-- en DO blocks para las políticas).
-- ============================================================================

-- pgcrypto provee gen_random_uuid(). En Supabase suele venir instalada, pero la
-- declaramos explícita para que la migración corra en cualquier Postgres limpio.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Trigger genérico: mantiene updated_at en cada UPDATE.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Helper: enlaza el trigger de updated_at a una tabla (idempotente).
create or replace function public.attach_updated_at_trigger(p_table regclass)
returns void
language plpgsql
as $$
declare
  v_trigger_name text := 'set_updated_at';
begin
  execute format(
    'drop trigger if exists %I on %s',
    v_trigger_name, p_table
  );
  execute format(
    'create trigger %I before update on %s for each row execute function public.set_updated_at()',
    v_trigger_name, p_table
  );
end;
$$;

-- Helper de autorización: ¿el usuario actual es miembro vivo del espacio dado?
-- Centraliza la lógica del pivot para que toda política RLS sea idéntica y
-- auditable en un solo lugar. SECURITY DEFINER + search_path fijo para evitar
-- recursión de RLS al consultar espacio_miembro desde dentro de una política.
-- Se define en plpgsql (no sql) a propósito: difiere la validación del cuerpo
-- para que la función pueda crearse antes que la tabla espacio_miembro y la
-- migración corra de arriba hacia abajo sin reordenar.
create or replace function public.is_espacio_member(p_espacio_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.espacio_miembro em
    where em.espacio_id = p_espacio_id
      and em.user_id = auth.uid()
      and em.deleted_at is null
  );
end;
$$;

-- ============================================================================
-- TABLAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- espacio — unidad de aislamiento y futura compartición (modo pareja).
-- No lleva espacio_id (es la raíz). owner_user_id referencia al creador.
-- ----------------------------------------------------------------------------
create table if not exists public.espacio (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  base_currency text not null default 'COP',
  country       text not null default 'CO',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- ----------------------------------------------------------------------------
-- espacio_miembro — pivot de membresía. Base de TODA la RLS.
-- Soporta el modo pareja sin migración: insertar otra fila = compartir.
-- ----------------------------------------------------------------------------
create table if not exists public.espacio_miembro (
  id         uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacio (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  rol        text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint espacio_miembro_unico unique (espacio_id, user_id)
);

-- ----------------------------------------------------------------------------
-- perfil — datos del usuario. id = auth.uid() (1:1 con auth.users). [TRACK B]
-- ----------------------------------------------------------------------------
create table if not exists public.perfil (
  id                  uuid primary key references auth.users (id) on delete cascade,
  espacio_id          uuid not null references public.espacio (id) on delete cascade,
  nombre              text not null,
  apellido            text not null,
  username            text not null,
  foto_url            text,
  descripcion         text,
  ocupacion           text,
  country             text not null default 'CO',
  onboarding_completo boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  constraint perfil_username_unico unique (username)
);

-- ----------------------------------------------------------------------------
-- cuenta — cuentas de dinero (banco/efectivo). [TRACK A]
-- ----------------------------------------------------------------------------
create table if not exists public.cuenta (
  id            uuid primary key default gen_random_uuid(),
  espacio_id    uuid not null references public.espacio (id) on delete cascade,
  nombre        text not null,
  tipo          text not null,
  banco         text,
  saldo_inicial numeric(14, 2) not null default 0,
  currency      text not null default 'COP',
  archivada     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint cuenta_tipo_valido check (tipo in ('banco', 'efectivo'))
);

-- ----------------------------------------------------------------------------
-- categoria — categorías de ingreso/egreso. [TRACK A]
-- ----------------------------------------------------------------------------
create table if not exists public.categoria (
  id         uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacio (id) on delete cascade,
  nombre     text not null,
  tipo       text not null,
  icono      text,
  color      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint categoria_tipo_valido check (tipo in ('ingreso', 'egreso'))
);

-- ----------------------------------------------------------------------------
-- movimiento — transacciones (ingreso/egreso/transferencia). [TRACK A]
-- cuenta_destino_id solo aplica a transferencias.
-- pago_id es el puente débil hacia un abono de deuda (lo escribe Track B).
-- ----------------------------------------------------------------------------
create table if not exists public.movimiento (
  id               uuid primary key default gen_random_uuid(),
  espacio_id       uuid not null references public.espacio (id) on delete cascade,
  cuenta_id        uuid not null references public.cuenta (id) on delete restrict,
  cuenta_destino_id uuid references public.cuenta (id) on delete restrict,
  categoria_id     uuid references public.categoria (id) on delete set null,
  tipo             text not null,
  monto            numeric(14, 2) not null,
  currency         text not null default 'COP',
  fecha            timestamptz not null,
  nota             text,
  pago_id          uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint movimiento_tipo_valido check (tipo in ('ingreso', 'egreso', 'transferencia')),
  -- Una transferencia exige destino; ingreso/egreso no lo permiten.
  constraint movimiento_destino_coherente check (
    (tipo = 'transferencia' and cuenta_destino_id is not null)
    or (tipo <> 'transferencia' and cuenta_destino_id is null)
  )
);

-- ----------------------------------------------------------------------------
-- deuda — deudas en ambas direcciones. [TRACK B]
-- ----------------------------------------------------------------------------
create table if not exists public.deuda (
  id              uuid primary key default gen_random_uuid(),
  espacio_id      uuid not null references public.espacio (id) on delete cascade,
  direccion       text not null,
  contraparte     text not null,
  monto_inicial   numeric(14, 2) not null,
  saldo_pendiente numeric(14, 2) not null,
  currency        text not null default 'COP',
  fecha_limite    date,
  prioridad       integer not null default 0,
  estado          text not null default 'activa',
  nota            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint deuda_direccion_valida check (direccion in ('yo_debo', 'me_deben')),
  constraint deuda_estado_valido check (estado in ('activa', 'saldada'))
);

-- ----------------------------------------------------------------------------
-- pago — abonos a una deuda. Puente Deuda<->Movimiento. [TRACK B]
-- movimiento_id enlaza opcionalmente el abono con el movimiento de caja.
-- ----------------------------------------------------------------------------
create table if not exists public.pago (
  id            uuid primary key default gen_random_uuid(),
  espacio_id    uuid not null references public.espacio (id) on delete cascade,
  deuda_id      uuid not null references public.deuda (id) on delete cascade,
  monto         numeric(14, 2) not null,
  currency      text not null default 'COP',
  fecha         timestamptz not null,
  nota          text,
  movimiento_id uuid references public.movimiento (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- ============================================================================
-- TRIGGERS updated_at
-- ============================================================================
select public.attach_updated_at_trigger('public.espacio');
select public.attach_updated_at_trigger('public.espacio_miembro');
select public.attach_updated_at_trigger('public.perfil');
select public.attach_updated_at_trigger('public.cuenta');
select public.attach_updated_at_trigger('public.categoria');
select public.attach_updated_at_trigger('public.movimiento');
select public.attach_updated_at_trigger('public.deuda');
select public.attach_updated_at_trigger('public.pago');

-- ============================================================================
-- ÍNDICES
-- ============================================================================
-- Patrón: índice por espacio_id (filtro de tenant en cada query y en sync),
-- por cada FK (joins y borrado en cascada), y por fecha donde se ordena.
-- Todos parciales sobre `deleted_at is null` para que el índice no cargue con
-- filas soft-deleted que la app nunca consulta en el flujo normal.

create index if not exists idx_espacio_miembro_user
  on public.espacio_miembro (user_id) where deleted_at is null;
create index if not exists idx_espacio_miembro_espacio
  on public.espacio_miembro (espacio_id) where deleted_at is null;

create index if not exists idx_perfil_espacio
  on public.perfil (espacio_id) where deleted_at is null;

create index if not exists idx_cuenta_espacio
  on public.cuenta (espacio_id) where deleted_at is null;

create index if not exists idx_categoria_espacio
  on public.categoria (espacio_id) where deleted_at is null;

create index if not exists idx_movimiento_espacio
  on public.movimiento (espacio_id) where deleted_at is null;
create index if not exists idx_movimiento_cuenta
  on public.movimiento (cuenta_id) where deleted_at is null;
create index if not exists idx_movimiento_cuenta_destino
  on public.movimiento (cuenta_destino_id) where deleted_at is null;
create index if not exists idx_movimiento_categoria
  on public.movimiento (categoria_id) where deleted_at is null;
create index if not exists idx_movimiento_pago
  on public.movimiento (pago_id) where deleted_at is null;
-- Listado del feed: por espacio y fecha descendente.
create index if not exists idx_movimiento_espacio_fecha
  on public.movimiento (espacio_id, fecha desc) where deleted_at is null;

create index if not exists idx_deuda_espacio
  on public.deuda (espacio_id) where deleted_at is null;
-- Próximos vencimientos (selector del contrato): deudas activas por fecha límite.
create index if not exists idx_deuda_vencimiento
  on public.deuda (espacio_id, fecha_limite)
  where deleted_at is null and estado = 'activa';

create index if not exists idx_pago_espacio
  on public.pago (espacio_id) where deleted_at is null;
create index if not exists idx_pago_deuda
  on public.pago (deuda_id) where deleted_at is null;
create index if not exists idx_pago_movimiento
  on public.pago (movimiento_id) where deleted_at is null;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Se habilita en TODAS las tablas. Sin política = sin acceso (correcto).
-- Política base de tablas de dominio: la fila es visible/editable si su
-- espacio_id pertenece a un espacio donde el usuario es miembro vivo.
-- NUNCA se exponen datos de otros espacios.

alter table public.espacio          enable row level security;
alter table public.espacio_miembro  enable row level security;
alter table public.perfil           enable row level security;
alter table public.cuenta           enable row level security;
alter table public.categoria        enable row level security;
alter table public.movimiento       enable row level security;
alter table public.deuda            enable row level security;
alter table public.pago             enable row level security;

-- Forzamos RLS incluso para el dueño de las tablas (defensa en profundidad).
alter table public.espacio          force row level security;
alter table public.espacio_miembro  force row level security;
alter table public.perfil           force row level security;
alter table public.cuenta           force row level security;
alter table public.categoria        force row level security;
alter table public.movimiento       force row level security;
alter table public.deuda            force row level security;
alter table public.pago             force row level security;

-- ----------------------------------------------------------------------------
-- Helper para crear una política idempotentemente (drop + create).
-- ----------------------------------------------------------------------------
create or replace function public._create_policy(
  p_name   text,
  p_table  regclass,
  p_cmd    text,         -- 'select' | 'insert' | 'update' | 'delete' | 'all'
  p_using  text,         -- expresión USING (null para insert)
  p_check  text          -- expresión WITH CHECK (null para select/delete)
)
returns void
language plpgsql
as $$
begin
  execute format('drop policy if exists %I on %s', p_name, p_table);
  execute format(
    'create policy %I on %s for %s to authenticated %s %s',
    p_name,
    p_table,
    p_cmd,
    case when p_using is not null then 'using (' || p_using || ')' else '' end,
    case when p_check is not null then 'with check (' || p_check || ')' else '' end
  );
end;
$$;

-- --- espacio ---------------------------------------------------------------
-- Visible si el usuario es miembro del propio espacio (id en el subselect).
-- INSERT: el usuario solo puede crear espacios de los que será dueño.
-- UPDATE: solo miembros (en MVP, el owner).
select public._create_policy(
  'espacio_select', 'public.espacio', 'select',
  'public.is_espacio_member(id)', null
);
select public._create_policy(
  'espacio_insert', 'public.espacio', 'insert',
  null, 'owner_user_id = auth.uid()'
);
select public._create_policy(
  'espacio_update', 'public.espacio', 'update',
  'public.is_espacio_member(id)', 'public.is_espacio_member(id)'
);

-- --- espacio_miembro -------------------------------------------------------
-- Visible si la fila es del propio usuario O del espacio donde es miembro.
-- INSERT: el usuario puede agregarse a sí mismo (autoalta del owner) o, siendo
-- ya miembro del espacio, agregar a otra persona (modo pareja).
-- UPDATE: misma regla.
select public._create_policy(
  'espacio_miembro_select', 'public.espacio_miembro', 'select',
  'user_id = auth.uid() or public.is_espacio_member(espacio_id)', null
);
select public._create_policy(
  'espacio_miembro_insert', 'public.espacio_miembro', 'insert',
  null, 'user_id = auth.uid() or public.is_espacio_member(espacio_id)'
);
select public._create_policy(
  'espacio_miembro_update', 'public.espacio_miembro', 'update',
  'user_id = auth.uid() or public.is_espacio_member(espacio_id)',
  'user_id = auth.uid() or public.is_espacio_member(espacio_id)'
);

-- --- perfil ----------------------------------------------------------------
-- Visible si es el propio perfil (id = auth.uid()) o si es miembro del espacio
-- (en modo pareja se ve el perfil de la pareja). INSERT/UPDATE: solo el propio.
select public._create_policy(
  'perfil_select', 'public.perfil', 'select',
  'id = auth.uid() or public.is_espacio_member(espacio_id)', null
);
select public._create_policy(
  'perfil_insert', 'public.perfil', 'insert',
  null, 'id = auth.uid() and public.is_espacio_member(espacio_id)'
);
select public._create_policy(
  'perfil_update', 'public.perfil', 'update',
  'id = auth.uid()', 'id = auth.uid()'
);

-- --- Tablas de dominio: misma política base por espacio_id -----------------
-- Macro: select/insert/update con la regla de pertenencia al espacio.
do $$
declare
  t text;
  tables text[] := array['cuenta', 'categoria', 'movimiento', 'deuda', 'pago'];
begin
  foreach t in array tables loop
    perform public._create_policy(
      t || '_select', ('public.' || t)::regclass, 'select',
      'public.is_espacio_member(espacio_id)', null
    );
    perform public._create_policy(
      t || '_insert', ('public.' || t)::regclass, 'insert',
      null, 'public.is_espacio_member(espacio_id)'
    );
    perform public._create_policy(
      t || '_update', ('public.' || t)::regclass, 'update',
      'public.is_espacio_member(espacio_id)', 'public.is_espacio_member(espacio_id)'
    );
  end loop;
end;
$$;

-- No se definen políticas de DELETE: el borrado en el flujo normal es un UPDATE
-- de `deleted_at` (soft delete), ya cubierto por las políticas de UPDATE.

-- ============================================================================
-- COMENTARIOS (documentación viva del esquema)
-- ============================================================================
comment on table public.espacio is 'Unidad de aislamiento de datos. Raíz del tenant; soporta modo pareja vía espacio_miembro.';
comment on table public.espacio_miembro is 'Pivot de membresía espacio<->usuario. Base de toda la RLS.';
comment on table public.perfil is 'Perfil del usuario. id = auth.uid() (1:1 con auth.users).';
comment on table public.cuenta is 'Cuentas de dinero (banco/efectivo).';
comment on table public.categoria is 'Categorías de ingreso/egreso.';
comment on table public.movimiento is 'Transacciones: ingreso, egreso o transferencia entre cuentas.';
comment on table public.deuda is 'Deudas en ambas direcciones (yo_debo / me_deben).';
comment on table public.pago is 'Abonos a una deuda. Puente Deuda<->Movimiento.';
comment on column public.movimiento.cuenta_destino_id is 'Solo para transferencias: cuenta que recibe.';
comment on column public.movimiento.pago_id is 'Puente débil hacia el abono de deuda (lo escribe Track B).';
comment on column public.pago.movimiento_id is 'Movimiento de caja asociado al abono, si lo hay.';
