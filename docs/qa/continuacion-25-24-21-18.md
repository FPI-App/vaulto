# Continuación de #25, #24, #21 y #18 — 2026-10-30

## Entrega local revisada

- #25: `app/src/lib/sync/reactivacionSubida.test.ts`, `app/package.json` y `pnpm-lock.yaml`. Cuatro casos ejercitan el bucle real de subida de shared-internals 1.4.0 con el conector y recovery store reales; red, cola y primera línea se simulan. No se demostró un fallo de producción y no se modificó el conector para corregir una hipótesis sin reproducción.
- #24: nuevas evidencias en `docs/validaciones/2026-10-30/`: migraciones0001–0016, RLS/guards/grants, esquema private no expuesto, estado PowerSync sin errores y hash de reglas remoto igual a `powersync/sync-config.yaml`. Consultas exclusivamente de lectura; sin despliegues ni SQL DML administrativo.
- #21: inventario y plan nativo en `preflight-25-24-21-2026-10-30.md`; ejecución nativa adicional aún en curso al redactar esta sección.
- #18: README raíz/app/Supabase, ARQUITECTURA, PLAN, INFRA-SETUP, DEMO, policies y plantilla raíz alineados con código. Se conserva el contrato real sin redefinirlo. Revisión DEV en `issue18-actualizacion.md`; hallazgos residuales corregidos por el coordinador: publishable key con compatibilidad legacy, llave SQLCipher aleatoria sin variable global, helper booleano correcto, paths y árboles reales.

## Comandos y resultados del coordinador

- `git merge --no-edit feature/dev-features` y `git merge --no-edit feature/qa-tests`: correctos. `git cherry-pick 10715a4`: incorpora solo revisión documental; no incorpora ediciones abandonadas ni su reversión.
- `pnpm install --frozen-lockfile`: correcto, lockfile sin nueva resolución.
- `pnpm typecheck`: app/shared correctos.
- `pnpm lint`: app/shared correctos con linter real.
- `pnpm test`: 201/201 (79 shared, 122 app), 24 archivos de prueba correctos.
- `git diff --check`: correcto; avisos de normalización CRLF no son fallos.
- PowerSync CLI0.10.3 `fetch config`/`status`: correctos; salida capturada en memoria y reducida a reglas/estado, sin registrar configuración de conexión ni credenciales. Comparación SHA-256 normalizando CRLF: igual. Réplica inicial completada, ocho tablas, sin errores.
- Supabase CLI `db query` mediante el ejecutable ya instalado: una consulta SELECT de metadatos, correcta; resultado en el JSON fechado. No se ejecutó reset, push ni migración.
- GET PostgREST con `Accept-Profile: private`: HTTP406/PGRST106, sin exposición del esquema. TLS verificado con almacén CA del sistema; no se deshabilitó validación.
- Búsqueda de enlaces locales Markdown en documentos revisados: sin destinos faltantes.

## NO verificado en esta entrega local

- La suite del SDK no acredita SQLite cifrado, transporte nativo ni sincronización real. Los resultados nativos se incorporarán desde la entrega QA, conservando lo que permanezca pendiente.
- No hay APK nuevo con expo-blur/linear-gradient ni validación del rediseño en el APK anterior. Exportar JavaScript no equivale a compilar/ejecutar ese APK.
- No se ha confirmado revisión compartida de lmilo, ni enviado mensajes externos en su nombre.
- No se aplicó la propuesta de restringir la publicación Postgres FOR ALL TABLES. Requiere cambio SQL revisado y autorización de despliegue.
- No se borraron archivos legacy ni datos de prueba; no se probará iOS, excluido por decisión previa del usuario.
- Los cierres de Issues conservan gates separados. Este informe no acredita cierre remoto ni publicación del árbol local.
