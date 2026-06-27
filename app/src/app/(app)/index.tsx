// Dashboard / Inicio. Dueño: lmilo (Track A).
//
// Placeholder funcional: ya consume el contrato DeudasSelectors (interfaz en
// @vaulto/shared) vía useDeudasSelectors(). Hoy resuelve contra noopDeudasSelectors
// (0 / []); cuando Track B (edav) entregue la impl, este componente NO cambia.
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { formatCOP } from '@vaulto/shared'

import { Screen } from '@/components/Screen'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useDeudasSelectors } from '@/lib/deudas/DeudasSelectorsProvider'
import { useTheme } from '@/theme'

export default function DashboardScreen() {
  const theme = useTheme()
  const { signOut } = useAuth()
  const deudas = useDeudasSelectors()

  const [yoDebo, setYoDebo] = useState(0)
  const [meDeben, setMeDeben] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([
      deudas.getTotalPorDireccion('yo_debo'),
      deudas.getTotalPorDireccion('me_deben'),
    ]).then(([debo, deben]) => {
      if (!active) return
      setYoDebo(debo)
      setMeDeben(deben)
    })
    return () => {
      active = false
    }
  }, [deudas])

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text
          style={{
            ...theme.typography.scale.h1,
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.text,
            marginTop: theme.space.lg,
          }}
        >
          Inicio
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg },
          ]}
        >
          <Text style={{ ...theme.typography.scale.label, color: theme.colors.textMuted }}>
            Yo debo
          </Text>
          <Text
            style={{
              ...theme.typography.scale.h2,
              color: theme.colors.financial.debt,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatCOP(yoDebo)}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg },
          ]}
        >
          <Text style={{ ...theme.typography.scale.label, color: theme.colors.textMuted }}>
            Me deben
          </Text>
          <Text
            style={{
              ...theme.typography.scale.h2,
              color: theme.colors.financial.debt,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatCOP(meDeben)}
          </Text>
        </View>

        <Text
          style={{
            ...theme.typography.scale.caption,
            color: theme.colors.textMuted,
            marginTop: theme.space.lg,
          }}
        >
          Dashboard placeholder · dueño: lmilo (Track A). Consume DeudasSelectors (impl
          noop hasta que Track B la entregue).
        </Text>

        <View style={{ marginTop: theme.space['3xl'] }}>
          <Text
            onPress={signOut}
            style={{ ...theme.typography.scale.label, color: theme.colors.brand[600] }}
          >
            Cerrar sesión
          </Text>
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    padding: 20,
  },
})
