import { useEffect, useRef, useState } from 'react'
import { Button, ScrollView, Text, TextInput, View } from 'react-native'
import { registerRootComponent } from 'expo'

import { AuthProvider, useAuth } from './src/lib/auth/AuthProvider'
import { runRemoteStorageFixture } from './src/app/qa-storage'
import { runSyncRecoveryFixture } from './src/app/qa-sync-recovery'

type Mode = 'remote-create' | 'remote-resume' | 'prepare' | 'resume'
type RecoveryFixture = Awaited<ReturnType<typeof runSyncRecoveryFixture>>

/** Entrada de QA aislada: reutiliza auth y motores reales sin montar el dashboard del producto. */
function Harness() {
  const { session, initializing, signInWithPassword, signOut } = useAuth()
  const userId = session?.user.id
  const active = useRef<RecoveryFixture>(null)
  const [report, setReport] = useState<Record<string, unknown>>({ status: 'ready' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => () => {
    const opened = active.current
    active.current = null
    void opened?.close()
  }, [userId])

  async function run(mode: Mode) {
    if (!__DEV__ || !userId || busy) return
    setBusy(true)
    await active.current?.close()
    active.current = null
    setReport({ status: 'running', mode })
    try {
      if (mode === 'remote-create' || mode === 'remote-resume') {
        setReport(await runRemoteStorageFixture(mode, userId, stage => setReport({ status: 'running', mode, stage })))
      } else {
        active.current = await runSyncRecoveryFixture(mode, userId, setReport)
      }
    } catch {
      setReport({ status: 'failed', mode })
    } finally {
      setBusy(false)
    }
  }

  return <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 50, gap: 10 }}>
    <Text testID="native-qa-session">{JSON.stringify({ harness: true, initializing, authenticated: Boolean(session) })}</Text>
    {!session ? <View style={{ gap: 8 }}>
      <TextInput accessibilityLabel="Correo" placeholder="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" style={{ borderWidth: 1, padding: 10 }} />
      <TextInput accessibilityLabel="Contraseña" placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth: 1, padding: 10 }} />
      <Button title="Entrar" disabled={busy} onPress={async () => {
        setBusy(true)
        try {
          await signInWithPassword(email.trim(), password)
          setPassword('')
          setReport({ status: 'authenticated' })
        } catch { setReport({ status: 'auth-failed' }) } finally { setBusy(false) }
      }} />
    </View> : <View style={{ gap: 8 }}>
      <Button title="Crear fixture21" disabled={busy} onPress={() => { void run('remote-create') }} />
      <Button title="Reanudar21" disabled={busy} onPress={() => { void run('remote-resume') }} />
      <Button title="Preparar25" disabled={busy} onPress={() => { void run('prepare') }} />
      <Button title="Retomar25" disabled={busy} onPress={() => { void run('resume') }} />
      <Button title="Anular" disabled={report.canRequestCancellation !== true} onPress={() => { void active.current?.requestCancellation() }} />
      <Button title="Cerrar sesión" disabled={busy} onPress={async () => {
        await active.current?.close()
        active.current = null
        await signOut()
        setReport({ status: 'signed-out' })
      }} />
    </View>}
    <Text selectable testID="native-qa-report">{JSON.stringify(report)}</Text>
  </ScrollView>
}

function Root() { return __DEV__ ? <AuthProvider><Harness /></AuthProvider> : null }
registerRootComponent(Root)
