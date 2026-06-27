# @vaulto/app

App móvil de Vaulto: finanzas personales offline-first. Expo SDK 56 · expo-router v4
(file-based) · React Native 0.85 · TypeScript estricto · PowerSync (SQLite cifrada con
SQLCipher) sobre Supabase.

> Tu vida financiera, en orden y a la vista.

## Requisitos

- Node >= 20, pnpm >= 9 (el repo es un monorepo pnpm).
- Para correr con módulos nativos (op-sqlite/SQLCipher, secure-store) necesitas un
  **development build**. **No funciona en Expo Go** por el adaptador nativo de SQLCipher.
- Opcional: Supabase CLI para el entorno local.

## Puesta en marcha

```bash
# 1. Instalar dependencias (desde la raíz del monorepo)
pnpm install

# 2. Configurar variables de entorno de la app
cp app/.env.example app/.env
# Edita app/.env con EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
# y EXPO_PUBLIC_POWERSYNC_URL. (Son públicas por diseño; la seguridad la da RLS.)

# 3. (Opcional) Supabase local
supabase start          # o: pnpm supabase:start
pnpm db:migrate         # aplica migraciones
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
├─ app.json                 config Expo (scheme vaulto, plugins, newArchEnabled)
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
   │  ├─ env.ts             lectura validada de EXPO_PUBLIC_*
   │  ├─ supabase/          cliente Supabase (AsyncStorage + url-polyfill)
   │  ├─ powersync/         system + connector + provider + llave SQLCipher
   │  ├─ auth/              AuthProvider + useAuth (sesión Supabase)
   │  └─ deudas/            DeudasSelectorsProvider + noopDeudasSelectors
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
  `useDeudasSelectors()`. Track B (edav) entrega la impl real y la inyecta en
  `<DeudasSelectorsProvider value={...}>`. Hasta entonces se usa `noopDeudasSelectors`
  (retorna 0 / []). Cero bloqueo.
- Cada carpeta de feature tiene un `README-OWNER.md` con su dueño y su tabla canónica.

## Seguridad

- **RLS** en Supabase protege el servidor: cada fila es visible solo si su `espacio_id`
  pertenece al usuario (vía `espacio_miembro`).
- **SQLCipher** cifra la SQLite local. La llave se genera por dispositivo y se guarda en
  `expo-secure-store` (Keychain/Keystore), nunca en el repo ni en `.env` de producción.
- RLS ≠ cifrado local: ambos son necesarios. Ver `../ARQUITECTURA.md`.

## Convenciones

- TypeScript estricto, comillas simples, sin punto y coma final.
- Dominio en español (`Movimiento`, `Deuda`, `Cuenta`); infraestructura en inglés.
- Color reservado para significado (estado, dinero, acción); siempre con icono y signo.
  Deuda en violeta, NO rojo. Ver `.github/branding/BRAND.md`.
- Glass sutil: solo tab bar, headers sticky, sheets y tarjeta de saldo. Fallback sólido
  sin blur para gama baja.
- Montos con `fontVariant: ['tabular-nums']` y formato COP (`$ 1.250.000`) vía `formatCOP`
  de `@vaulto/shared`.
