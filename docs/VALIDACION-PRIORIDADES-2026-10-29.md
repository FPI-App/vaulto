# Prioridades del MVP1: integración, sincronización, cifrado y categorías

## Estado confirmado

Rama de trabajo: `integracion/mvp1-prioridades`, creada desde `fa02f12`.
El ancestro común con `origin/main` es `1273cc76b4d9501ed85db2c15f2dcea5657edb0f`.
La cadena previa contiene 38 commits de ambos tracks. No se creó `dev`.
La interfaz `packages/shared/src/domain/selectors.ts` no cambia.

| Issue | Implementación y evidencia ejecutada | Pendiente para cerrar |
|---|---|---|
| #23 | Cadena lineal revisada; revisión de estándares y especificación; cinco `Closes` de PR #19 sustituidos por `Refs` | Publicación, CI del SHA final e integración remota en `main` |
| #24 | Preflight remoto y protocolo revisados; despliegue transaccional preparado | Autorizar y aplicar SQL; probar RPC autenticada, concurrencia y replicación remotas |
| #25 | Anulación explícita, recibo idempotente y registro local cifrado; pruebas SQL y de reinicio del conector correctas | Rechazo, recuperación y operación posterior en dos development builds |
| #21 | Copia íntegra y cifrada verificada nativamente en Android, incluida reapertura tras terminar el proceso | iOS, cambio de cuenta nativo y envío exactamente una vez después de migrar |
| #6 | Endpoints accesibles desde Windows con TLS verificado y desde Android mediante pasarela QA loopback; emuladores y APK preparados | Autenticación sintética, convergencia offline, aislamiento y revocación entre dispositivos |
| #8 | Repositorio, formularios y consultas aislados por espacio; CRUD nativo Android y semillas idempotentes comprobados | Interacción de formularios con sesión y convergencia remota de dos dispositivos |

Ninguna de estas issues se da por cerrada únicamente por tener implementación en una rama.

## Correcciones de revisión

### Estándares

- **Importante:** movimientos y categorías podían consultar o modificar un ID sin exigir el espacio activo. Las consultas y mutaciones ahora lo exigen; la comprobación ocurre dentro de la transacción y las lecturas descartan resultados anteriores al cambio de espacio.
- **Importante:** sumar saldos decimales grandes mediante `Number` podía perder un centavo. Las cadenas canónicas se convierten a centavos con `BigInt` antes de comprobar el rango seguro; una regresión cubre `80000000000000.01`.
- **Pendiente conocido:** el script de lint de shared sigue siendo un `echo`; se conserva el seguimiento separado en #26. Su salida no se cuenta como análisis estático real.

### Especificación

- **Importante:** una réplica todavía vacía podía disparar onboarding de una cuenta existente. Ahora se espera el primer sync cuando no existe perfil local; un perfil ya descargado continúa disponible offline. Un perfil sin membresía vigente no se mueve silenciosamente a un espacio nuevo.
- **Importante:** el preanálisis del lote no impedía un PUT seguido de PATCH que cambiara de espacio una fila creada en ese mismo lote. La función vuelve a verificar el espacio antes de cada operación, bajo los locks del lote.
- **Importante:** una semilla tardía podía sobrescribir una categoría editada o revivir una eliminada. La intención `if_absent` se conserva en una tabla local y en reintentos; el servidor inserta sin sobrescribir. Una escritura ordinaria mantiene su semántica anterior.
- **Importante:** un cliente actualizado puede añadir esa anotación a un lote cuya aplicación anterior perdió la confirmación local. El servidor reconoce el recibo antiguo solo si los datos, operaciones y orden siguen idénticos al quitar `if_absent: true` de PUT de categorías. Devuelve `already_applied` sin repetir escrituras; cualquier otro cambio se rechaza. Tres regresiones SQL cubren este caso.

## Recuperación de abonos

El servidor rechaza íntegramente los sobrepagos. La app conserva el lote y registra su identidad y contenido en `vaulto_sync_recovery`, fuera de los streams y protegido por SQLCipher.

La acción «Revisar abono pendiente» informa importe y contraparte y pide confirmar la anulación del abono rechazado con su ajuste asociado. La petición queda persistida. La RPC `cancelar_lote_abono` solo admite el par pago PUT/deuda PATCH correspondiente y genera un recibo `cancelled`; un pago previamente aplicado permanece intacto. El cliente completa la transacción local solo después de validar el recibo. El registro local se conserva, incluso tras confirmar; no se borran archivos ni filas físicas.

## Migración de almacenamiento

La migración crea un archivo distinto con una llave aleatoria de 32 bytes guardada en SecureStore. Abre la fuente en solo lectura y comprueba que pertenece al usuario. Usa `sqlcipher_export` con la extensión PowerSync cargada y compara huellas de todas las estructuras y filas, incluidas tablas internas, cola, secuencias y rowids. Conserva los metadatos de SQLite y verifica integridad, reapertura con llave correcta y rechazo con otra llave.

Solo después publica el nombre de la copia en SecureStore. Un fallo conserva original y copia sin activar. Un archivo migrado ausente o una llave perdida bloquean la apertura y no recrean datos. La atribución confirmada del original permite que una segunda cuenta tenga su propio archivo.

**Confirmado:** el fixture Android conserva cuatro entradas CRUD y el mismo clientId tras exportar, cifrar y reiniciar el proceso. Evidencias: `sqlcipher-android-inicial.json` y `sqlcipher-android-reinicio.json` en `validaciones/2026-10-29/`.

