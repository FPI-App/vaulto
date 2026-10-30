# Validación de Integración PR #31 y PR #32 — QA Antigravity

Fecha: 2026-10-30  
Rama: `feature/qa-tests`  
Base integrada: DEV SHA `2447e78` (integra `main` `ae93ace`, PR #31 `21325ba` y PR #32 `7d43de4`)  
Archivo de pruebas: `app/src/features/deudas/data/calcularTotalesDeudas.test.ts` (63 líneas)

---

## 1. Resumen Ejecutivo

Se validó de manera independiente la integración entre el rediseño visual de la interfaz (PR #31) y las mejoras de navegación, métricas y perfil demo del MVP1 (PR #32), junto con las correcciones implementadas por DEV en `d7ae53f`, `ecc41ce` y `2447e78`.

Se implementó una suite de pruebas focalizada y significativa en `app/src/features/deudas/data/calcularTotalesDeudas.test.ts` que verifica la eliminación de la deriva por coma flotante en el cálculo de totales de deudas mediante `sumarANumero` a nivel de centavos exactos, así como la correcta segregación por dirección y exclusión de estados no activos o en conflicto.

---

## 2. Regresión Monetaria: `calcularTotalesDeudas`

### Reproducción y Verificación del Bug
- **Comportamiento anterior (coma flotante en `DeudasScreen.tsx`)**:
  Al sumar montos como `'0.01' + '2.01' + '0.48'`, la acumulación binaria con `Number()` producía `2.4999999999999996`. Al formatear con `formatCOP()` para la moneda `COP` (sin decimales visibles), el truncamiento / redondeo mostraba `$ 2`.
- **Comportamiento corregido (`calcularTotalesDeudas.ts` con `sumarANumero`)**:
  La acumulación se realiza a nivel de centavos enteros (`1 + 201 + 48 = 250 centavos` = `2.50`), devolviendo el valor numérico exacto `2.5`. Al formatear con `formatCOP(2.5)`, se presenta correctamente `$ 3`.
- **Casos cubiertos en la suite (`calcularTotalesDeudas.test.ts`)**:
  1. *Precisión monetaria*: Verifica que `'0.01' + '2.01' + '0.48'` acumule `2.5` (`formatCOP` produce `$ 3`) y no la deriva flotante `2.4999999999999996`.
  2. *Segregación por dirección*: Valida la correcta separación independiente de saldos para `me_deben` y `yo_debo`.
  3. *Filtrado de estados*: Excluye estrictamente deudas en estado `saldada` y deudas en estado `conflicto` o con `saldo_pendiente === null`.
  4. *Lista vacía*: Retorna `{ me_deben: 0, yo_debo: 0 }`.
- **Independencia del filtro visual**:
  En `DeudasScreen.tsx`, el `useMemo` invoca `calcularTotalesDeudas(todas)` sobre el conjunto completo de deudas sin importar el filtro activo de la pestaña (`todas`, `yo_debo` o `me_deben`), garantizando que las tarjetas de resumen superior reflejen siempre la totalidad de las obligaciones activas.

---

## 3. Revisión Estática de Componentes Integrados

### Almacenamiento Web (`app/src/lib/sync/db.web.ts`)
- **Confirmado**: Se revisó el guard de seguridad en `openUserDatabase`:
  ```ts
  if (!__DEV__) {
    throw new StorageError('unsupported-cipher', 'La versión web no cifra los datos locales y solo está disponible en desarrollo. Usa la app móvil para tus datos reales.')
  }
  ```
- Impide que una compilación de producción para la web utilice almacenamiento en texto plano sobre IndexedDB, restringiendo el uso del conector web a entornos de desarrollo local.

### Estructura de Navegación y Layout (`app/src/app/(app)/_layout.tsx`)
- **Confirmado**:
  - Se conserva la barra de navegación personalizada `TabBar` con acabado translúcido (vidrio) del rediseño (PR #31).
  - Las pantallas `cuentas` y `categorias` se declaran dentro de `Tabs.Protected` sin la propiedad `href: null` (evitando redirecciones espurias hacia Inicio en web y permitiendo la navegación directa desde `Movimientos`).
  - Se mantiene la suscripción de `useDashboard` ligada a `lastSyncedAt` de PowerSync (PR #32) para refrescar los KPIs de deudas ante cada ciclo de sincronización.
  - El perfil de compilación `preview` en `app/eas.json` se encuentra disponible para la generación del APK de demostración.

---

## 4. Resultados de Verificación Ejecutada

| Comando | Resultado | Notas |
| :--- | :--- | :--- |
| `pnpm install --frozen-lockfile` | **Exit 0** | Lockfile íntegro, resolución sin cambios. |
| `pnpm test` | **Exit 0** | **197/197 pruebas pasadas** (79 en `packages/shared`, 118 en `app` distribuidas en 17 suites). |
| `pnpm typecheck` | **Exit 0** | TypeScript estricto superado sin errores en ambos paquetes. |
| `pnpm lint` | **Exit 0** | ESLint 9 en `packages/shared` y `expo lint` en `app` limpios. |
| *Export Android Hermes (DEV)* | *Exit 0* | Ejecutado y reportado por DEV (2.179 módulos empaquetados). No re-ejecutado en QA por ausencia de cambios en código nativo o de producción. |

---

## 5. Delimitación de Hallazgos y Estado de Verificación

- **Confirmado**:
  - `calcularTotalesDeudas` resuelve la inconsistencia monetaria y mantiene aislamiento de deudas no activas.
  - La suite de pruebas de QA `calcularTotalesDeudas.test.ts` consta de 63 líneas y pasa al 100% en Vitest.
  - Calidad global del repositorio (`typecheck`, `test`, `lint`) pasa con éxito sobre la base integrada.
- **Supuesto**:
  - La directiva `!__DEV__` en Metro web impedirá efectivamente la inicialización de IndexedDB en cualquier bundle de producción servido estáticamente.
- **Desconocido**:
  - Comportamiento en runtime de `expo-blur` y `expo-linear-gradient` en dispositivos Android con versiones antiguas del OS o sin aceleración por hardware.
- **Propuesto / Pendiente**:
  - Recompilar el APK standalone (development build nativo) para validar visualmente la barra translúcida y gradientes en un dispositivo físico.
  - La validación E2E completa de sincronización bidireccional entre múltiples dispositivos permanece abierta (bloqueo nativo del Issue #25).
