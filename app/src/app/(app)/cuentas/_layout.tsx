import { Stack } from 'expo-router'

// Stack de la sección Cuentas: la lista (index) y las pantallas de crear/editar
// presentadas como modal encima de la tab.
export default function CuentasLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="nueva" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
