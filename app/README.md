# @vaulto/app

App móvil de Vaulto: Expo + React Native + TypeScript, con Expo Router (navegación por tabs y rutas protegidas), almacenamiento local cifrado (SQLCipher) y sincronización offline-first vía PowerSync sobre Supabase.

## Estructura

```
app/
├─ src/
│  ├─ app/            # Rutas de Expo Router
│  │                  #   - grupo (auth):    login, registro, recuperar contraseña
│  │                  #   - grupo (tabs):    Inicio · Movimientos · (+) · Deudas · Más
│  │                  #   - rutas protegidas: redirigen a login si no hay sesión
│  ├─ components/     # Componentes UI reutilizables (botones, tarjetas, sheets)
│  ├─ features/       # Lógica y pantallas por dominio (movimientos, deudas, cuentas, dashboard)
│  ├─ lib/
│  │  ├─ db/          # SQLite + SQLCipher: apertura cifrada, esquema local
│  │  ├─ sync/        # PowerSync: conexión, cola, resolución de conflictos
│  │  └─ supabase/    # Cliente Supabase y auth (correo/contraseña)
│  └─ theme/          # Tokens del brandbook: paleta, tipografía Inter, radios, espaciado
└─ assets/            # Íconos, splash, fuentes
```

Los tipos del esquema, los modelos de dominio puros y la definición del esquema PowerSync se importan del paquete compartido `@vaulto/shared` (`../packages/shared`).

## Correr en desarrollo

```bash
# Desde la raíz del repo:
pnpm app:dev
```

> **SQLCipher y PowerSync requieren código nativo: no corren en Expo Go.**
> Usa una *development build*:
>
> ```bash
> pnpm app:prebuild
> pnpm app:android   # o app:ios
> ```

## Variables de entorno

La app lee variables con prefijo `EXPO_PUBLIC_` desde el `.env` de la raíz (ver `../.env.example`). La URL y la anon key de Supabase son públicas por diseño; la seguridad real la da RLS en el servidor y SQLCipher en el dispositivo.

## Convenciones

- TypeScript estricto, comillas simples, sin punto y coma final.
- Dominio en español (`Movimiento`, `Deuda`, `Cuenta`); infraestructura en inglés.
- Glassmorfismo sutil según el brandbook: glass solo en tab bar, headers sticky, sheets y tarjeta de saldo. Fallback sólido sin blur obligatorio para Android gama baja.
- Montos siempre con `tabular-nums` y formato COP (`$ 1.250.000`).
