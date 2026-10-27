# Inicio de Track B — edav

## Confirmado

- Se actualizaron referencias remotas el 26 de octubre de 2026.
- `origin/main` estaba en `1273cc7`; `origin/feat/cuentas` en `2bf2028`.
- Se integró `origin/feat/cuentas` en `main` local mediante fast-forward, sin conflictos: 14 commits, incluido el onboarding del que dependía Track A.
- Se creó `feat/edav-track-b` desde esa integración. No se hizo push ni merge remoto.
- Se conservaron los dos informes locales del 13 de octubre.
- Las 56 pruebas de dominio existentes pasaron sobre la integración.
- Typecheck pasó en app y shared. ESLint de la app terminó con cero errores y tres advertencias existentes (igualdad no estricta, constructor innecesario y uso de `require`). Se usaron los binarios locales porque pnpm no está en PATH.
- Deudas y Perfil siguen como placeholders. El provider de deudas entrega `noopDeudasSelectors` y su contexto usa `any`.
- El contrato real está en `packages/shared/src/domain/selectors.ts`; utiliza nombres snake_case. El ejemplo del plan no coincide exactamente: implementar contra el código existente.

## Verificación posterior de acceso y asignaciones

La PAT cifrada local autentica como `edav404`. Se verificó acceso de lectura a `FPI-App/vaulto`, al Project `Vaulto — MVP1` y a sus 18 tarjetas mediante la API. No se mostraron credenciales ni se modificaron recursos remotos.

Tareas abiertas asignadas a `edav404`: #6 (entorno y sync en dos dispositivos), #16 (deudas y abonos), #17 (dominio puro y selectores), #18 (documentación). Todas están en Todo. La épica #2 también está abierta y en Todo. #3, #4, #5, #13, #14 y #15 están cerradas y en Done.

El issue #14 incluye perfil editable, pero la pantalla local continúa como placeholder; el cierre del issue no verifica ese criterio. Las tareas de Track A #7, #8, #10, #11 y #12 siguen abiertas en el tablero aunque su implementación se integró localmente; no se actualizaron sus estados.

## Límites de la revisión inicial

No se pudo consultar el estado actual del Project ni las asignaciones de `edav404`: el conector GitHub devolvió que la herramienta no está disponible, el acceso web falló y no hay navegador conectado ni `gh` en PATH. Los informes del 13 de octubre son históricos y no prueban el estado actual del tablero.

No se aplicaron migraciones ni se comprobaron servicios remotos, RLS en ejecución, builds nativas o sync entre dispositivos.

## Propuesto: secuencia de trabajo de edav

1. Confirmar asignaciones y criterios actuales del Project. El plan local atribuye a edav infraestructura, identidad y deudas.
2. Revisar aislamiento por membresía, revocación en sync y ciclo de vida/cifrado de DB antes de validar infraestructura (#6 según el informe histórico).
3. Implementar dominio puro de deudas y abonos con pruebas, seguido de selectores reales sobre SQLite (#17 según el informe histórico). Conservar el contrato y las carpetas de Track A.
4. Implementar lista, alta/edición y abonos de deudas (#16 según el informe histórico).
5. Completar perfil editable y alinear documentación (#18 según el informe histórico).

La numeración y las asignaciones anteriores proceden de evidencia local; deben contrastarse con GitHub antes de actualizar tarjetas o declarar entregas terminadas.

## Implementación local de #17

En `feat/edav-track-b` se implementó el dominio puro `calcularSaldoPendiente` y `estadoDeudaDesdeSaldo`, con montos exactos en centavos y rechazo de montos negativos o sobrepagos. Se añadieron seis pruebas de dominio.

`SQLiteDeudasSelectors` implementa el contrato existente sobre PowerSync, limita cada consulta al espacio activo, excluye soft deletes y deudas saldadas, suma saldos en código con aritmética entera y ordena vencimientos por fecha/prioridad. El provider autenticado entrega la implementación real y ahora tipa el contexto como `DeudasSelectors`.

Verificación local: 62 pruebas pasan en shared; typecheck de shared y app pasa; ESLint sin errores en los archivos modificados; `git diff --check` limpio. No se actualizaron el issue ni el Project en GitHub. La confirmación visual del dashboard requiere ejecutar la app con datos locales/sync configurado.

## Trabajo posterior solicitado: #6, #16 y #18

- #16: lista y detalle de deudas, crear/editar, borrado lógico y abonos transaccionales. El saldo y el estado se derivan del principal y pagos activos; el sobrepago se rechaza. El puente opcional a movimientos sigue fuera de alcance.
- #18: ARQUITECTURA.md, supabase/README.md, supabase/policies/README.md y el plan ahora reflejan el pivot y `espacio_id NOT NULL` canónicos.
- Seguridad relacionada con #6: `0008_restringe_membresias.sql` limita invitaciones y cambios al owner; `sync_rules.yaml` excluye membresías revocadas. `0009_valida_integridad_deudas.sql` protege montos y referencias pago↔deuda/movimiento entre espacios. Hay pruebas pgTAP para estos cambios.
- Perfil: se reemplazó el placeholder por un formulario offline de datos editables y cierre de sesión.
- Verificación local: 62 pruebas de shared y typecheck de app/shared pasan. ESLint no tiene errores; persisten tres advertencias previas en otras áreas. `git diff --check` pasa.
- `expo export --platform web` compiló las rutas nuevas y generó el bundle web. No equivale a prueba en dispositivo ni a validar autenticación/sync real.
- Bloqueo de #6 confirmado: no hay archivos `app/.env` ni `supabase/powersync/.env`, Supabase CLI ni ADB; Docker está instalado pero su daemon no está corriendo. No se pueden aplicar migraciones ni probar sync entre dispositivos aún.
- `pnpm.cmd` rechazó instalar/ejecutar `pnpm@9.12.0` porque no pudo verificar la firma del paquete. Se usaron binarios locales y no se desactivó esa protección.
