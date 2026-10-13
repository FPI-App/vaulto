import { Stack } from 'expo-router'

// Stack de Categorías: la lista (se abre desde Movimientos) y crear/editar como modal.
export default function CategoriasLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="nueva" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
