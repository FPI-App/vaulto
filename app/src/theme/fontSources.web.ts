import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff2'
import inter500 from '@fontsource/inter/files/inter-latin-500-normal.woff2'
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff2'
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff2'

import { fonts } from './tokens'

// En web los TTF de @expo-google-fonts pesan 1,4 MB; el subconjunto latino en
// woff2 de @fontsource cubre el español (tildes, ñ, ¿¡) con ~96 KB.
export const fontSources = {
  [fonts.regular]: inter400,
  [fonts.medium]: inter500,
  [fonts.semibold]: inter600,
  [fonts.bold]: inter700,
}
