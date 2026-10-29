-- Mantiene recibos auditables tambi?n para anulaciones expl?citas, sin borrar pagos.
alter table private.vaulto_sync_lote add column estado text not null default 'applied'
  check (estado in ('applied', 'cancelled'));

create or replace function public.aplicar_lote_sync(p_lote_id text, p_operaciones jsonb)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_user uuid := auth.uid();
  v_hash bytea;
  v_guardado bytea;
  v_estado text;
  v_count bigint;
  v_op jsonb;
  v_data jsonb;
  v_table text;
  v_id uuid;
  v_space uuid;
  v_old_space uuid;
  v_debt uuid;
  v_spaces uuid[] := '{}';
  v_debts uuid[] := '{}';
  v_columns text;
  v_updates text;
  v_invalid boolean;
  v_previous text;
begin
  if v_user is null then raise exception 'Se requiere autenticación' using errcode = '42501'; end if;
  if p_lote_id is null or p_lote_id !~ '^[A-Za-z0-9:._-]{1,200}$'
     or jsonb_typeof(p_operaciones) is distinct from 'array' then
    raise exception 'Lote inválido' using errcode = '22023';
  end if;
  if jsonb_array_length(p_operaciones) not between 1 and 1000
     or octet_length(p_operaciones::text) > 1048576 then
    raise exception 'Tamaño de lote inválido' using errcode = '22023';
  end if;
  v_hash := sha256(convert_to(p_operaciones::text, 'UTF8'));
  insert into private.vaulto_sync_lote(user_id, lote_id, contenido_hash)
    values (v_user, p_lote_id, v_hash) on conflict do nothing;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    select contenido_hash, estado into v_guardado, v_estado from private.vaulto_sync_lote
      where user_id = v_user and lote_id = p_lote_id;
    if v_guardado is distinct from v_hash then
      raise exception 'La identidad del lote ya tiene otro contenido' using errcode = '22023';
    end if;
    return jsonb_build_object('protocol', 1, 'status', case when v_estado = 'cancelled' then 'cancelled' else 'already_applied' end, 'batch_id', p_lote_id);
  end if;

  -- Reunir espacios antiguos/nuevos antes de tomar locks, en orden estable.
  -- Serializa incluso usuarios distintos que escriben en el mismo espacio.
  for v_op in select value from jsonb_array_elements(p_operaciones) loop
    v_table := v_op->>'table';
    if v_table is null or v_table not in ('espacio', 'espacio_miembro', 'perfil', 'cuenta', 'categoria', 'movimiento', 'deuda', 'pago')
       or v_op->>'op' is null or v_op->>'op' not in ('PUT', 'PATCH', 'DELETE')
       or v_op->>'id' is null then
      raise exception 'Operación no admitida' using errcode = '22023';
    end if;
    v_id := (v_op->>'id')::uuid;
    v_data := coalesce(v_op->'data', '{}'::jsonb) - 'id';
    if jsonb_typeof(v_data) is distinct from 'object' then
      raise exception 'Datos de operación inválidos' using errcode = '22023';
    end if;
    select exists (
      select 1 from jsonb_object_keys(v_data) k where not exists (
        select 1 from pg_attribute a where a.attrelid = ('public.' || v_table)::regclass
          and a.attname = k and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
      )
    ) into v_invalid;
    if v_invalid then raise exception 'Columna no admitida' using errcode = '22023'; end if;
    if v_table = 'espacio' then
      v_spaces := array_append(v_spaces, v_id);
    else
      execute format('select espacio_id from public.%I where id = $1', v_table) into v_old_space using v_id;
      v_space := (v_data->>'espacio_id')::uuid;
      if v_old_space is not null then v_spaces := array_append(v_spaces, v_old_space); end if;
      if v_space is not null then v_spaces := array_append(v_spaces, v_space); end if;
      if v_old_space is not null and v_space is not null and v_space <> v_old_space then
        raise exception 'No se permite mover registros entre espacios' using errcode = '23514';
      end if;
    end if;
    if v_table = 'deuda' then v_debts := array_append(v_debts, v_id); end if;
    if v_table = 'pago' then
      select deuda_id into v_debt from public.pago where id = v_id;
      if v_debt is not null then v_debts := array_append(v_debts, v_debt); end if;
      if v_data->>'deuda_id' is not null then v_debts := array_append(v_debts, (v_data->>'deuda_id')::uuid); end if;
    end if;
  end loop;
  for v_space in select distinct s from unnest(v_spaces) s order by s loop
    perform pg_advisory_xact_lock(hashtextextended('vaulto-sync:' || v_space::text, 0));
  end loop;
  v_previous := current_setting('vaulto.sync_protocol', true);
  perform set_config('vaulto.sync_protocol', '1', true);

  for v_op in select value from jsonb_array_elements(p_operaciones) loop
    v_table := v_op->>'table';
    v_id := (v_op->>'id')::uuid;
    v_data := coalesce(v_op->'data', '{}'::jsonb) - 'id';
    -- Revalidar bajo los locks: una operaci?n anterior pudo crear esta misma fila.
    if v_table <> 'espacio' then
      execute format('select espacio_id from public.%I where id = $1', v_table) into v_old_space using v_id;
      v_space := (v_data->>'espacio_id')::uuid;
      if v_old_space is not null and v_space is not null and v_space <> v_old_space then
        raise exception 'No se permite mover registros entre espacios' using errcode = '23514';
      end if;
    end if;
    if v_table = 'pago' then
      select deuda_id into v_debt from public.pago where id = v_id;
      if v_debt is not null then v_debts := array_append(v_debts, v_debt); end if;
    end if;
    if v_op->>'op' = 'DELETE' then
      execute format('update public.%I set deleted_at = now() where id = $1', v_table) using v_id;
    elsif v_op->>'op' = 'PUT' then
      v_data := v_data || jsonb_build_object('id', v_id);
      select string_agg(format('%I', k), ', ' order by k),
             string_agg(format('%I = excluded.%I', k, k), ', ' order by k)
        into v_columns, v_updates from jsonb_object_keys(v_data) k;
      execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1)
        on conflict (id) do update set %3$s', v_table, v_columns, v_updates) using v_data;
    else
      select string_agg(format('%1$I = (jsonb_populate_record(null::public.%2$I, $1)).%1$I', k, v_table), ', ' order by k)
        into v_updates from jsonb_object_keys(v_data) k;
      execute format('update public.%I set %s where id = $2', v_table, coalesce(v_updates, 'id = id')) using v_data, v_id;
    end if;
    get diagnostics v_count = row_count;
    if v_count <> 1 then raise exception 'La fila no está disponible para esta cuenta' using errcode = '42501'; end if;
    if v_table = 'pago' then
      select deuda_id into v_debt from public.pago where id = v_id;
      if v_debt is not null then v_debts := array_append(v_debts, v_debt); end if;
    end if;
  end loop;

  -- Validar el agregado tras aplicar el lote completo, antes de confirmar nada.
  if exists (
    select 1 from public.deuda d where d.id = any(v_debts)
      and (select coalesce(sum(p.monto), 0) from public.pago p
           where p.deuda_id = d.id and p.espacio_id = d.espacio_id and p.deleted_at is null) > d.monto_inicial
  ) then raise exception 'Los abonos superan el principal de la deuda' using errcode = '23514'; end if;
  update public.deuda d set
    saldo_pendiente = d.monto_inicial - (select coalesce(sum(p.monto), 0) from public.pago p
      where p.deuda_id = d.id and p.espacio_id = d.espacio_id and p.deleted_at is null),
    estado = case when d.monto_inicial = (select coalesce(sum(p.monto), 0) from public.pago p
      where p.deuda_id = d.id and p.espacio_id = d.espacio_id and p.deleted_at is null) then 'saldada' else 'activa' end
    where d.id = any(v_debts);
  perform set_config('vaulto.sync_protocol', coalesce(v_previous, ''), true);
  return jsonb_build_object('protocol', 1, 'status', 'applied', 'batch_id', p_lote_id);
