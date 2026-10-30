import { BlurView } from 'expo-blur'
import { router, type Tabs } from 'expo-router'
import type { LucideIcon } from 'lucide-react-native'
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right'
import Handshake from 'lucide-react-native/icons/handshake'
import House from 'lucide-react-native/icons/house'
import Plus from 'lucide-react-native/icons/plus'
import UserRound from 'lucide-react-native/icons/user-round'
import type { ComponentProps } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/theme'
import { PressableScale } from './PressableScale'
import { Text } from './Text'

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

const TABS: { name: string; label: string; icon: LucideIcon }[] = [
  { name: 'index', label: 'Inicio', icon: House },
  { name: 'movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { name: 'deudas', label: 'Deudas', icon: Handshake },
  { name: 'perfil', label: 'Perfil', icon: UserRound },
]

/**
 * Tab bar flotante de vidrio (§6.6): cuatro destinos y el «+» central para
 * registrar un movimiento, la acción más frecuente. Cuentas y Categorías no
 * están en la barra; se llega desde Inicio y Movimientos.
 */
export function TabBar({ state, navigateToTab }: TabBarProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const current = state.routes[state.index]?.name
  if (current === 'onboarding') return null

  const renderTab = ({ name, label, icon: Icon }: (typeof TABS)[number]) => {
    const focused = current === name
    const color = focused ? theme.colors.actionText : theme.colors.textMuted
    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
        onPress={() => {
          const route = state.routes.find((r) => r.name === name)
          if (route && !focused) navigateToTab(route.key)
        }}
        style={styles.tab}
      >
        <Icon size={22} color={color} strokeWidth={focused ? 2.3 : 1.8} />
        <Text
          variant="caption"
          numberOfLines={1}
          style={{
            color,
            fontSize: 11,
            marginTop: 3,
            fontFamily: focused ? theme.typography.fonts.semibold : theme.typography.fonts.medium,
          }}
        >
          {label}
        </Text>
      </Pressable>
    )
  }

  const glass = {
    backgroundColor: theme.colors.glassFill,
    borderColor: theme.mode === 'dark' ? theme.colors.glassBorder : 'rgba(15,23,42,0.06)',
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.bar, glass, theme.shadow.lg]}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, { backdropFilter: 'blur(20px) saturate(160%)' } as object]} />
        ) : (
          // En Android de gama baja el blur cae a la superficie semisólida (§6.1).
          <BlurView intensity={30} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        )}
        {TABS.slice(0, 2).map(renderTab)}
        <View style={styles.tab}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Registrar movimiento"
            onPress={() => router.push('/movimientos/nuevo')}
            scaleTo={0.92}
            style={[styles.fab, { backgroundColor: theme.colors.brand[600] }, theme.shadow.md]}
          >
            <Plus size={26} color="#FFFFFF" strokeWidth={2.4} />
          </PressableScale>
        </View>
        {TABS.slice(2).map(renderTab)}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 6,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  fab: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
})
