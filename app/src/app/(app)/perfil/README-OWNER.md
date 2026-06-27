# Perfil — Track B (edav)

**Dueño:** edav · Track B
**Tabla canónica:** `perfil`.

Datos del usuario y ajustes de la cuenta. Campos del MVP:
`id = auth.uid(), espacio_id, nombre, apellido, username (unique), foto_url?, descripcion?, ocupacion?, country='CO', onboarding_completo bool`
más los transversales aplicables.

## Reglas de la costura (no romper el spine)
- Importa tipos/esquema desde `@vaulto/shared`. No redefinas el `AppSchema`.
- El cierre de sesión usa `useAuth().signOut()` (ya disponible en el spine).
- `username` único: validar contra colisiones (la unicidad real la garantiza el constraint en DB).
- UI on-brand vía `@/theme` + `@/components`.
