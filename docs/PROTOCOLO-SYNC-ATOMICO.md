# Protocolo de sincronización atómica v1

Implementación de infraestructura de edav para #6, #16 y #17. La entrega original
`feat/edav-sync-atomico`, basada en `79cbb4c`, continúa en `integracion/mvp1-prioridades`.
Afecta el transporte compartido de las ocho tablas y requiere despliegue conjunto de backend/cliente.
El estado actualizado está en [VALIDACION-PRIORIDADES-2026-10-29.md](VALIDACION-PRIORIDADES-2026-10-29.md).

## Contrato

`public.aplicar_lote_sync(p_lote_id text, p_operaciones jsonb)` ejecuta con **SECURITY INVOKER**.
Cada operación tiene `table`, UUID `id`, `op` (PUT/PATCH/DELETE) y objeto `data`.
Solo admite las ocho tablas del MVP y sus columnas reales. Límite: 1000 operaciones y 1 MiB;
un lote excesivo se conserva pendiente, no se divide rompiendo su transacción.

La identidad es `PowerSync.getClientId():primerCrud.clientId:ultimoCrud.clientId`:
usa la identidad persistente de la base y los IDs locales de operaciones, no los UUID de filas.
Reabrir/reintentar conserva esa identidad. La migración de #21 debe conservar también esos metadatos.

Respuesta JSON: `protocol: 1`, `batch_id` idéntico al solicitado y `status: applied|already_applied`.
El cliente llama `complete()` únicamente si valida esos tres campos. Si pierde la respuesta o falla
la confirmación local, reenvía la misma identidad y contenido. Nunca vuelve a subidas fila por fila.

## Atomicidad, seguridad e idempotencia

- Una llamada RPC es una transacción PostgreSQL. Un error en cualquier operación revierte cambios y recibo.
- `private.vaulto_sync_lote` registra usuario, identidad y SHA-256 del JSON canónico del lote;
  reenviar contenido diferente con la misma identidad se rechaza. RLS limita recibos al usuario.
  No se guardan tokens ni una copia de los datos financieros en el recibo.
- `private` permanece fuera de los esquemas expuestos de PostgREST y de los streams del cliente.
  El recibo es metadato servidor, no una novena entidad de dominio. Su mantenimiento requiere
  preservar la idempotencia; no se incluye una purga automática ni un flujo de borrado de cuentas.
- Los identificadores SQL se limitan y se citan; valores pasan por parámetros y conversión al tipo de fila.
  Las políticas de SELECT/INSERT/UPDATE y grants continúan aplicándose al JWT autenticado.
- Cero filas escritas provoca rechazo del lote. No se permite mover una fila existente entre espacios.
- Los locks de transacción se toman por espacio en orden estable; las llamadas de miembros distintos
  del mismo espacio también se serializan. El saldo y estado final se recalculan sobre los pagos activos.
- Si la suma supera el principal, se rechaza el lote completo. La UI conserva historial y cola;
  la integración incorpora la anulación explícita mediante `cancelar_lote_abono` y un registro
  local persistente. El recibo `cancelled` confirma solo el par rechazado pago/deuda;
  un lote ya aplicado devuelve `already_applied` y conserva el pago. No se recorta el saldo a cero.
- Un trigger exige el protocolo a `authenticated`: clientes antiguos no pueden eludir las invariantes
  con escrituras directas. El rol SQL de administración conserva mantenimiento autorizado.

## Compatibilidad y despliegue pendiente

0012 ya se aplicó **solo al PostgreSQL local aislado**. El backend remoto no se modificó.
Antes de desplegar, revisar migraciones anteriores, permisos y esquema privado de ese destino.

La aplicación nueva requiere la RPC. Si todavía falta, muestra que el servicio necesita actualización
y conserva cambios offline. La aplicación antigua recibe rechazo de sus escrituras directas tras 0012.
Coordinar una ventana de actualización de clientes/backend; no revertir a un transporte parcial.
Las lecturas y archivos locales no se borran durante esta espera.

Los errores visibles se clasifican y sanitizan; no se muestran mensajes, filas ni detalles SQL del servidor.
La confirmación de PostgreSQL no prueba todavía PostgREST remoto, replicación PowerSync ni Android.

## Evidencia local

- 61 pruebas de app, 11 de infraestructura y 60 aserciones pgTAP: correctas.
  TypeScript de app y ESLint de fuentes: correctos. Las 12 migraciones están aplicadas solo en `vaulto_qa`.
- Suites pgTAP de RLS/integridad y RPC: validar con `node scripts/test-rls-local.mjs --test`.
- Concurrencia real: `node scripts/test-sync-concurrency.mjs` abre dos conexiones solapadas,
  con usuarios distintos del mismo espacio. 60+60 sobre principal 100 confirma un lote y revierte el otro;
  40+60 confirma ambos y deja saldo 0/saldada. Reenvíos no duplican pagos.
- El fixture ejecutado se conserva en `vaulto-qa-pg-20261028/vaulto_qa_race_1793219673560`.
  Todos los datos son sintéticos; ningún puerto está publicado y no se consultan servicios remotos.
- Las pruebas del conector cubren recibos, pérdida de confirmación local, servicio desactualizado,
  errores de permisos/validación/red y sanitización. Pruebas nativas pospuestas por el usuario.

Fuentes de API: [PowerSync getCrudTransactions](https://github.com/powersync-ja/powersync-js/blob/main/packages/shared-internals/src/client/BasePowerSyncDatabase.ts),
[PostgreSQL EXECUTE y ROW_COUNT](https://www.postgresql.org/docs/15/plpgsql-statements.html),
[cliente RPC de Supabase](https://github.com/supabase/supabase-js/blob/master/packages/core/postgrest-js/src/PostgrestClient.ts).
