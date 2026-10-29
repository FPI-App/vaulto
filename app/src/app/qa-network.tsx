import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Redirect } from 'expo-router'

/** Solo development builds; no imprime endpoints, cabeceras ni credenciales. */
export default function NetworkQA() {
  const [result, setResult] = useState<Record<string, unknown>>({ status: 'waiting' })
  useEffect(() => {
    if (!__DEV__) return
    const probe = async (endpoint: string, headers: Record<string, string>) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      try {
        const response = await fetch(endpoint, { headers, signal: controller.signal })
        return response.status
      } catch { return 'connection-failed' } finally { clearTimeout(timeout) }
    }
    void Promise.all([
      probe(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/health`, { apikey: (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)! }),
      probe(`${process.env.EXPO_PUBLIC_POWERSYNC_URL}/probes/liveness`, {}),
    ]).then(([supabase, powersync]) => setResult({ supabase, powersync }))
  }, [])
  if (!__DEV__) return <Redirect href="/(auth)/login" />
  return <View style={{ flex: 1, padding: 32, justifyContent: 'center' }}><Text>{JSON.stringify(result)}</Text></View>
}
