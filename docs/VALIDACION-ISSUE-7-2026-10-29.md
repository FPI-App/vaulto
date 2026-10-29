# Cuentas — issue #7

## Confirmado en código

La feature original de lmilo incluye migración de `cuenta`, RLS por membresía,
lista, formulario, edición, archivo y saldos calculados. Esta entrega parte de
`30712c6` y completa su aislamiento local y verificación automatizada.

- Crear cuenta valida espacio, nombre, tipo, moneda y saldo decimal dentro de
  numeric(14,2). Normaliza espacios, centavos y banco según el tipo.
- Editar, archivar/desarchivar y eliminar lógicamente exigen `espacio_id` y una
  cuenta activa. La comprobación y actualización ocurren en una transacción local.
- El detalle también filtra por espacio y no muestra filas de un resultado anterior
  al cambiar parámetros de la consulta reactiva.
- Una sola consulta obtiene cuentas y movimientos del mismo snapshot SQLite.
  Los movimientos de otros espacios y los eliminados quedan fuera; una transferencia
  que aparece dos veces en el JOIN se deduplica por su ID antes de calcular saldos.
- Los importes se calculan en centavos con el dominio de #12, sin SUM/REAL SQL.
- Archivar mantiene saldo e historial; Disponible excluye cuentas archivadas.
  Eliminar solo escribe `deleted_at`, no borra filas ni movimientos.
- Alta y acciones de edición tienen una protección inmediata contra doble envío.
  Los errores de persistencia no exponen detalles SQL en las alertas. La lista y
  el detalle distinguen errores de consulta de resultados vacíos.
- El formulario de detalle se reinicia al cambiar cuenta/espacio; las acciones
  pendientes se deshabilitan y exponen ese estado accesible.

## Verificaciones ejecutadas

17 pruebas nuevas de repositorio/lecturas con SQLite real en memoria, sin red:

- Alta y edición con centavos, UUID y moneda predeterminada.
- Normalización de efectivo y preservación del historial al editar el saldo inicial.
- Rechazo de montos inválidos, exceso de rango y espacio/nombre vacío.
- Rechazo de edición, archivo y eliminación sobre otro espacio o filas eliminadas.
- Archivo/desarchivo y Disponible; soft delete sin borrado del historial.
- Efecto de ingresos, egresos y transferencias sin doble conteo.
- Exclusión de movimientos eliminados o de otro espacio y de resultados reactivos anteriores.
- Conservación del efecto de transferencias en la cuenta activa si su contraparte fue eliminada.

Suite completa: **78 pruebas de app y 78 de shared correctas**.
TypeScript app/shared y ESLint de `app/src` correctos.
Se revisaron hooks, protección de eventos, claves de formulario y estados accesibles
con la checklist de `react-best-practices`.

Comandos de verificación desde la raíz:

```powershell
node node_modules/typescript/bin/tsc --noEmit -p app/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p packages/shared/tsconfig.json
```

Desde `app`:

```powershell
node ../node_modules/vitest/vitest.mjs run
node ../node_modules/eslint/bin/eslint.js src
node ../node_modules/expo/bin/cli export --platform android --output-dir .expo/issue-7-android-check
```

Desde `packages/shared`:

```powershell
node ../../node_modules/vitest/vitest.mjs run
```

El bundle Android compiló correctamente: 2.094 módulos. Su salida se conserva en
la carpeta ignorada indicada; no se publica ni se incluye en el commit.
No se cambiaron dependencias, lockfile, migraciones ni infraestructura compartida.

## Pendiente para cerrar #7

Esta evidencia no valida el driver nativo, SQLCipher, la cola PowerSync ni RLS remota.
No se ejecutaron pruebas SQL ni operaciones de base de datos remota. `adb` y `emulator`
no se resolvieron desde el PATH de esta sesión; no se realizó interacción nativa.

Con cuentas sintéticas en un development build:

1. Crear dos cuentas con saldo inicial y centavos; abrir/guardar sin editar y comprobar
   que el saldo inicial no cambia.
2. Sin red, registrar ingreso, egreso y transferencia; comprobar ambos saldos y el total.
3. Reiniciar la app todavía sin red; comprobar persistencia de cuentas y movimientos.
4. Archivar/desarchivar y confirmar que Disponible excluye solo las archivadas.
5. Cambiar de cuenta de usuario/espacio y confirmar que rutas anteriores no exponen datos.
6. Reconectar y verificar convergencia con el segundo dispositivo, sin duplicados ni
   pérdida de cola. Esta prueba depende del entorno/protocolo de #6 y #24.

La issue debe permanecer abierta hasta acreditar esos criterios; no se cierra solo
por CI o por compilar el bundle.

## Publicación

El usuario canceló crear `dev` y el merge solicitado inicialmente. La entrega queda
en `fix/issue-7-cuentas`. El commit, push y resultado de CI se registran en GitHub
cuando se comprueben; este informe no los presume realizados.
