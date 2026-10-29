// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Costura Track A ↔ Track B: el dashboard solo conoce la interfaz
    // DeudasSelectors de @vaulto/shared, nunca la feature de deudas.
    files: ['src/features/dashboard/**', 'src/app/(app)/index.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/deudas', '@/features/deudas/*', '**/features/deudas', '**/features/deudas/*'],
              message: 'El dashboard consume deudas solo vía DeudasSelectors (@vaulto/shared).',
            },
          ],
        },
      ],
    },
  },
])