end;
$$;
revoke all on function public.aplicar_lote_sync(text, jsonb) from public, anon;
grant execute on function public.aplicar_lote_sync(text, jsonb) to authenticated;

-- Anular un abono rechazado conserva un recibo. Nunca elimina un pago aplicado.
create function public.cancelar_lote_abono(p_lote_id text, p_operaciones jsonb)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_user uuid := auth.uid();
  v_pago jsonb;
  v_deuda jsonb;
  v_espacio uuid;
  v_hash bytea;
  v_guardado bytea;
  v_estado text;
begin
  if v_user is null then raise exception 'Se requiere autenticación' using errcode = '42501'; end if;
  if p_lote_id is null or p_lote_id !~ '^[A-Za-z0-9:._-]{1,200}$'
     or jsonb_typeof(p_operaciones) is distinct from 'array' then
    raise exception 'Lote inválido' using errcode = '22023';
  end if;
  if jsonb_array_length(p_operaciones) <> 2 or octet_length(p_operaciones::text) > 1048576 then
    raise exception 'Solo se admite anular una transacción de abono' using errcode = '22023';
  end if;
  select value into v_pago from jsonb_array_elements(p_operaciones)
    where value->>'table' = 'pago' and value->>'op' = 'PUT';
  select value into v_deuda from jsonb_array_elements(p_operaciones)
    where value->>'table' = 'deuda' and value->>'op' = 'PATCH';
  if v_pago is null or v_deuda is null
     or (v_pago->'data'->>'deuda_id') is distinct from (v_deuda->>'id') then
    raise exception 'El lote no corresponde a un abono' using errcode = '22023';
  end if;
  select espacio_id into v_espacio from public.deuda where id = (v_deuda->>'id')::uuid;
  if v_espacio is null or not public.is_espacio_member(v_espacio) then
    raise exception 'La deuda no está disponible' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('vaulto-sync:' || v_espacio::text, 0));
  v_hash := sha256(convert_to(p_operaciones::text, 'UTF8'));
  insert into private.vaulto_sync_lote(user_id, lote_id, contenido_hash, estado)
    values (v_user, p_lote_id, v_hash, 'cancelled') on conflict do nothing;
  select contenido_hash, estado into v_guardado, v_estado from private.vaulto_sync_lote
    where user_id = v_user and lote_id = p_lote_id;
  if v_guardado is distinct from v_hash then
    raise exception 'La identidad del lote ya tiene otro contenido' using errcode = '22023';
  end if;
  return jsonb_build_object('protocol', 1, 'batch_id', p_lote_id,
    'status', case when v_estado = 'cancelled' then 'cancelled' else 'already_applied' end);
end;
$$;
revoke all on function public.cancelar_lote_abono(text, jsonb) from public, anon;
grant execute on function public.cancelar_lote_abono(text, jsonb) to authenticated;

