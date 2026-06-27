import { Tabs } from 'expo-router'

import { useTheme } from '@/theme'

// Navegación principal autenticada. Cinco destinos del MVP:
// Inicio (dashboard) · Cuentas · Movimientos · Deudas · Perfil.
// Iconos definitivos: Lucide outline (BRAND.md §4). Aquí texto-only para no
// acoplar el spine a una librería de iconos antes de tiempo.
export default function AppTabsLayout() {
  const theme = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand[600],
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.scale.label.fontSize,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="cuentas" options={{ title: 'Cuentas' }} />
      <Tabs.Screen name="movimientos" options={{ title: 'Movimientos' }} />
      <Tabs.Screen name="deudas" options={{ title: 'Deudas' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
      {/* Rutas fuera de la tab bar (modales / flujos): se ocultan como tabs. */}
      <Tabs.Screen name="categorias" options={{ href: null }} />
      <Tabs.Screen name="onboarding" options={{ href: null }} />
    </Tabs>
  )
}