**Confirmado:** el original retenido sigue en texto plano. Su conservación evita pérdida de datos; retirarlo exige una autorización posterior con ruta y comando exactos. No se ejecutó ningún borrado ni sustitución destructiva.

Referencia del comportamiento de exportación: [API oficial de SQLCipher](https://www.zetetic.net/sqlcipher/sqlcipher-api/#sqlcipher_export).

## Verificaciones ejecutadas

- 101 pruebas de app en 15 archivos; 79 pruebas shared en seis archivos, correctas.
- 11 pruebas existentes de infraestructura y una nueva del generador de despliegue, correctas.
- TypeScript de app/shared y ESLint de fuentes de app con cero advertencias, correctos.
- Exportación Android Hermes final: 2.102 módulos; salida aislada en `.cache/qa/export-prioridades-final-20261029`.
- 15 aserciones pgTAP nuevas correctas: ocho de recuperación/aislamiento y siete de semillas/compatibilidad. Se aplicaron las funciones 0013 y 0015 únicamente al PostgreSQL QA existente; no se presenta esa base como instalada hasta 0016.
- Fixture nativo Android de categorías: 15 semillas, segunda siembra sin cambios, alta/edición, rechazo de otro espacio, soft delete, consulta histórica y 18 entradas CRUD pendientes. Usa el repositorio real y SQLCipher/PowerSync nativos, sin conectarse a producción.
- PostgREST remoto rechaza `Accept-Profile: private` con HTTP 406 / PGRST106.

Las rutas `qa-storage`, `qa-categorias` y `qa-network` solo ejecutan sus fixtures en development builds y redirigen al login en producción. No están enlazadas en la navegación del producto. No exponen llaves ni sesiones.

## Entorno y límites

El preflight remoto encontró migraciones 0001–0005, RPC ausente, ocho tablas, cero inconsistencias en los conteos revisados y 32 concesiones DELETE/TRUNCATE entre los dos roles cliente. El manifiesto registra los hashes exactos del despliegue preparado.

La CLI necesita `NODE_USE_SYSTEM_CA=1` en el proceso para que sus procesos hijos confíen en los certificados del sistema. No se deshabilitó TLS ni se modificó la configuración global. La conexión directa de la sonda nativa falló; los errores TLS observados en servicios del emulador no prueban por sí solos su causa.

**Confirmado después:** la sonda nativa obtiene HTTP 200 de Supabase Auth y PowerSync mediante una pasarela QA limitada a 127.0.0.1, ADB reverse y HTTPS verificado en el host. No registra cabeceras ni datos. Metro también queda limitado a localhost con resolución IPv4 (`NODE_OPTIONS=--dns-result-order=ipv4first`). Las URLs loopback solo se pasan al proceso Metro; no cambian archivos `.env`, EAS ni producción. Esta evidencia de salud no demuestra autenticación ni convergencia. La revisión automática rechazó usar `--lan` por exposición del código a la red; la alternativa localhost funcionó.

La revisión automática rechazó recuperar claves administrativas con `projects api-keys --reveal`: la autorización previa de comprobar credenciales no autorizaba revelar secretos. No se recuperaron esas claves ni se intentó otra vía. La preparación de usuarios sintéticos autenticados requiere autorización específica o credenciales de prueba configuradas por el usuario en un archivo local ignorado; nunca por chat ni en el repositorio.

No se repitieron aún las 60 aserciones históricas ni las carreras SQL de la entrega anterior. Tampoco se han ejecutado el despliegue remoto, CI final, las pruebas E2E autenticadas ni iOS. Las evidencias de esta sesión no sustituyen esas verificaciones.

## Despliegue y suites completas (actualización del 29 de octubre)

Con autorización explícita del usuario para el comando y destino exactos:

- **Confirmado:** `node scripts/test-rls-local.mjs --apply-migrations` aplicó 0014–0016 solo en `vaulto-qa-pg-20261028/vaulto_qa`; seis suites y 75 aserciones pgTAP correctas, fixtures revertidos (`sql-qa-completa.json`).
- **Confirmado:** `node scripts/test-sync-concurrency.mjs` con dos conexiones simultáneas: 60+60 rechaza el sobrepago sin residuos y 40+60 deja el saldo correcto; ambos reintentos son idempotentes (`carreras-sql-qa.json`). No valida PowerSync ni dispositivos.
- **Confirmado:** el SQL con SHA-256 `8aa2f82a…115a` se aplicó en `pqxvttkyevbkfdhmcmxu` con código 0. El historial remoto es 0001–0016; `aplicar_lote_sync` y `cancelar_lote_abono` son ejecutables por `authenticated` y no por `anon`; no hay tablas `public` sin RLS ni concesiones DELETE/TRUNCATE a roles cliente (`despliegue-remoto.json`).
- **Supuesto:** los clientes anteriores a 0012 ya no pueden escribir directamente; falta comprobarlo con una sesión sintética.
- **Propuesto:** la publicación `powersync`, creada `FOR ALL TABLES` en 0003, envía también `auth`, `vault` y `private` al servicio PowerSync. `sync_rules.yaml` solo entrega tablas `public` filtradas por usuario y espacio. Restringir la publicación a las ocho tablas del dominio necesita una migración revisada y una autorización aparte.
- **Desconocido:** no se ha comprobado que las reglas desplegadas en PowerSync coincidan con `sync_rules.yaml`.
- iOS queda fuera del alcance por decisión del usuario; no se realizará validación Apple.
