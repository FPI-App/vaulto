# Dominio puro de saldos y transferencias — issue #12

## Alcance confirmado

La implementación original de lmilo ya contiene cálculo de saldos, efecto bidireccional
de transferencias y validación/normalización de campos del movimiento. Se conserva su
API y su complejidad lineal. El dominio no importa React, red ni base de datos.

Esta entrega completa la revisión del dominio en `fix/issue-12-saldos`, partiendo de
`d450671`. No integra el resto de las ramas del MVP ni despliega infraestructura;
la integración global continúa en #23. Las validaciones nativas pertenecen a #6,
#7 y #10, no son un requisito de una función pura.

## Corrección y evidencia

Cada monto válido en numeric(14,2) cabe en un entero seguro de JavaScript, pero la suma
de muchos movimientos puede excederlo. Antes se devolvían saldos con pérdida silenciosa
de centavos. Ahora el cálculo individual, el cálculo por cuentas y la suma para KPIs
comprueban entradas y acumulaciones con `Number.isSafeInteger`; lanzan `RangeError`
antes de devolver un resultado inseguro. No limitan el acumulado al máximo de un único
numeric(14,2), porque un saldo calculado puede sumar varios importes válidos.

Se añadieron diez casos a los ocho originales de saldos:

- Desbordamiento positivo/negativo por 91 movimientos del monto máximo permitido.
- Rechazo de saldos iniciales inseguros, en cálculo individual y múltiple.
- Desbordamiento de ambas cuentas al transferir repetidamente.
- Conservación exacta del total en transferencias con centavos y sobregiro; ambos
  métodos coinciden sin modificar entradas congeladas.
- Acumulación segura de 90 montos máximos, positivos y negativos, conservando centavos.

Las siete regresiones de desbordamiento fallaron antes del cambio y pasaron después.
Las 16 pruebas existentes de movimiento siguen cubriendo cuenta/destino disponible,
destino distinto, categoría por tipo, normalización y resumen de transferencias.

## Verificaciones ejecutadas

Desde la raíz, con las dependencias ya instaladas:

```powershell
node node_modules/typescript/bin/tsc --noEmit -p packages/shared/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p app/tsconfig.json
node node_modules/eslint/bin/eslint.js --config app/eslint.config.js packages/shared/src/domain/saldo.ts packages/shared/src/domain/saldo.test.ts
```

Desde `packages/shared`:

```powershell
node ../../node_modules/vitest/vitest.mjs run
```

Desde `app`:

```powershell
node ../node_modules/vitest/vitest.mjs run
```

Resultado: 78 pruebas de shared (18 saldos y 16 movimiento incluidas), 61 de app,
tipos de ambos paquetes y ESLint de ambos archivos modificados correctos.
Las herramientas se ejecutaron directamente porque los shims pnpm de esta sesión
habían fallado en la revisión anterior. No se cambiaron dependencias ni lockfile.
El lint global ficticio de shared continúa como tarea independiente #26.

## Límites

Una acumulación intermedia fuera del rango seguro también se rechaza aunque movimientos
posteriores pudieran compensarla: no se continúa sumando después de perder precisión.
El dominio espera movimientos válidos normalizados, activos y filtrados por espacio
desde sus repositorios; esta entrega no sustituye RLS ni añade consultas al cálculo.
No se ejecutaron pruebas SQL, cambios de backend, builds ni pruebas en dispositivos.

El estado de publicación/integración del commit debe comprobarse en GitHub; este
informe por sí solo no acredita un push ni un merge.
