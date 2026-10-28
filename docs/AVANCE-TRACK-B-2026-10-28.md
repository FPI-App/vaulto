# Avance de issues de edav — 28 de octubre de 2026

## Confirmado

El Project `FPI-App/1` contiene 19 tarjetas: 7 Done, 8 In Progress y 4 Todo.
Las seis tarjetas abiertas de edav (#2, #6, #16, #17, #18 y #21) están In Progress.
Se conserva ese estado: una entrega local no demuestra los criterios nativos ni su integración.

| Issue | Avance de esta entrega | Pendiente para cerrar |
|---|---|---|
| #16 Deudas y abonos | Lecturas tolerantes a sobrepagos: saldo desconocido explícito, historial conservado, edición/abonos bloqueados en conflicto; errores de consulta visibles. | Resolución del conflicto, atomicidad remota e interacción Android. |
| #17 Selectores | Principal y pagos consultados en una sola sentencia SQLite; sin doble conteo por JOIN. El contrato existente no cambia y rechaza KPIs inconsistentes. | Validación integrada del dashboard en Android y sincronización real. |
| #18 Documentación | Arquitectura y tabla de políticas alineadas a propiedad, grants y campos reales. Estrategias de concurrencia propuestas distinguidas de las implementadas. | Revisión e integración de los cambios. |
| #6 Entorno y sync | Docker iniciado; PostgreSQL 15 de prueba independiente y pgTAP instalados. Runner de RLS con destino fijo, sin puertos y sin reset. | Autorizar aplicación SQL aislada, ejecutar pgTAP y después realizar pruebas de sync en dos dispositivos. |
| #21 SQLCipher | Sin cambio al mecanismo de apertura: las bases antiguas y llaves faltantes siguen bloqueando de forma segura. Criterios nativos detallados abajo. | Fixture nativo antiguo con cola pendiente y pruebas de exportación/reapertura sin perder metadatos. |
| #2 Épica | Avanza con las entregas anteriores. | Integrar y completar checkpoints de #6 y #21. |

## Validación ejecutada

- 52 pruebas de app, 10 archivos: correctas. Incluye conflictos de saldo y selectores sobre SQLite real en memoria.
- TypeScript de app: correcto; ESLint de fuentes: correcto.
- 10 pruebas de infraestructura y protección del runner: correctas. La prueba de seguridad del runner no ejecuta Docker ni SQL.
- Preflight real: `node scripts/test-rls-local.mjs --check`, correcto. Destino `vaulto-qa-pg-20261028/vaulto_qa`; ningún puerto publicado; pgTAP disponible; esquema todavía sin aplicar.
- No se ejecutó pgTAP, no se aplicaron migraciones locales/remotas y no se probaron dispositivos en esta entrega.

## RLS preparada para aprobación

Comando exacto desde la raíz:

```powershell
node scripts/test-rls-local.mjs --apply-migrations
```

Destino único: base `vaulto_qa` dentro del contenedor local `vaulto-qa-pg-20261028`.
No abre conexiones remotas ni lee `.env`. Aplica 0001–0011 en una transacción en una base vacía,
y ejecuta las tres suites pgTAP; sus fixtures se revierten con rollback. El bootstrap de Auth es
mínimo: no prueba el servidor Supabase Auth ni PostgREST.

Requiere confirmación porque las migraciones ejecutan DROP POLICY/DROP TRIGGER y las pruebas
contienen DELETE de datos sintéticos. No resetea ni elimina bases/contenedores/archivos.
Si encuentra tablas ajenas o una versión anterior, se detiene y conserva el destino.

0011 deja explícitos los grants de `espacio`, `espacio_miembro`, `perfil`, `deuda` y `pago`;
evita depender de los privilegios por defecto de una instalación Supabase. No concede DELETE/TRUNCATE.

## Próxima validación nativa de #6 y #21

Usar cuentas y datos ficticios, no información financiera real:

1. En la APK de desarrollo, iniciar cuenta A, completar onboarding y crear deuda `QA-A` con principal 100.
2. Sin red: registrar abono 10, reiniciar y comprobar principal 100, historial 10 y saldo 90.
3. Cambiar a cuenta B: no debe ver datos, claves ni operaciones pendientes de A. Volver a A y comprobar persistencia.
4. En segundo dispositivo de A: reconectar y comprobar una sola copia del pago; propagar soft delete con datos de prueba.
5. Con otro espacio/usuario: comprobar que no descarga ni modifica `QA-A`.
6. Para SQLCipher, conservar una copia controlada de base de prueba + WAL/SHM + versión del build, sin compartir llaves ni credenciales.
   Verificar con tooling nativo que la clave correcta reabre y una clave equivocada falla sin modificar el original.
7. Preparar fixture antiguo con una transacción PowerSync pendiente. La migración solo puede habilitarse tras conservar
   tablas de dominio, metadatos, cola e IDs; reabrir con la misma cuenta y demostrar sincronización exactamente una vez.

**Desconocido:** exportación fiable de todas las estructuras internas de esa versión de PowerSync.
No se implementa una copia exclusiva de tablas de dominio ni se borran bases para simular éxito.
Los cambios de UI son JavaScript; no modifican módulos nativos ni sustituyen estas pruebas.
