// Tokens de diseño de Vaulto. Fuente de verdad: .github/branding/BRAND.md.
// Regla de marca: el color comunica estado y dinero, no decora. Todo par
// texto/fondo cumple WCAG AA. Glassmorfismo sutil, nunca protagonista.

/** Paleta de marca (azul tinta). */
export const brand = {
  100: '#DBEAFE',
  500: '#3B82F6',
  600: '#2563EB',
  700: '#1D4ED8',
  950: '#172554',
} as const

/** Ámbar luz. Acento muy escaso (destello en logo, hito de meta). */
export const accent = {
  500: '#F59E0B',
} as const

/** Neutros (modo claro). */
export const neutral = {
  0: '#FFFFFF',
  50: '#F7F8FA',
  100: '#EEF1F5',
  200: '#E2E6EC',
  400: '#9AA3B2',
  600: '#5B6573',
  800: '#272D38',
  900: '#171B22',
} as const

/** Superficies y texto del modo oscuro (azul-tinta, no negro puro). */
export const darkPalette = {
  bg: '#0B0F17',
  surface: '#141A24',
  surface2: '#1C2430',
  border: '#2A3340',
  text: '#E7EBF1',
  textMuted: '#9BA6B5',
} as const

/**
 * Color semántico financiero. SIEMPRE acompañar de icono y/o signo (+/-),
 * nunca solo color (daltonismo). Deuda en violeta, NO rojo. Alertas en ámbar.
 */
export const financialLight = {
  income: '#15803D',
  expense: '#DC2626',
  debt: '#7C3AED',
  warning: '#B45309',
  success: '#0E7490',
} as const

export const financialDark = {
  income: '#4ADE80',
  expense: '#F87171',
  debt: '#A78BFA',
  warning: '#FBBF24',
  success: '#22D3EE',
} as const

/** Degradado de marca: lineal 135°, brand/600 → brand/700. */
export const brandGradient = {
  angle: 135,
  from: brand[600],
  to: brand[700],
} as const

/** Radios de esquina. */
export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  full: 999,
} as const

/** Escala de espaciado, base 4. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const

/** Padding lateral de pantalla y touch target mínimo (no negociable: 44×44). */
export const layout = {
  screenPadding: 16,
  minTouchTarget: 44,
} as const

/**
 * Tipografía. Familia única en MVP: Inter. Montos con tabular-nums y formato
 * COP (`$ 1.250.000`). Máx. 3 pesos por pantalla. Nada crítico < 12px.
 */
export const typography = {
  fontFamily: 'Inter',
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  scale: {
    display: { fontSize: 34, fontWeight: '700' },
    h1: { fontSize: 28, fontWeight: '600' },
    h2: { fontSize: 22, fontWeight: '600' },
    h3: { fontSize: 18, fontWeight: '600' },
    bodyLg: { fontSize: 16, fontWeight: '400' },
    body: { fontSize: 14, fontWeight: '400' },
    label: { fontSize: 13, fontWeight: '500' },
    caption: { fontSize: 12, fontWeight: '400' },
  },
} as const

/** Movimiento. 150–250ms, curva cubic-bezier(0.22, 1, 0.36, 1). Respetar reduce-motion. */
export const motion = {
  durationFast: 150,
  durationBase: 200,
  durationSlow: 250,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const

/** Tema resuelto que consume la UI. */
export interface Theme {
  mode: 'light' | 'dark'
  colors: {
    brand: typeof brand
    accent: typeof accent
    /** Superficies dependientes del modo. */
    bg: string
    surface: string
    surface2: string
    border: string
    text: string
    textMuted: string
    /** Color semántico financiero del modo activo. */
    financial: typeof financialLight | typeof financialDark
  }
  radius: typeof radius
  space: typeof space
  layout: typeof layout
  typography: typeof typography
  motion: typeof motion
}

export const lightTheme: Theme = {
  mode: 'light',
  colors: {
    brand,
    accent,
    bg: neutral[50],
    surface: neutral[0],
    surface2: neutral[100],
    border: neutral[200],
    text: neutral[900],
    textMuted: neutral[600],
    financial: financialLight,
  },
  radius,
  space,
  layout,
  typography,
  motion,
}

export const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    brand,
    accent,
    bg: darkPalette.bg,
    surface: darkPalette.surface,
    surface2: darkPalette.surface2,
    border: darkPalette.border,
    text: darkPalette.text,
    textMuted: darkPalette.textMuted,
    financial: financialDark,
  },
  radius,
  space,
  layout,
  typography,
  motion,
}
