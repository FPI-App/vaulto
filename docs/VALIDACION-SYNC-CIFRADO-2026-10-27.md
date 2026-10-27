# Entorno remoto y cifrado — Track B

## Confirmado en código

- Rama `feat/edav-sync-cifrado`, desde `519ab79`.
- `pnpm infra:check` lee `app/.env` y las variables del proceso. Valida nombres,
  URLs y tipo de clave; consulta Supabase Auth y PowerSync liveness sin escribir datos.
  Nunca imprime claves, cabeceras, contenido de respuestas o errores de red completos.
- Solo admite una publishable o una anon legacy para Supabase; rechaza secret/service_role.
- La apertura nativa nueva usa un archivo separado por UUID de usuario y una llave
  aleatoria de 32 bytes persistida en SecureStore antes de crear la base.
- La llave usa un servicio de Keychain separado del de la sesión, con accesibilidad
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Cerrar sesión no elimina la llave ni el archivo.
- Los remontajes comparten una conexión; al cambiar de cuenta se cierra primero la
  anterior. El conector rechaza credenciales de una cuenta distinta a la propietaria.
- Los errores no registran tokens ni operaciones con datos personales. Un fallo de
  subida conserva la transacción en la cola para reintentar; DELETE se sube como soft delete.
- SQLCipher se configura tanto en el paquete app como en la raíz hoisted. En el build
  se exige `isSQLCipher()` y `PRAGMA cipher_version`; no hay fallback a una base sin cifrado.

## Conservación de archivos existentes

Si existe un archivo cifrado pero falta la llave, el arranque se bloquea sin generar
un reemplazo. También se bloquea cuando se detecta `vaulto.sqlite` antiguo y todavía
no existe la base específica del usuario. Ningún flujo elimina archivos ni limpia
la cola pendiente.

**Pendiente de #21:** implementar y validar la migración de las instalaciones antiguas.
El bloqueo anterior evita intentar abrirlas con una llave diferente o ignorarlas.
Las pruebas unitarias no demuestran cifrado real ni conservación de una cola PowerSync
durante una exportación; eso requiere un build nativo y datos de prueba controlados.

## Configurar #6

Completar `app/.env` (ignorado por Git):

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
EXPO_PUBLIC_POWERSYNC_URL=https://TU_INSTANCIA.powersync.journeyapps.com
```

Supabase: proyecto → Connect para URL/publishable; Settings → API Keys para una clave
específica. El nombre ANON_KEY se conserva por compatibilidad de la app.
PowerSync: instancia → Connect para URL; Client Auth → Use Supabase Auth.
La contraseña Postgres, secret/service_role y JWT signing secrets no van en el cliente.

`pnpm infra:check` devuelve código 1 si falta configuración o falla un probe. Un éxito
solo prueba disponibilidad HTTP; no demuestra RLS, migraciones ni sincronización.

## APK de desarrollo con EAS

El usuario confirmó que actualmente usa Expo Go y eligió EAS Build. Expo Go no incluye
los módulos nativos de esta app. `app/eas.json` prepara un perfil development con APK
de distribución interna. El usuario completó login en navegador y eligió `edav404s-team`.
Se creó y vinculó [Vaulto en EAS](https://expo.dev/accounts/edav404s-team/projects/vaulto)
con el ID real devuelto por la CLI, guardado en `app/app.json`.

Desde la raíz, iniciar sesión con `pnpm dlx eas-cli@26.0.0 login`. Desde `app/`, una vez
vinculado el proyecto: `pnpm dlx eas-cli@26.0.0 build --platform android --profile development`.
El inicio de sesión se completa en el navegador; no se comparten contraseñas/tokens por chat.

## Verificaciones locales realizadas

- 36 pruebas de la app, 62 de shared y 7 del diagnóstico: 105 pruebas pasadas.
- Typecheck del workspace y lint sin errores (una advertencia previa de igualdad).
- Dependencias Expo alineadas y exportación web correcta (1645 módulos).
- `build:inspect --stage archive` confirma app/shared incluidos y `.env`, documentos
  locales, `.aws`, `.codex` y caché de paquetes excluidos. Las reglas se versionan en
  `.easignore` de la raíz y de la app; no se añadieron archivos ignorados por la fuerza.
- Los scripts typecheck usan el compilador de la raíz para evitar shims de Windows
  que apuntaban a una copia TypeScript inexistente en los paquetes hoisted.

El chequeo de entorno aún rechaza los placeholders de `app/.env`. No se ejecutaron
pruebas reales de autenticación, RLS ni sincronización con servicios remotos.

## Verificación pendiente en dispositivo

1. Instalar el APK y abrir desde Metro con la configuración remota real.
2. Crear datos sin conexión, reiniciar y confirmar persistencia con la misma cuenta.
3. Cambiar a otra cuenta y comprobar que no se reutilizan filas ni cola de la anterior.
4. Volver a la primera cuenta; confirmar datos y cambios pendientes antes de reconectar.
5. Probar dos dispositivos, soft delete y aislamiento por espacio; validar RLS remoto.
6. Verificar que el archivo nuevo no se abre sin su llave y que no se recrea ante una
   llave ausente o errónea. No borrar archivos reales para simular este caso.

Fuentes: [PowerSync React Native](https://docs.powersync.com/client-sdks/reference/react-native-and-expo),
[SQLCipher](https://www.zetetic.net/sqlcipher/sqlcipher-api/),
[SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/),
[APK con EAS](https://docs.expo.dev/build-reference/apk/).
