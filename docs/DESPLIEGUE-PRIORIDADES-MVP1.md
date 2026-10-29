# Despliegue coordinado del MVP1

## Destino y preparación

**Confirmado:** proyecto Supabase `Vaulto`, referencia `pqxvttkyevbkfdhmcmxu`; historial remoto 0001–0005. Consultar las evidencias fechadas en `validaciones/2026-10-29/` antes de actuar.

`node scripts/prepare-mvp1-deployment.mjs` solo genera `.cache/qa/deploy-mvp1.sql` y un manifiesto de hashes. No ejecuta SQL ni conecta a servidores. El SQL generado aplica 0006–0016 dentro de una única transacción y exige exactamente el historial inicial esperado. Un error o cambio de historial revierte la transacción. Un reintento después de un éxito se detiene por ese mismo guard, sin reaplicar migraciones.

El SHA-256 preparado es `8aa2f82a922a9717f89252d685442d97b5934447283fdaa7c110e2c27269115a`. Regenerar y revisar el manifiesto si cambia una fuente; una aprobación de este contenido no cubre otro hash.

## Sentencias DROP incluidas

Estas ocho operaciones eliminan restricciones/políticas/triggers que se reemplazan o se alinean con el modelo canónico. No eliminan tablas ni datos. Aun así, la regla global de autorización de SQL DROP exige confirmación explícita.

```sql
alter table public.movimiento
  drop constraint if exists movimiento_cuenta_id_fkey,
  drop constraint if exists movimiento_cuenta_destino_id_fkey,
  drop constraint if exists movimiento_categoria_id_fkey;
drop policy if exists espacio_miembro_insert on public.espacio_miembro;
drop policy if exists espacio_miembro_update on public.espacio_miembro;
drop trigger if exists validar_espacio_de_pago on public.pago;
drop policy if exists espacio_update on public.espacio;
alter table public.pago drop constraint if exists pago_movimiento_id_fkey;
```

## Comando remoto preparado, todavía no ejecutado

Ejecutar desde la raíz del repositorio, solo tras confirmar ese comando y destino:

```powershell
$env:NODE_USE_SYSTEM_CA = '1'
node 'C:\Users\Emman\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\supabase\dist\supabase.js' db query --linked --project-ref pqxvttkyevbkfdhmcmxu --file .cache/qa/deploy-mvp1.sql --output-format json
```

El runner debe capturar errores y emitir únicamente el estado/historial, sin imprimir tokens, respuestas con filas personales o cadenas de conexión.

## Verificación local que necesita autorización

Destino exclusivo: `vaulto-qa-pg-20261028/vaulto_qa`, contenedor PostgreSQL 15 con etiqueta QA y sin puertos publicados.

```powershell
node scripts/test-rls-local.mjs --apply-migrations
```

Este comando aplica 0014–0016, actualiza la marca de hashes y ejecuta todas las suites SQL en transacciones revertidas. Incluye el DROP de `pago_movimiento_id_fkey` mostrado arriba y una prueba que debe rechazar exactamente:

```sql
delete from public.cuenta where id = 'c0000000-0000-0000-0000-0000000000a1';
```

El DELETE pertenece únicamente al fixture sintético local; espera SQLSTATE 42501 y ROLLBACK. No se ejecuta en Supabase remoto.

## Secuencia operativa

1. Autorizar las operaciones exactas y preparar cuentas sintéticas confirmadas, conservando los datos de QA hasta una autorización de limpieza separada.
2. Completar las suites locales y revisar el SHA-256; comprobar el estado de PowerSync y que `private` sigue fuera de PostgREST/streams.
3. Publicar la integración, abrir PR contra `main` y comprobar CI del SHA final. Conservar los ancestros de ambos tracks; no crear `dev` ni usar force push.
4. Distribuir un development build con este conector; acordar el corte con quienes utilicen clientes antiguos. Desde 0012, las escrituras directas del rol authenticated fallan deliberadamente; los clientes necesitan la RPC nueva. No basta desplegar SQL y dejar clientes anteriores como si fueran compatibles.
5. Aplicar el SQL preparado y verificar 16 versiones, funciones, grants, RLS e idempotencia mediante sesiones sintéticas normales. Confirmar que PowerSync replica cambios y no incluye recibos privados.
6. Probar offline/reinicio/reconexión, soft delete, revocación, cambio de cuenta, 60+60 con recuperación y 40+60 saldada, usando dos dispositivos. Probar una operación posterior al rechazo; verificar conteos sin duplicados.
7. Completar validación iOS o registrar una decisión explícita de alcance antes de cerrar #21. Cerrar cada issue solo cuando sus criterios tengan evidencia.

## Recuperación ante fallos

Si falla el SQL dentro de la transacción, se revierte íntegramente. Si ya confirmó, no revertir ciegamente las protecciones: conservar datos y recibos, preparar una migración correctiva revisada y distribuir el cliente compatible. No ejecutar reset de Supabase, recreaciones, purgas, borrados de APK/datos ni rotaciones de llaves como recuperación automática.
