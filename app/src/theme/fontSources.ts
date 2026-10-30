import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'

import { fonts } from './tokens'

/** Archivos de Inter por peso para `useFonts`. En web se usa `fontSources.web.ts` (woff2). */
export const fontSources = {
  [fonts.regular]: Inter_400Regular,
  [fonts.medium]: Inter_500Medium,
  [fonts.semibold]: Inter_600SemiBold,
  [fonts.bold]: Inter_700Bold,
}
