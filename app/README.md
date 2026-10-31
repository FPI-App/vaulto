# @vaulto/app

App móvil de Vaulto: finanzas personales offline-first. Expo SDK 58 · Expo Router
(file-based) · React Native 0.88 · TypeScript 6 estricto · PowerSync 2 (SQLite cifrada con
SQLCipher) sobre Supabase.

> Tu vida financiera, en orden y a la vista.

## Requisitos

- Node 22.13+, 24.3+ o 26+; pnpm 9.12.0 (versión fijada por el monorepo).
- Para correr con módulos nativos (op-sqlite/SQLCipher, secure-store) necesitas un
  **development build**. **No funciona en Expo Go** por el adaptador nativo de SQLCipher.
- Después de actualizar el SDK, vuelve a generar e instalar el development build Android/iOS.
- Opcional: Supabase CLI para el entorno local.

## Puesta en marcha

```powershell
# 1. Instalar dependencias (desde la raíz del monorepo)
pnpm install --frozen-lockfile

# 2. Configurar variables de entorno de la app
Copy-Item app/.env.example app/.env
# Edita app/.env con EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# y EXPO_PUBLIC_POWERSYNC_URL. ANON_KEY sigue admitida como alternativa legacy.
# Son públicas por diseño; la seguridad la da RLS.

# 3. (Opcional) Supabase local
supabase start          # o: pnpm supabase:start
# db:migrate ejecuta supabase db reset; revisar destino y autorizar antes
pnpm db:types           # genera tipos en packages/shared

# 4. Levantar el bundler
pnpm --filter @vaulto/app start    # o desde la raíz: pnpm app:dev
```

### Development build (módulos nativos)

```bash
pnpm app:prebuild       # genera ios/ y android/
pnpm app:android        # o: pnpm app:ios
```

## Estructura del spine

```
app/
├─ index.ts                 entry de expo-router
├─ app.json                 config Expo (scheme vaulto, plugins y rutas tipadas)
├─ metro.config.js          monorepo-aware (watchFolders + nodeModulesPaths)
└─ src/
   ├─ app/                  árbol de rutas (expo-router, file-based)
   │  ├─ _layout.tsx        providers globales + guard de rutas protegidas
   │  ├─ (auth)/            público: login · register · reset (Supabase real)
   │  └─ (app)/             protegido (Tabs)
   │     ├─ index.tsx       dashboard / Inicio (consume DeudasSelectors)
   │     ├─ cuentas/        ── Track A · lmilo
   │     ├─ movimientos/    ── Track A · lmilo
   │     ├─ categorias/     ── Track A · lmilo
   │     ├─ deudas/         ── Track B · edav (implementa DeudasSelectors)
   │     ├─ onboarding/     ── Track B · edav
   │     └─ perfil/         ── Track B · edav
   ├─ lib/
   │  ├─ supabase.ts        cliente Supabase (SecureStore nativo + url-polyfill)
   │  ├─ powersync/         provider y aviso de recuperación
   │  ├─ sync/              base por usuario, conector RPC y recuperación de lotes
   │  ├─ db/                llaves, sesiones y migración legacy
   │  ├─ auth/              sesión y callback de autenticación
   │  ├─ deudas/            DeudasSelectorsProvider por espacio activo
   │  ├─ espacio/           espacio actual
   │  ├─ navigation/        ruta inicial
   │  └─ ui/                alertas de interfaz
   ├─ components/           Screen · Button · Field · Placeholder
   └─ theme/                tokens (desde BRAND.md) + ThemeProvider + useTheme
```

Los tipos del esquema, los modelos de dominio puros y el `AppSchema` de PowerSync se
**importan del paquete compartido `@vaulto/shared`** (`../packages/shared`). La app no
los redefine.

## Costura entre tracks (no romper)

- **Capa de datos** en `@vaulto/shared`: tipos, `AppSchema` y reglas de dominio. La app
  importa desde ahí; nunca redefine tipos ni el `AppSchema`.
- **Contrato `DeudasSelectors`** (en `@vaulto/shared`): el dashboard (Track A) lo consume vía
  `useDeudasSelectors()`. `DeudasSelectorsProvider` crea `SQLiteDeudasSelectors` con
  la base local y el espacio activo. La noop solo se usa mientras no hay espacio.
- La propiedad de carpetas y tablas se define en `docs/PLAN-MVP1.md`.

## Seguridad

- **RLS** en Supabase protege el servidor: cada fila es visible solo si su `espacio_id`
  pertenece al usuario (vía `espacio_miembro`).
- **SQLCipher** se exige al abrir bases nuevas con archivo y llave por usuario. La llave
  aleatoria se guarda en un servicio SecureStore separado al de la sesión. Si falta
  una llave o aparece una base antigua, se bloquea el arranque sin borrar información.
  La migración antigua y el cifrado efectivo deben validarse en un build nativo.
- RLS ≠ cifrado local: ambos son necesarios. Ver `../ARQUITECTURA.md`.

## Pruebas locales

`pnpm --filter @vaulto/app test` ejecuta validaciones y repositorios sobre SQLite
en memoria (`node:sqlite`); no usa credenciales ni modifica bases de usuario.
`pnpm --filter @vaulto/shared test` cubre el dominio puro. Estas pruebas no sustituyen
las de RLS, sincronización ni SQLCipher en Android/iOS.

`pnpm infra:check` (desde la raíz) valida `app/.env` y los probes remotos sin escribir datos.
El perfil APK development está en `eas.json`; la vinculación EAS e instalación requieren
una cuenta Expo y un development build, no Expo Go. Detalle en
`../docs/VALIDACION-SYNC-CIFRADO-2026-10-27.md`.

## Convenciones

- TypeScript estricto, comillas simples, sin punto y coma final.
- Dominio en español (`Movimiento`, `Deuda`, `Cuenta`); infraestructura en inglés.
- Color reservado para significado (estado, dinero, acción); siempre con icono y signo.
  Deuda en violeta, NO rojo. Ver `.github/branding/BRAND.md`.
- Glass sutil: solo tab bar, headers sticky, sheets y tarjeta de saldo. Fallback sólido
  sin blur para gama baja.
- Montos con `fontVariant: ['tabular-nums']` y formato COP (`$ 1.250.000`) vía `formatCOP`
  de `@vaulto/shared`.
