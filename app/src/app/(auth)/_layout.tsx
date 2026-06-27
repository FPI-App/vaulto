import { Stack } from 'expo-router'

// Grupo público de autenticación. El guard del root layout redirige aquí
// cuando no hay sesión, y a (app) cuando sí la hay.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
