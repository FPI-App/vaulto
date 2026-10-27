# Arquitectura de Vaulto

Documento corto y vinculante. Fija las decisiones de datos y sincronización que **toda** tabla y feature debe respetar desde el día 1. No es un brief de producto (eso vive en el repo `docs`); es el contrato técnico del esquema.

---

## 1. Campos transversales del esquema (obligatorios en TODAS las tablas)

Desde la primera migración, cada tabla de dominio incluye estos campos. No son opcionales, no son "para después":

| Campo | Tipo | Por qué |
|---|---|---|
| `id` | `uuid` | **Generado en el cliente** (no autoincremental). Indispensable para offline-first: la app crea registros sin internet y sin colisiones. |
| `updated_at` | `timestamptz` | Marca de última escritura. Base del LWW de fallback y de la detección de cambios para sync. |
| `deleted_at` | `timestamptz` nullable | **Soft delete.** Nunca se borran filas físicamente en el flujo normal: borrar es escribir `deleted_at`. Un DELETE físico no se puede sincronizar de forma fiable. |
| `espacio_id` | `uuid` NOT NULL | Identificador del espacio de datos y frontera de aislamiento. Solo la tabla raíz `espacio` carece de esta columna. |
| `currency` | `text` | Moneda del registro. Multimoneda-ready. **MVP fija `COP`.** |
| `country` | `text` | País de `espacio` y `perfil` (ISO, ej. `CO`). |

Todas las tablas tienen `created_at` (`timestamptz`) para auditoría. La pertenencia y la autorización se resuelven mediante `espacio_miembro`, no con un `user_id` suelto en cada tabla.

> **Regla dura:** una migración que cree una tabla de dominio sin estos campos no se mergea. Esto se revisa en cada PR.

### Por qué `espacio_id` es obligatorio
- Todo registro de dominio pertenece a un único espacio desde su creación. El espacio personal también usa `espacio` y `espacio_miembro`; no existe un caso de negocio para filas huérfanas.
- La misma frontera se aplica en PostgreSQL/RLS, PowerSync y las consultas SQLite locales.
- `currency` se conserva en entidades monetarias; el MVP opera en COP.

---

## 2. Estrategia de sincronización (PowerSync)

### Pila
- **Local:** SQLite cifrada con **SQLCipher**. Los datos en reposo en el dispositivo van cifrados (RLS protege el servidor, no el teléfono perdido — son garantías distintas).
- **Sync:** **PowerSync** sobre Supabase. PowerSync mantiene la réplica local sincronizada con Postgres y gestiona la conectividad intermitente.
- **Cola local:** las escrituras offline se encolan y se reenvían al recuperar conexión, con idempotencia y respeto al orden de dependencias (no se sincroniza un `movimiento` antes que su `cuenta`).

### Resolución de conflictos
No se aplica una sola estrategia ciega. Se elige por el dominio del dato:

1. **Merge por campo (field-level)** — donde el dominio lo justifique. Caso típico: el modo pareja, donde dos personas editan campos distintos del mismo registro compartido. Mezclar por campo evita que la edición de uno pise la del otro.
2. **LWW (last-write-wins) por `updated_at`** — **solo como fallback**, para campos donde un conflicto real es improbable o donde la última escritura es semánticamente correcta.

> **Advertencia consciente:** LWW depende del reloj del dispositivo. Relojes desfasados pueden hacer "ganar" a la escritura equivocada. Por eso LWW es fallback, no estrategia por defecto, y el merge por campo cubre el escenario peligroso (edición concurrente del modo pareja).

### Identidad e idempotencia
- **UUID en cliente** para todo `id`: sin esto, dos dispositivos offline generarían IDs en colisión.
- **Cola idempotente:** reenviar una operación no debe duplicar su efecto.
- **Orden de operaciones:** las dependencias de FK se respetan al drenar la cola.

---

## 3. Seguridad

- **RLS obligatorio** en todas las tablas de Supabase. Sin política = sin acceso. Las políticas se documentan en `supabase/policies/`.
- **RLS ≠ cifrado local.** RLS protege el servidor. El cifrado en reposo del dispositivo lo da SQLCipher. Ambos son necesarios; ninguno sustituye al otro.
- La llave de SQLCipher se deriva por usuario y se guarda en el secure storage del dispositivo (`expo-secure-store`), nunca en el repo ni en `.env` de producción.

---

## 4. Dónde vive cada cosa

- **Esquema del lado servidor:** `supabase/migrations/` (SQL) + `supabase/policies/` (RLS documentado).
- **Esquema del lado cliente (PowerSync):** `packages/shared/src/powersync/` — definición compartida del esquema de sincronización.
- **Tipos del esquema:** `packages/shared/src/types/` — generados con `pnpm db:types`.
- **Reglas de dominio puras** (cálculo de saldos, dirección de deuda, puente Pago↔Movimiento): `packages/shared/src/domain/` — testeable sin app ni red.
