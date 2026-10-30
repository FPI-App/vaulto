# Diagnóstico de errores de Expo y Metro

**Estado:** Corrección local aplicada; falta confirmar el reintento en Android.
**Fecha:** 2026-10-27

## Errores y avisos observados

### Error de runtime: límite de actualizaciones excedido

Metro recibió `Maximum update depth exceeded` desde `BaseNavigationContainer` de Expo Router. El stack disponible no identificó una pantalla de la app, pero sí coincide con los dos efectos de guardia que despachan `router.replace()`:

- Guardia raíz: dirige entre `/(auth)/login` y `/(app)`.
- Guardia autenticada: dirige entre el dashboard y `/onboarding` según el estado del perfil.

Ambos efectos dependían de estado que puede volver a cambiar mientras la navegación procesa el primer redirect. Sin una marca de redirect pendiente, podían volver a enviar el mismo destino.

**Inferencia:** los redirects repetidos son la causa probable del ciclo; el stack no permite atribuirlo a uno solo de los dos guards.

### Avisos de permisos de caché

Expo no pudo escribir en la caché de DevTools bajo `C:\Users\Emman\AppData\Local\dotslash` ni en la caché de esquema bajo `C:\Users\Emman\.expo\schema-cache`. Usó el fallback de DevTools y Metro continuó. Es un problema de permisos del entorno Windows, no un fallo de la app; no se cambió configuración global ni se tocaron esas rutas.

El mensaje de incompatibilidad Expo Go SDK 56 proviene de un log anterior del 2026-10-26. El build que se está usando ahora es un development build con SDK 58, por lo que ese mensaje anterior no describe el build actual.

## Corrección aplicada

- Añadir una referencia `pendingRedirect` a cada guard para despachar una sola vez el mismo destino mientras la navegación está en curso.
- Restablecer la referencia cuando ya no se necesita redirigir.
- Retirar los logs repetidos del guard autenticado que ensuciaban la salida de Metro.

Archivos modificados: `app/src/app/_layout.tsx` y `app/src/app/(app)/_layout.tsx`.

## Verificación

- Typecheck de la app ejecutado después del cambio; resultado: código de salida 0.
- `git diff --check`: sin errores de whitespace.
- Se solicitó una recarga desde la terminal; no llegó un nuevo stack de error después de esa orden. Esto no confirma por sí solo el resultado en pantalla del Android.
- Pendiente: confirmar que el usuario puede navegar entre login, onboarding y dashboard sin volver a ver el error.

No se modificó la sesión del usuario, Supabase ni el túnel. No se copiaron credenciales a los logs ni a este informe.
