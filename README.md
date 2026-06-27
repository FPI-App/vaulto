# Vaulto

> Tu vida financiera, en orden y a la vista. En menos de un minuto sabes cómo estás. Aunque no tengas señal.

**Vaulto** es una app de finanzas personales **offline-first** para Colombia/LATAM. Unifica en una sola vista accionable lo que hoy vive disperso entre notas, Excel y apps bancarias: cuentas, movimientos, deudas bidireccionales (*yo debo* / *me deben*) y pagos. Responde una sola pregunta: **¿con lo que tengo y lo que falta, llego o no llego?**

- **Equipo:** edav + lmilo
- **Mercado inicial:** Colombia (COP)
- **Modelo de negocio:** freemium
- **Org GitHub:** [FPI-App](https://github.com/FPI-App)

Documentación de producto (brief, análisis, brandbook) en el repo [`docs`](https://github.com/FPI-App/docs). Estándares y branding en [`.github`](https://github.com/FPI-App/.github).

---

## Stack

| Capa | Tecnología |
|---|---|
| **App** | Expo + React Native + TypeScript, Expo Router (tabs + rutas protegidas) |
| **Base de datos local** | SQLite cifrada con **SQLCipher** (cifrado en reposo) |
| **Sincronización** | **PowerSync** sobre Supabase + cola local + merge por campo donde el dominio lo justifique, LWW solo como fallback |
| **Backend** | **Supabase**: Auth (correo/contraseña), Postgres, **RLS obligatorio**, Storage |
| **Edge functions** | Supabase Functions (Deno) |
| **Servicios futuros** | Render (parsers, jobs) — aún no existen |

---

## Estructura del repositorio

Monorepo simple con workspaces de **pnpm**. Un solo paquete compartido, sin sobre-ingeniería.

```
vaulto/
├─ app/                  # App Expo / React Native (TypeScript)
│  ├─ src/
│  │  ├─ app/            # Rutas Expo Router (tabs, rutas protegidas)
│  │  ├─ components/     # Componentes UI reutilizables
│  │  ├─ features/       # Lógica por dominio (movimientos, deudas, cuentas...)
│  │  ├─ lib/
│  │  │  ├─ db/          # SQLite + SQLCipher (esquema local, migraciones)
│  │  │  ├─ sync/        # Integración PowerSync, cola, resolución de conflictos
│  │  │  └─ supabase/    # Cliente Supabase, auth
│  │  └─ theme/          # Tokens del brandbook (paleta, tipografía, radios)
│  └─ assets/
├─ packages/
│  └─ shared/            # @vaulto/shared — código que cruza cliente/servidor
│     └─ src/
│        ├─ types/       # Tipos del esquema (generados de Postgres + manuales)
│        ├─ domain/      # Modelos y reglas de dominio puras (saldos, deudas)
│        └─ powersync/   # Definición del esquema de sincronización PowerSync
├─ supabase/             # Backend gestionado (no es un servidor)
│  ├─ migrations/        # Migraciones SQL versionadas
│  ├─ policies/          # Políticas RLS documentadas
│  └─ functions/         # Edge functions (Deno)
├─ docs/                 # Documentación interna mínima del repo (ADRs, runbooks)
└─ .github/workflows/    # CI
```

La decisión de usar un solo repo (no separar frontend/backend) y su justificación están en [`docs/decisiones/0001-repo-mono.md`](docs/decisiones/0001-repo-mono.md). La arquitectura de datos y sync en [`ARQUITECTURA.md`](ARQUITECTURA.md).

---

## Requisitos previos

- **Node** 20 LTS o superior (gestionado con [mise](https://mise.jdx.dev/))
- **pnpm** 9+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Supabase CLI** ([instalación](https://supabase.com/docs/guides/cli))
- **Expo / EAS**: la app corre con `expo` (incluido como dependencia). Para builds nativas, [EAS CLI](https://docs.expo.dev/eas/).
- **Docker** (para levantar Supabase en local)

---

## Cómo correr el proyecto

Orden de levantado: **infra → migraciones → app**.

```bash
# 1. Instalar dependencias (todo el workspace)
pnpm install

# 2. Copiar variables de entorno y completarlas
cp .env.example .env
# Edita .env con tus credenciales de Supabase (ver supabase/README.md)

# 3. Levantar Supabase en local (Postgres + Auth + Storage)
pnpm supabase:start

# 4. Aplicar migraciones
pnpm db:migrate

# 5. Arrancar la app Expo
pnpm app:dev
```

Para correr en un dispositivo/emulador, sigue las instrucciones de Expo que imprime el paso 5 (escanear QR con Expo Go en desarrollo, o build de desarrollo para probar SQLCipher/PowerSync nativos).

> **Nota sobre SQLCipher y PowerSync:** ambos requieren código nativo, por lo que **no funcionan en Expo Go**. Usa una *development build* (`pnpm app:prebuild` + `expo run:android` / `expo run:ios`).

---

## Scripts útiles

| Comando | Qué hace |
|---|---|
| `pnpm app:dev` | Arranca el servidor de desarrollo de Expo |
| `pnpm app:prebuild` | Genera los proyectos nativos (android/ios) |
| `pnpm supabase:start` | Levanta Supabase local con Docker |
| `pnpm supabase:stop` | Detiene Supabase local |
| `pnpm db:migrate` | Aplica migraciones a la DB local |
| `pnpm db:types` | Regenera los tipos TS del esquema en `packages/shared` |
| `pnpm lint` | Linter en todo el workspace |
| `pnpm typecheck` | Chequeo de tipos en todo el workspace |

---

## Convenciones

- **Idioma:** español. Dominio de negocio en español (`movimiento`, `cuenta`, `deuda`); código de infraestructura en inglés.
- **Commits:** en español, en imperativo. Ej: `Agrega tabla movimientos con RLS`, no `Agregada tabla`.
- **TypeScript** estricto. Comillas simples. Sin punto y coma final.
- **Campos transversales del esquema desde el día 1:** ver [`ARQUITECTURA.md`](ARQUITECTURA.md). Toda tabla nueva los respeta.

---

## Licencia

Propietario. © FPI-App. Todos los derechos reservados.
