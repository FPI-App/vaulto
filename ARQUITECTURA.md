# Arquitectura de Vaulto

Documento corto y vinculante. Fija las decisiones de datos y sincronización que **toda** tabla y feature debe respetar desde el día 1. No es un brief de producto (eso vive en el repo `docs`); es el contrato técnico del esquema.

---

## 1. Modelo canónico del esquema

La fuente canónica es `docs/PLAN-MVP1.md`. `id`, `created_at`, `updated_at` y `deleted_at` son transversales; los demás campos tienen el alcance indicado:

| Campo | Tipo | Por qué |
|---|---|---|
| `id` | `uuid` | **Generado en el cliente** (no autoincremental). Indispensable para offline-first: la app crea registros sin internet y sin colisiones. |
| `updated_at` | `timestamptz` | Marca de actualización del registro; el protocolo actual no compara relojes para resolver conflictos. |
| `deleted_at` | `timestamptz` nullable | **Soft delete.** Nunca se borran filas físicamente en el flujo normal: borrar es escribir `deleted_at`. Un DELETE físico no se puede sincronizar de forma fiable. |
| `espacio_id` | `uuid` NOT NULL | Identificador del espacio de datos y frontera de aislamiento. Solo la tabla raíz `espacio` carece de esta columna. |
| `currency` | `text` | Moneda de `cuenta`, `movimiento`, `deuda` y `pago`. **MVP fija `COP`.** En `espacio` se llama `base_currency`. |
| `country` | `text` | País de `espacio` y `perfil` (ISO, ej. `CO`). |

Todas las tablas tienen `created_at` (`timestamptz`) para auditoría. La pertenencia y la autorización se resuelven mediante `espacio_miembro`, no con un `user_id` suelto en cada tabla.

`perfil.id` es también FK a `auth.users.id`; las demás entidades usan UUID propio. El modelo prepara compartir espacios, pero el modo pareja activo está fuera del MVP.

### Por qué `espacio_id` es obligatorio
- Todo registro de dominio pertenece a un único espacio desde su creación. El espacio personal también usa `espacio` y `espacio_miembro`; no existe un caso de negocio para filas huérfanas.
- La misma frontera se aplica en PostgreSQL/RLS, PowerSync y las consultas SQLite locales.
- `currency` se conserva en entidades monetarias; el MVP opera en COP.

---

## 2. Estrategia de sincronización (PowerSync)

### Pila
- **Local:** las instalaciones nativas nuevas configuran SQLCipher con una llave y un archivo separados por usuario. El arranque exige soporte SQLCipher y migra el archivo legacy mediante `sqlcipher_export`, conservando el original. Las pruebas Android históricas están en `docs/validaciones/2026-10-29/`; sigue pendiente verificar el replay remoto del outbox tras migración y reinicio (#21).
- **Sync:** **PowerSync** sobre Supabase. PowerSync mantiene la réplica local sincronizada con Postgres y gestiona la conectividad intermitente.
- **Cola local:** el conector envía la transacción completa a `aplicar_lote_sync` (0012) y solo la completa al recibir confirmación de ese lote. El servidor aplica todas sus operaciones o revierte todo; registra una identidad persistente por usuario para reconocer reintentos. Requiere desplegar el protocolo coordinadamente con el cliente; sin la RPC la cola se conserva.

### Resolución de conflictos
Propuestas de diseño futuro, NO implementadas por el protocolo actual; modo pareja activo está fuera de MVP1:

1. **Merge por campo (field-level)** — donde el dominio lo justifique. Caso típico: el modo pareja, donde dos personas editan campos distintos del mismo registro compartido. Mezclar por campo evita que la edición de uno pise la del otro.
2. **LWW (last-write-wins) por `updated_at`** — **solo como fallback**, para campos donde un conflicto real es improbable o donde la última escritura es semánticamente correcta.

> **Advertencia consciente:** LWW depende del reloj del dispositivo. Relojes desfasados pueden hacer "ganar" a la escritura equivocada. Por eso LWW es fallback, no estrategia por defecto, y el merge por campo cubre el escenario peligroso (edición concurrente del modo pareja).

**Estado implementado en 0012–0016:** los lotes se serializan por espacio y el servidor recalcula los saldos de las deudas afectadas desde todos los pagos activos. Un lote que supera el principal se rechaza completo y conserva su cola local. PATCH envía campos modificados, pero no compara `updated_at`: no implementa LWW por reloj. Si los pagos locales superan el principal, Deudas conserva el historial, muestra conflicto y bloquea edición/abonos; los selectores rechazan el agregado. La recuperación registra localmente el lote bloqueado y permite solicitar su anulación con `cancelar_lote_abono` (0013). Hay evidencia histórica Android de conflicto y anulación; #25 mantiene pendientes cambio de cuenta con anulación solicitada, pérdida real de respuesta y diagnóstico nativo de reactivación al reconectar. Ver `docs/PROTOCOLO-SYNC-ATOMICO.md`.

### Identidad e idempotencia
- **UUID en cliente** para todo `id`: sin esto, dos dispositivos offline generarían IDs en colisión.
- **Cola idempotente:** reenviar una operación no debe duplicar su efecto.
- **Orden de operaciones:** las dependencias de FK se respetan al drenar la cola.

---

## 3. Seguridad

- **RLS obligatorio** en todas las tablas de Supabase. Sin política = sin acceso. Las políticas se documentan en `supabase/policies/`.
- `espacio` solo puede actualizarlo su propietario, conservando `owner_user_id` (0010). Solo el propietario administra membresías (0008). Los permisos de tabla se conceden explícitamente en 0007 (Track A) y 0011 (Track B); no se concede borrado físico ni TRUNCATE.
- **RLS ≠ cifrado local.** RLS protege el servidor. El cifrado en reposo del dispositivo lo da SQLCipher. Ambos son necesarios; ninguno sustituye al otro.
- La llave SQLCipher se genera con 32 bytes aleatorios y se persiste por usuario en `expo-secure-store`, con un servicio separado al de la sesión. No se reemplaza si ya existe una base y falta su llave. Los archivos antiguos se detectan y migran a un destino cifrado sin borrar el original. Si falta una llave existente, el arranque se bloquea y conserva los archivos. Ver `docs/VALIDACION-SYNC-CIFRADO-2026-10-27.md`.

---

## 4. Dónde vive cada cosa

- **Esquema del lado servidor:** `supabase/migrations/` (SQL) + `supabase/policies/` (RLS documentado).
- **Esquema del lado cliente (PowerSync):** `packages/shared/src/powersync/` — definición compartida del esquema de sincronización.
- **Tipos del esquema:** `packages/shared/src/types/index.ts` contiene los tipos de dominio actuales. `pnpm db:types` prepara la generación desde Supabase local; el archivo `database.ts` aún no está versionado y no se declara como verificado.
- **Reglas de dominio puras** (cálculo de saldos, dirección de deuda, puente Pago↔Movimiento): `packages/shared/src/domain/` — testeable sin app ni red.
