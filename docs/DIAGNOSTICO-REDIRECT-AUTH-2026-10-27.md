# Diagnóstico y corrección del redirect de autenticación

**Estado:** código local implementado y validado; el usuario confirmó la allowlist remota; prueba en dispositivo pendiente.
**Fecha:** 2026-10-27

## Confirmado

- El correo anterior redirigió a `http://localhost:3000`, que en Android apunta al propio teléfono y no a Vaulto.
- `app/app.json` registra el esquema `vaulto`; la URI nativa esperada es `vaulto://auth/callback`.
- El enlace compartido incluía credenciales de sesión. Se consideran expuestas y no se reproducen aquí.
- El usuario confirmó que agregó la URI nativa en **Authentication → URL Configuration → Redirect URLs**. La configuración de `supabase/config.toml` solo afecta al entorno local.

## Cambios locales

- Registro y restablecimiento de contraseña usan `Linking.createURL('auth/callback')` como destino.
- El cliente Auth usa PKCE y procesa el enlace inicial y los enlaces recibidos con la app abierta.
- El callback admite códigos PKCE, `token_hash` con `type=email|recovery` y el formato heredado de `access_token`/`refresh_token` en fragmento; solo acepta el esquema y la ruta de Vaulto.
- Se añadió pantalla de resultado de confirmación y flujo para establecer una nueva contraseña.
- El callback nunca imprime ni persiste manualmente la URL o sus tokens.

## Verificación local

- TypeScript: `tsc --noEmit -p app/tsconfig.json`, correcto.
- Vitest: 9 archivos, 45 pruebas pasadas.
- ESLint en los archivos modificados, sin errores.
- Estos resultados no prueban que Android abra el enlace ni que Auth remoto acepte la URI.

## Pendiente externo

1. Abrir la APK de desarrollo, registrar una cuenta de prueba nueva y abrir el enlace del correo en el mismo Android. Confirmar llegada a Vaulto y persistencia de sesión tras reiniciar.
2. Probar recuperación: solicitar enlace, abrirlo en Android, cambiar contraseña e iniciar sesión.
3. Cerrar todas las sesiones de la cuenta expuesta. En Vaulto, **Perfil → Cerrar sesión** usa el alcance global predeterminado; después, iniciar sesión de nuevo. Un access token ya emitido podría seguir válido hasta expirar. No compartir enlaces ni tokens.

## Límites relacionados

- La migración de instalaciones antiguas con `vaulto.sqlite` continúa bloqueada de forma segura: el archivo previo se conserva y no se abre con una llave nueva. No se implementa una exportación hasta validar un fixture real de PowerSync, incluido el estado de sync pendiente; copiar solo tablas de dominio podría perder la cola.
- La sincronización offline, RLS con usuarios reales y dos dispositivos requieren validación en Android con cuentas de prueba; las pruebas locales no sustituyen esa comprobación.
- No se modificó el panel remoto de Supabase ni se hizo push.
