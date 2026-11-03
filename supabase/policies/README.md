# Políticas RLS — modelo de aislamiento por espacio

Referencia legible de las políticas Row Level Security de Vaulto. Las políticas **reales** se aplican vía migraciones: 0008 limita membresías al propietario, 0010 restringe la propiedad del espacio y 0011 fija los permisos de tablas del Track B. Desde 0012, el trigger de lote exige el protocolo RPC para escribir las ocho tablas; 0013–0016 amplían recuperación y validaciones. Tener INSERT/UPDATE no habilita escrituras directas fuera del lote. La existencia del archivo en Git no prueba su aplicación remota.

## El pivot `espacio_miembro` es el corazón del modelo

El aislamiento de datos **no** se hace por `user_id` en cada tabla. Se hace por **espacio**: cada fila de dominio lleva `espacio_id`, y la pertenencia de un usuario a un espacio vive en la tabla pivot `espacio_miembro` (`espacio_id`, `user_id`, `rol`).

```
auth.users ──< espacio_miembro >── espacio ──< (cuenta, categoria, movimiento, deuda, pago, perfil)
```

Una fila es visible/editable para el usuario actual **si su `espacio_id` pertenece a un espacio donde es miembro vivo**:

```sql
espacio_id in (
  select espacio_id
  from espacio_miembro
  where user_id = auth.uid()
    and deleted_at is null
)
```

### Por qué un pivot y no `user_id` directo

- **Modo pareja sin migración.** Compartir un espacio con la pareja es *insertar una segunda fila en `espacio_miembro`*. No hay que tocar el esquema ni reescribir las reglas de sync: ambos usuarios resuelven el mismo `espacio_id` desde el día 1.
- **Una sola regla, auditable en un punto.** Toda la autorización pasa por la misma condición. En la migración se encapsula en la función `public.is_espacio_member(espacio_id)`, de modo que cada política es idéntica y no hay copia-pega divergente.
- **Aislamiento garantizado.** Nunca se exponen datos de otros espacios: si el `espacio_id` de la fila no está en los espacios del usuario, RLS la filtra.

### `is_espacio_member` es `SECURITY DEFINER`

La función helper se declara `security definer` con `search_path = public`. Esto evita la **recursión de RLS**: cuando una política de `cuenta` consulta `espacio_miembro`, no queremos disparar a su vez la RLS de `espacio_miembro` dentro de la evaluación. El `definer` corre la verificación de membresía con privilegios controlados y `stable`, sin reentrar en las políticas.

## Políticas por tabla

> No hay políticas de **DELETE**. El borrado en el flujo normal es un `UPDATE` de `deleted_at` (soft delete), cubierto por la política de `UPDATE`. Un DELETE físico no se sincroniza de forma fiable.

| Tabla | SELECT | INSERT (`with check`) | UPDATE |
|---|---|---|---|
| `espacio` | propietario **o** `is_espacio_member(id)` | `owner_user_id = auth.uid()` | propietario vigente, conservando `owner_user_id` |
| `espacio_miembro` | propio (`user_id = auth.uid()`) **o** miembro del espacio | owner del espacio | owner del espacio |
| `perfil` | propio (`id = auth.uid()`) **o** miembro del espacio | propio **y** miembro del espacio | solo propio |
| `cuenta` | miembro del espacio | miembro del espacio | miembro del espacio |
| `categoria` | miembro del espacio | miembro del espacio | miembro del espacio |
| `movimiento` | miembro del espacio | miembro del espacio | miembro del espacio |
| `deuda` | miembro del espacio | miembro del espacio | miembro del espacio |
| `pago` | miembro del espacio | miembro del espacio | miembro del espacio |

Notas sobre los casos especiales:

- **`espacio`** es la raíz y no tiene `espacio_id`. El propietario puede leerlo antes de crear su membresía, lo que permite el bootstrap de onboarding. INSERT y UPDATE exigen `owner_user_id = auth.uid()`; un miembro no puede apropiarse del espacio y no existe transferencia de propiedad en MVP1.
- **`espacio_miembro`** permite ver la fila propia y las de espacios compartidos. Solo el owner crea o edita membresías; así no se puede autoinscribir a un espacio conocido ni escalar el propio rol.
- **`perfil`** se ve a sí mismo siempre y, en modo pareja, también el perfil de la pareja (mismo espacio). Pero solo el dueño edita su perfil.

## Principios transversales

1. **RLS obligatorio en toda tabla.** Sin política = sin acceso (comportamiento correcto, no un bug). Se usa además `force row level security` para que ni el dueño de la tabla evada las políticas.
2. **Solo rol `authenticated`.** Las políticas se otorgan `to authenticated`; el rol anónimo no ve nada.
3. **Soft delete respetado.** Las filas con `deleted_at` no nulo siguen existiendo y RLS no las oculta por estar borradas; la app las filtra. Los índices sí son parciales sobre `deleted_at is null` por rendimiento.
4. **Coherencia con PowerSync.** Las reglas de sincronización (qué filas baja cada dispositivo) deben corresponderse con lo que RLS permite leer: filtrar por los `espacio_id` de los que el usuario es miembro.

## Coherencia con las reglas de sincronización de PowerSync

La configuración Cloud versionada es [powersync/sync-config.yaml](../../powersync/sync-config.yaml), con Sync Streams edition 3. El 2026-10-30 se consultó `powersync fetch config` sin publicar cambios ni conservar credenciales: sus reglas coinciden con ese archivo. La configuración local [sync_rules.yaml](../sync_rules.yaml) usa buckets legacy con el servicio fijado en Docker; no es una copia literal del despliegue Cloud y no debe presentarse como tal.

Ambas delimitan las filas de dominio por membresía activa. Cloud baja solo el perfil propio, mientras RLS permite también leer perfiles del mismo espacio: sync selecciona un subconjunto permitido, no una equivalencia literal de todas las políticas. La membresía revocada deja de autorizar el espacio; los tombstones de dominio se conservan para sincronizar soft delete.

La publicación Postgres actual incluye esquemas adicionales. Eso no significa que estén expuestos al dispositivo: las consultas Cloud seleccionan explícitamente las ocho tablas de dominio. Restringir la publicación es un endurecimiento propuesto y requiere migración revisada y autorización de despliegue; no se aplicó durante esta revisión.
