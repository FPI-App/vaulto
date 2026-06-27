# Onboarding — Track B (edav)

**Dueño:** edav · Track B
**Tablas canónicas:** `perfil`, `espacio`, `espacio_miembro`.

Primer arranque tras registrarse: crear `espacio` (owner), su fila en `espacio_miembro`
(rol 'owner'), y completar `perfil` (`onboarding_completo` pasa a true al terminar).

Ruta fuera de la tab bar (`href: null`). El flujo decide a dónde enviar al usuario según
`perfil.onboarding_completo`.

## Reglas de la costura (no romper el spine)
- Importa tipos/esquema desde `@vaulto/shared`. No redefinas el `AppSchema`.
- `perfil.id = auth.uid()`. RLS: la fila es visible si su `espacio_id` pertenece al usuario
  (vía `espacio_miembro`). Ver el modelo de datos MVP1.
- UI on-brand vía `@/theme` + `@/components`. Voz cercana y serena (BRAND.md §5).
