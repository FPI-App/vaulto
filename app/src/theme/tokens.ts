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
// Una familia por peso: Android no sintetiza pesos de fuentes cargadas, así
// que el peso va en el nombre de la familia y no en fontWeight.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const

export const typography = {
  fontFamily: fonts.regular,
  fonts,
  scale: {
    display: { fontSize: 34, lineHeight: 40, fontFamily: fonts.bold, letterSpacing: -0.6 },
    h1: { fontSize: 28, lineHeight: 34, fontFamily: fonts.semibold, letterSpacing: -0.4 },
    h2: { fontSize: 22, lineHeight: 28, fontFamily: fonts.semibold, letterSpacing: -0.2 },
    h3: { fontSize: 18, lineHeight: 24, fontFamily: fonts.semibold },
    bodyLg: { fontSize: 16, lineHeight: 24, fontFamily: fonts.regular },
    body: { fontSize: 14, lineHeight: 20, fontFamily: fonts.regular },
    label: { fontSize: 13, lineHeight: 16, fontFamily: fonts.medium },
    caption: { fontSize: 12, lineHeight: 16, fontFamily: fonts.regular },
  },
} as const

/** Montos: siempre dígitos tabulares para que las columnas alineen. */
export const tabularNums = { fontVariant: ['tabular-nums' as const] }

/** Elevación (§6.3): sombras suaves y frías, nunca negras duras. */
export const shadow = {
  sm: { shadowColor: '#0B1730', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  md: { shadowColor: '#0B1730', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  lg: { shadowColor: '#0B1730', shadowOpacity: 0.16, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
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
    actionText: string
    /** Fondo suave de marca: chips seleccionados, íconos activos. */
    brandSoft: string
    /** Glass (§6.1): solo tab bar, modales y tarjeta de saldo. */
    glassFill: string
    glassBorder: string
    /** Fondo exterior en web, alrededor de la columna móvil. */
    backdrop: string
    /** Color semántico financiero del modo activo. */
    financial: typeof financialLight | typeof financialDark
  }
  radius: typeof radius
  space: typeof space
  layout: typeof layout
  typography: typeof typography
  shadow: typeof shadow
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
    actionText: brand[600],
    brandSoft: brand[100],
    glassFill: 'rgba(255,255,255,0.72)',
    glassBorder: 'rgba(255,255,255,0.6)',
    backdrop: '#E9EDF3',
    financial: financialLight,
  },
  radius,
  space,
  layout,
  typography,
  shadow,
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
    actionText: '#60A5FA',
    brandSoft: 'rgba(59,130,246,0.16)',
    glassFill: 'rgba(20,26,36,0.72)',
    glassBorder: 'rgba(255,255,255,0.08)',
    backdrop: '#06090F',
    financial: financialDark,
  },
  radius,
  space,
  layout,
  typography,
  shadow,
  motion,
}
