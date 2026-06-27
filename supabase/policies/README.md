# Políticas RLS — modelo de aislamiento por espacio

Referencia legible de las políticas Row Level Security de Vaulto. Las políticas **reales** se aplican vía migración (`../migrations/0001_init.sql`); este documento explica el modelo y sirve para revisar coherencia con las reglas de sincronización de PowerSync.

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
| `espacio` | `is_espacio_member(id)` | `owner_user_id = auth.uid()` | miembro del espacio |
| `espacio_miembro` | propio (`user_id = auth.uid()`) **o** miembro del espacio | igual | igual |
| `perfil` | propio (`id = auth.uid()`) **o** miembro del espacio | propio **y** miembro del espacio | solo propio |
| `cuenta` | miembro del espacio | miembro del espacio | miembro del espacio |
| `categoria` | miembro del espacio | miembro del espacio | miembro del espacio |
| `movimiento` | miembro del espacio | miembro del espacio | miembro del espacio |
| `deuda` | miembro del espacio | miembro del espacio | miembro del espacio |
| `pago` | miembro del espacio | miembro del espacio | miembro del espacio |

Notas sobre los casos especiales:

- **`espacio`** es la raíz y no tiene `espacio_id`: la condición se aplica sobre su propia `id`. El INSERT exige que el creador sea el `owner_user_id` (no puedes crear un espacio a nombre de otro).
- **`espacio_miembro`** permite ver/editar la fila propia *o* las del espacio donde ya eres miembro. Así el owner puede agregar a su pareja (siendo miembro del espacio) y un invitado puede ver su propia membresía.
- **`perfil`** se ve a sí mismo siempre y, en modo pareja, también el perfil de la pareja (mismo espacio). Pero solo el dueño edita su perfil.

## Principios transversales

1. **RLS obligatorio en toda tabla.** Sin política = sin acceso (comportamiento correcto, no un bug). Se usa además `force row level security` para que ni el dueño de la tabla evada las políticas.
2. **Solo rol `authenticated`.** Las políticas se otorgan `to authenticated`; el rol anónimo no ve nada.
3. **Soft delete respetado.** Las filas con `deleted_at` no nulo siguen existiendo y RLS no las oculta por estar borradas; la app las filtra. Los índices sí son parciales sobre `deleted_at is null` por rendimiento.
4. **Coherencia con PowerSync.** Las reglas de sincronización (qué filas baja cada dispositivo) deben corresponderse con lo que RLS permite leer: filtrar por los `espacio_id` de los que el usuario es miembro.

## Coherencia con las reglas de sincronización de PowerSync

PowerSync define *sync rules* que deben replicar exactamente el alcance de la RLS. El parámetro natural del bucket es el conjunto de espacios del usuario:

```yaml
# Esbozo de sync rules (referencia; la definición real vive en la instancia de PowerSync)
bucket_definitions:
  espacios_del_usuario:
    parameters: >
      select espacio_id
      from espacio_miembro
      where user_id = request.user_id()
        and deleted_at is null
    data:
      - select * from espacio        where id         = bucket.espacio_id
      - select * from espacio_miembro where espacio_id = bucket.espacio_id
      - select * from perfil         where espacio_id = bucket.espacio_id
      - select * from cuenta         where espacio_id = bucket.espacio_id
      - select * from categoria      where espacio_id = bucket.espacio_id
      - select * from movimiento     where espacio_id = bucket.espacio_id
      - select * from deuda          where espacio_id = bucket.espacio_id
      - select * from pago           where espacio_id = bucket.espacio_id
```

Si la RLS y las sync rules divergen, un dispositivo podría intentar bajar filas que el servidor le niega (o viceversa). Mantenerlas alineadas es parte del contrato del esquema.
