import { Stack } from 'expo-router'

// Stack de Movimientos: la lista (tab) y crear/editar como modal.
export default function MovimientosLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="nuevo" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
