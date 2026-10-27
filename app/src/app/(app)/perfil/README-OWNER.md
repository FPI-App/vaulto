# Perfil — Track B (edav)

**Dueño:** edav · Track B
**Tabla canónica:** `perfil`.

Datos del usuario y ajustes de la cuenta. Campos del MVP:
`id = auth.uid(), espacio_id, nombre, apellido, username (unique), foto_url?, descripcion?, ocupacion?, country='CO', onboarding_completo bool`
más los transversales aplicables.

La pantalla permite editar identidad, ocupación, descripción y foto por URL HTTPS
(incluida su eliminación del perfil). No incluye subida desde cámara o galería.
El formulario comprueba formato y colisiones de username entre los perfiles locales;
la unicidad entre todos los usuarios depende del constraint del servidor al sincronizar.
El registro inicial reutiliza el espacio local vigente y escribe perfil/membresía/espacio
atómicamente, sin crear otro espacio en un reintento del mismo dispositivo.

## Reglas de la costura (no romper el spine)
- Importa tipos/esquema desde `@vaulto/shared`. No redefinas el `AppSchema`.
- El cierre de sesión usa `useAuth().signOut()` (ya disponible en el spine).
- `username` único: validar contra colisiones (la unicidad real la garantiza el constraint en DB).
- UI on-brand vía `@/theme` + `@/components`.
