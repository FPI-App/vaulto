---
estado: activo
owner: edav
creado: 2026-06-26
actualizado: 2026-10-30
issue: FPI-App/vaulto — Track A (#A) · Track B (#B)
implementa: edav + lmilo
---

# Vaulto — MVP1

> **Resumen.** Construir el núcleo entregable de Vaulto: registrar movimientos (ingreso/egreso/transferencia) y deudas bidireccionales, verlos unificados en un dashboard de 4 KPIs, todo offline-first. El trabajo se reparte en **dos tracks independientes** que no comparten archivos ni se esperan mutuamente. **lmilo** construye el núcleo de movimiento (cuentas, movimientos, categorías, dashboard). **edav** construye identidad + deudas y es dueño de la INFRAESTRUCTURA (Supabase + PowerSync + keys), que es su primer workstream para poner el spine LIVE. La única costura entre ambos es la interfaz `DeudasSelectors` en `packages/shared`.

---

## Estado contrastado — 2026-10-30

Las listas siguientes conservan el alcance original; una casilla histórica sin marcar no prueba ausencia de código ni valida por sí sola una entrega.

| Estado | Evidencia y límite |
|---|---|
| Confirmado | Migraciones 0001–0016 remotas, RLS en las ocho tablas de dominio, guard de lotes y permisos RPC: `validaciones/2026-10-30/`. |
| Confirmado | Selectores SQLite activos, montos decimales y protocolo de aplicación/anulación idempotente implementados. |
| Confirmado | Recorridos Android históricos, aislamiento y conflictos: `validaciones/2026-10-29/`. No constituyen una prueba del APK con el rediseño posterior. |
| Pendiente | #25: anulación pendiente con cambio de cuenta, respuesta perdida y reactivación nativa tras reconexión. #21: replay remoto del outbox migrado tras reinicio. |
| Confirmado | #24: cliente anterior rechazado por guard (23514, cero filas), replay HTTP tras respuesta perdida con una sola fila y un recibo por lote; Cloud coincide por SHA-256 con `powersync/sync-config.yaml`. `supabase/sync_rules.yaml` sigue siendo configuración legacy local. |
| Propuesto | Reducir publicación Postgres a tablas de dominio; requiere migración revisada y autorización de despliegue. Merge por campo/LWW no están implementados. |

Los cambios compartidos se entregan en PR pequeño para revisión de ambos tracks; no se ha enviado un aviso externo a lmilo en esta ejecución.

## Cómo usar este plan

Este plan está escrito para ejecutarse con ayuda de agentes de IA. **Las decisiones técnicas las toma el plan, no el agente.** Tu trabajo: **ejecutar** las tareas, **verificar** cada una contra su lista *Hecho cuando*, y **escalar** las decisiones marcadas con 🛑.

La regla de oro de este plan es **no-colisión**: cada persona es dueña de un set cerrado de carpetas y tablas. Antes de tocar un archivo, confirma que está en TU mapa de ownership. Si necesitas tocar algo del otro track, no lo hagas: usa el contrato `DeudasSelectors` o escala.

El modelo de datos canónico (abajo) es **autoritativo**. Ambos tracks lo respetan al pie de la letra; así las migraciones de uno no rompen al otro.

---

## Principio de no-colisión — Mapa de ownership

Cero archivos compartidos en código de feature. Cero espera mutua. Lo único compartido es `packages/shared` (spine ya hecho + el contrato).

### Carpetas (app)

| Carpeta | Dueño |
|---|---|
| `app/src/app/(app)/cuentas/` | **lmilo** (Track A) |
| `app/src/app/(app)/movimientos/` | **lmilo** (Track A) |
| `app/src/app/(app)/categorias/` | **lmilo** (Track A) |
| `app/src/app/(app)/index` (dashboard) | **lmilo** (Track A) |
| `app/src/features/cuentas/`, `features/movimientos/`, `features/categorias/`, `features/dashboard/` | **lmilo** (Track A) |
| `app/src/app/(app)/onboarding/` | **edav** (Track B) |
| `app/src/app/(app)/perfil/` | **edav** (Track B) |
| `app/src/app/(app)/deudas/` | **edav** (Track B) |
| `app/src/features/perfil/`, `features/deudas/` | **edav** (Track B) |
| `app/src/lib/`, `app/src/theme/`, `app/src/components/` (compartidos del spine) | **co-propiedad** — cambios solo por PR pequeño y avisado; no es zona de trabajo de feature |
| `supabase/` (infra, migraciones, RLS, conector PowerSync) | **edav** (Track B) |
| `packages/shared/src/domain/deudas`, `powersync` schema, impl de `DeudasSelectors` | **edav** (Track B) |
| `packages/shared/src/domain/selectors.ts` (la **interfaz**) | spine — ya hecho; nadie lo reescribe |

### Tablas

| Tabla | Dueño |
|---|---|
| `cuenta` | **lmilo** |
| `categoria` | **lmilo** |
| `movimiento` | **lmilo** |
| `espacio` | **edav** |
| `espacio_miembro` | **edav** |
| `perfil` | **edav** |
| `deuda` | **edav** |
| `pago` | **edav** |

> **Regla de migraciones:** cada quien crea sus migraciones en `supabase/migrations/` con prefijo de fecha/orden y nombre descriptivo. Como edav es dueño de la infra y aplica las migraciones, **edav crea primero las tablas raíz** (`espacio`, `espacio_miembro`) y la función helper de RLS; lmilo construye sus tablas sobre ese cimiento. lmilo puede trabajar con Supabase local (`supabase start`) sin esperar a que la infra remota esté lista.

---

## Modelo de datos canónico MVP1 (autoritativo)

**Campos transversales en TODAS las tablas:** `id uuid PRIMARY KEY default gen_random_uuid()` (generado en cliente), `espacio_id uuid` (salvo en `espacio`), `created_at timestamptz default now()`, `updated_at timestamptz default now()` (vía trigger), `deleted_at timestamptz null` (soft delete). `currency text default 'COP'` en entidades monetarias; `country text default 'CO'` en `espacio`/`perfil`.

| Tabla | Campos propios | Track |
|---|---|---|
| `espacio` | `nombre`, `owner_user_id` (→auth.users), `base_currency` default 'COP', `country` default 'CO' | **B** |
| `espacio_miembro` | `espacio_id`, `user_id` (→auth.users), `rol` default 'owner' | **B** |
| `perfil` | `id = auth.uid()`, `espacio_id`, `nombre`, `apellido`, `username` unique, `foto_url`?, `descripcion`?, `ocupacion`?, `country` default 'CO', `onboarding_completo` bool default false | **B** |
| `cuenta` | `nombre`, `tipo` ('banco'|'efectivo'), `banco`?, `saldo_inicial` numeric(14,2) default 0, `currency`, `archivada` bool default false | **A** |
| `categoria` | `nombre`, `tipo` ('ingreso'|'egreso'), `icono`?, `color`? | **A** |
| `movimiento` | `cuenta_id`→cuenta, `cuenta_destino_id`→cuenta? (solo transferencia), `categoria_id`→categoria?, `tipo` ('ingreso'|'egreso'|'transferencia'), `monto` numeric(14,2), `currency`, `fecha` timestamptz, `nota`?, `pago_id` uuid? | **A** |
| `deuda` | `direccion` ('yo_debo'|'me_deben'), `contraparte`, `monto_inicial` numeric(14,2), `saldo_pendiente` numeric(14,2), `currency`, `fecha_limite` date?, `prioridad` int default 0, `estado` ('activa'|'saldada') default 'activa', `nota`? | **B** |
| `pago` | `deuda_id`→deuda, `monto` numeric(14,2), `currency`, `fecha` timestamptz, `nota`?, `movimiento_id` uuid? | **B** |

**RLS (habilitar en todas):** una fila es visible/editable si su `espacio_id` está en `(select espacio_id from espacio_miembro where user_id = auth.uid() and deleted_at is null)`. Para `espacio`: `id` en ese subselect. Para `espacio_miembro`: `user_id = auth.uid()` O `espacio_id` en el subselect. Para `perfil`: `id = auth.uid()` O miembro del espacio. **Nunca exponer datos de otros espacios.**

> 💡 **Heurística.** El acoplamiento entre `movimiento.pago_id` y `pago.movimiento_id` es un puente bidireccional intencional (Deuda↔Movimiento). Ninguna tabla impone FK dura cruzada en MVP1 (`pago_id`/`movimiento_id` son `uuid` sueltos) para que los dos tracks puedan insertar sus filas sin orden forzado en la cola de sync. La integridad del puente la garantiza el dominio en `packages/shared`, no una FK.

---

## Fuera de alcance

> Si un agente sugiere construir algo de esta lista, **no lo hagas**.

- **Importación de SMS / extractos** → roadmap (vía extracto pegado, nunca `READ_SMS`).
- **Panel de administrador** → roadmap.
- **Multimoneda activa** → el esquema queda listo (`currency`/`country`), la UI sigue solo en COP.
- **Modo pareja activo** → el esquema queda listo (`espacio`/`espacio_miembro`), la feature no se construye en MVP1.
- **Movimientos recurrentes, modo quincena** → roadmap.
- **Sobres / presupuestos** → roadmap (el KPI "Disponible" = saldo total, definición fija decisión #10).

---

## El spine ya construido (punto de partida)

No se rehace. El plan parte de aquí:

- **Monorepo pnpm** (`app/`, `packages/shared/`, `supabase/`) con scripts (`app:dev`, `supabase:start`, `db:migrate`, `db:types`, `lint`, `typecheck`).
- **App shell** Expo + Expo Router (grupos `(auth)` y `(app)`/tabs, rutas protegidas) — estructura de carpetas creada.
- **Auth base** (cliente Supabase + correo/contraseña) — implementado en `app/src/lib/supabase.ts` y `app/src/lib/auth/`.
- **Esquema/migraciones** — dominio y protocolo versionados en migraciones 0001–0016; aplicación remota contrastada mediante lectura el 2026-10-30.
- **Tipos compartidos** — `packages/shared/src/types/` con `CamposTransversales` y el flujo `pnpm db:types`.
- **Theme** — tokens del brandbook (`app/src/theme/`).
- **Contrato `DeudasSelectors`** — la interfaz vive en `packages/shared` (ver Contrato de integración). El provider registra `SQLiteDeudasSelectors` desde `app/src/features/deudas/data/deudasSelectors.ts`; la noop se usa sin espacio activo.

> **Decisión canónica:** RLS por el pivot `espacio_miembro` y `espacio_id NOT NULL` en todas las tablas de dominio (salvo la raíz `espacio`). Los documentos principales ya están alineados; la migración `0008_restringe_membresias.sql` añade la autorización del owner para invitar y administrar membresías.

---

## Track A — lmilo · Núcleo de movimiento

> **Resumen.** Cuentas con saldo inicial, movimientos (ingreso/egreso/transferencia), categorías editables y el dashboard de 4 KPIs. Consume `DeudasSelectors` por la interfaz; el provider ya registra el adaptador SQLite, con noop solo sin espacio activo. No depende de la infra remota: desarrolla contra Supabase local.

**Tablas:** `cuenta`, `categoria`, `movimiento`.
**Carpetas:** `app/src/app/(app)/cuentas|movimientos|categorias`, dashboard index, y `app/src/features/{cuentas,movimientos,categorias,dashboard}`.

### Entregables

- [ ] **A.1** — Migración `cuenta` + RLS por `espacio_miembro` (sobre el cimiento de edav).
- [ ] **A.2** — Migración `categoria` + RLS. Seed mínimo de categorías por defecto (ingreso/egreso).
- [ ] **A.3** — Migración `movimiento` + RLS, con `cuenta_destino_id` para transferencia y `pago_id` suelto.
- [ ] **A.4** — Dominio puro en `packages/shared/src/domain`: cálculo de saldo de cuenta (`saldo_inicial` + Σ movimientos), efecto de transferencia (resta origen / suma destino), validación de tipo↔campos. **Testeable sin red.**
- [ ] **A.5** — Feature **Cuentas**: lista, crear/editar (nombre, tipo, banco, saldo_inicial, archivar), saldo calculado en vivo.
- [ ] **A.6** — Feature **Categorías**: CRUD con ícono/color, filtradas por tipo.
- [ ] **A.7** — Feature **Movimientos**: alta de ingreso/egreso/transferencia (selector de cuenta destino solo en transferencia), categoría, monto COP con `tabular-nums`, fecha, nota; lista con filtros.
- [ ] **A.8** — **Dashboard** (index de tabs): 4 KPIs. "Disponible" = saldo total de cuentas no archivadas (definición fija). Consume `DeudasSelectors.getTotalPorDireccion` y `getProximosVencimientos` **por la interfaz** (adaptador SQLite registrado).
  - **Porqué:** el dashboard NO importa nada de la carpeta de deudas. Solo conoce la interfaz. Así Track A se termina aunque Track B aún no exista.

✅ **Hecho cuando (Track A):**
- Crear una cuenta con saldo inicial y verla con su saldo correcto, offline.
- Registrar ingreso, egreso y transferencia entre dos cuentas propias; los saldos de ambas cuentas cambian correctamente, sin red.
- CRUD de categorías funciona y las categorías aparecen al crear un movimiento.
- El dashboard muestra los 4 KPIs; los KPIs de deuda muestran 0/[] con la impl noop y valores reales con la implementación registrada, **sin cambiar código del dashboard**.
- RLS probada: un segundo usuario en otro espacio no ve cuentas/movimientos/categorías ajenas.

🚦 **Checkpoint A.** Muestra a edav: las migraciones en `main`, el dashboard en el dispositivo con los selectores SQLite, y la prueba de aislamiento RLS.

---

## Track B — edav · Identidad, deudas e INFRAESTRUCTURA

> **Resumen.** PRIMERO la infra (pone el spine LIVE): proyecto Supabase, Auth email, migraciones aplicadas, PowerSync + conector, keys en `.env`. Luego onboarding/perfil, deudas bidireccionales con abonos, e implementación de `DeudasSelectors`. Mientras la infra no esté lista, lmilo no se bloquea (usa Supabase local).

**Tablas:** `espacio`, `espacio_miembro`, `perfil`, `deuda`, `pago`.
**Carpetas:** `supabase/` (infra), `app/src/app/(app)/onboarding|perfil|deudas`, `app/src/features/{perfil,deudas}`, impl de `DeudasSelectors` y `powersync` schema en `packages/shared`.

### B.0 — INFRA (primer workstream, va primero)

> Detalle accionable en **INFRA-SETUP.md**.

- [ ] **B.0.1** — Crear proyecto Supabase (org FPI-App), región cercana a CO.
- [ ] **B.0.2** — Habilitar Auth correo/contraseña + recuperación.
- [ ] **B.0.3** — Migración cimiento: `espacio`, `espacio_miembro`, función helper RLS (`is_espacio_member(espacio_id)`), trigger `updated_at`. Aplicar migraciones solo tras revisión de destino y autorización: `db:migrate` ejecuta reset local; el despliegue remoto se autoriza por separado.
- [ ] **B.0.4** — Crear instancia PowerSync, conectar al Postgres de Supabase, definir reglas de sync coherentes con RLS.
- [ ] **B.0.5** — Llenar `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_POWERSYNC_URL`) y compartirlo de forma segura (NO al repo).
- [ ] **B.0.6** — Verificar sync con 2 dispositivos.
- [ ] **B.0.7** — Alinear docs del spine al modelo canónico (ver 🛑 arriba).

🚦 **Checkpoint B.0.** Spine LIVE: lmilo puede apuntar su `.env` al Supabase remoto y sincronizar. **Avisa a lmilo** en cuanto las keys estén disponibles.

### Entregables de feature

- [ ] **B.1** — Migración `perfil` + RLS (`id = auth.uid()` o miembro del espacio).
- [ ] **B.2** — Migración `deuda` + RLS; migración `pago` + RLS.
- [ ] **B.3** — Dominio puro en `packages/shared/src/domain/deudas`: `saldoPendiente = monto_inicial - Σ pagos`, transición `estado` a 'saldada' cuando saldo llega a 0, dirección de deuda. **Testeable sin red.**
- [ ] **B.4** — Feature **Onboarding + Perfil**: al primer login sin `onboarding_completo`, crear `espacio` + `espacio_miembro` (rol owner) + `perfil`; pantalla de perfil editable (nombre, apellido, username único, foto, descripción, ocupación).
- [ ] **B.5** — Feature **Deudas**: lista bidireccional (yo_debo / me_deben), alta/edición, registrar **abono** (crea `pago`, recalcula `saldo_pendiente`, marca 'saldada'). Opcional MVP: abono que también crea un `movimiento` (puente vía `pago.movimiento_id`/`movimiento.pago_id`).
- [ ] **B.6** — **Implementar `DeudasSelectors`** en la app (contrato compartido en `packages/shared`, adaptador SQLite en `app/src/features/deudas/data/deudasSelectors.ts`): `getTotalPorDireccion` y `getProximosVencimientos`. Registrarla para que el dashboard de Track A la reciba en vez de la noop.
  - **Porqué:** esta es la única entrega de Track B que el dashboard de Track A consume. Cumplir el contrato exacto de la interfaz = cero cambios en el código de lmilo.

✅ **Hecho cuando (Track B):**
- Infra LIVE: keys en `.env`, sync verificado con 2 dispositivos editando el mismo espacio.
- Onboarding crea espacio + miembro + perfil; un usuario nuevo termina con `onboarding_completo = true`.
- Crear deuda en ambas direcciones; registrar abonos que reducen `saldo_pendiente`; una deuda llega a 'saldada' cuando el saldo es 0.
- `DeudasSelectors` real devuelve totales y vencimientos correctos; el dashboard de Track A los muestra sin tocar su código.
- RLS probada: otro espacio no ve deudas/pagos/perfil ajenos.

🚦 **Checkpoint B.** Muestra a lmilo: sync 2-dispositivos, el flujo de abono reduciendo saldo, y el dashboard de Track A mostrando KPIs reales de deuda con tu impl.

---

## Contrato de integración (la única costura)

Vive en `packages/shared` para que nadie espere a nadie:

El contrato vigente es [selectors.ts](../packages/shared/src/domain/selectors.ts). No se redefine aquí: `VencimientoResumen` usa `deuda_id`, `saldo_pendiente` decimal string, `currency` y `fecha_limite`; los totales se exponen como número tras sumar centavos de forma segura.

- **Track A (lmilo)** consume la interfaz mediante `useDeudasSelectors()`, sin importar la feature de deudas.
- **Track B (edav)** aporta `SQLiteDeudasSelectors` en la app. `DeudasSelectorsProvider` lo registra con la base y el espacio activo.
- La noop es la alternativa sin espacio activo, no el estado normal del dashboard autenticado.

---

## Orden sugerido

1. **edav · B.0 (infra)** en paralelo con **lmilo · A.1–A.4** (lmilo contra Supabase local). Ninguno espera al otro.
2. edav avisa keys (Checkpoint B.0) → lmilo apunta al remoto cuando quiera; no es bloqueante.
3. **lmilo · A.5–A.8** y **edav · B.1–B.5** en paralelo. Carpetas y tablas disjuntas.
4. **edav · B.6** (impl real de `DeudasSelectors`) en cuanto deudas+pagos funcionen.
5. **lmilo** verifica el dashboard con la impl real (sin cambiar código).
6. Checkpoints A y B con el otro como revisor.

---

## Definición de hecho (por feature)

Toda feature está "hecha" cuando, además de sus *Hecho cuando* específicos:
- Funciona **offline** (crear/editar sin red, sincroniza al volver).
- Respeta **soft delete** (borrar = escribir `deleted_at`).
- Tiene **RLS probada** con un segundo usuario en otro espacio (no ve datos ajenos).
- Montos en **COP con `tabular-nums`** (`$ 1.250.000`).
- `pnpm typecheck` y `pnpm lint` pasan; el dominio puro tiene tests.
- Migraciones en `supabase/migrations/` con nombre en español imperativo; RLS en la misma migración.
- No toca carpetas ni tablas del otro track.

---

## Decisiones

**Resueltas durante la planeación:**
- **RLS por pivot `espacio_miembro`** (no por `user_id` suelto) y `espacio_id` NOT NULL salvo `espacio`. Manda el modelo canónico de la reunión sobre el spine. *(2026-06-26.)*
- **Puente Deuda↔Movimiento sin FK dura** (`pago_id`/`movimiento_id` sueltos) para no forzar orden en la cola de sync. *(2026-06-26.)*
- **edav dueño de infra** como primer workstream; lmilo no se bloquea (Supabase local). *(2026-06-26.)*
- **Dashboard contra interfaz, no contra carpeta de deudas.** Costura única vía `DeudasSelectors`. *(2026-06-26.)*

**Abiertas (no bloquean el arranque):**
- 🛑 **Spike de sync per-field vs LWW** — confirmar estrategia con 2 dispositivos antes de congelar el esquema PowerSync. Pendiente: edav.
- 🛑 **Modelo de amenaza SQLCipher** — implementadas llave aleatoria por usuario y persistencia en SecureStore; pendiente cerrar evidencia de replay migrado (#21), sin borrar fuentes legacy.

## Riesgos

- **Colisión de migraciones** → dos PRs tocando `supabase/migrations` con prefijos chocados. **Mitigación:** edav crea el cimiento (`espacio`, `espacio_miembro`, helper RLS) primero; lmilo construye encima. Nombres con prefijo de orden único.
- **El dashboard se acopla a la carpeta de deudas** → rompe la independencia. **Mitigación:** el contrato vive en `packages/shared`; el lint/review rechaza imports de `features/deudas` desde el dashboard.
- **lmilo bloqueado esperando keys** → pierde días. **Mitigación:** desarrollo contra Supabase local desde el día 1; las keys remotas son opt-in.
- **Dos verdades de RLS** (spine vs canónico) → migraciones inconsistentes. **Mitigación:** B.0.7 alinea los docs antes de la primera migración.

## Referencias

- `docs/DECISIONES-EDAV.md` — decisiones de la reunión (canónicas).
- `vaulto/ARQUITECTURA.md` — contrato técnico del esquema (a alinear en B.0.7).
- `vaulto/docs/decisiones/0001-repo-mono.md` — por qué monorepo.
- `vaulto/supabase/README.md`, `supabase/policies/README.md` — convenciones de migraciones y RLS.
- `INFRA-SETUP.md` — checklist de infra para edav.
