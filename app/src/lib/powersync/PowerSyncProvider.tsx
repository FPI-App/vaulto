import { PowerSyncContext, type PowerSyncDatabase } from '@powersync/react-native'
import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, Text, View } from 'react-native'

import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { useAuth } from '@/lib/auth/AuthProvider'
import type { DatabaseLease } from '@/lib/db/DatabaseSessions'
import { StorageError } from '@/lib/db/storageErrors'
import { databaseSessions } from '@/lib/sync/db'
import { useTheme } from '@/theme'
import { SyncUploadNotice } from './SyncUploadNotice'

type StorageState = { database: PowerSyncDatabase; error?: never } | { error: string; database?: never }

export function PowerSyncProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const theme = useTheme()
  const { signOut } = useAuth()
  const [state, setState] = useState<StorageState | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let lease: DatabaseLease<PowerSyncDatabase> | null = null
    void databaseSessions.acquire(userId).then((opened) => {
      lease = opened
      if (cancelled) {
        void opened.release().catch(() => {})
      } else {
        setState({ database: opened.database })
      }
    }).catch((error: unknown) => {
      if (!cancelled) setState({ error: error instanceof StorageError ? error.message : 'No se pudieron preparar tus datos. Se conservaron los archivos existentes.' })
    })
    return () => {
      cancelled = true
      if (lease) void lease.release().catch(() => {})
    }
  }, [userId, attempt])

  if (state?.database) {
    return (
      <PowerSyncContext.Provider value={state.database}>
        <View style={{ flex: 1 }}>
          <SyncUploadNotice />
          <View style={{ flex: 1 }}>{children}</View>
        </View>
      </PowerSyncContext.Provider>
    )
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.space.lg }}>
        <Text accessibilityRole="header" style={{ ...theme.typography.scale.h2, color: theme.colors.text }}>{state?.error ? 'No pudimos abrir tus datos' : 'Preparando tus datos'}</Text>
        {state?.error ? (
          <>
            <Text style={{ ...theme.typography.scale.body, color: theme.colors.textMuted }}>{state.error}</Text>
            <Button label="Reintentar" onPress={() => { setState(null); setAttempt((value) => value + 1) }} />
            <Button label="Cerrar sesión" variant="ghost" onPress={() => { void signOut().catch(() => Alert.alert('No se pudo cerrar sesión', 'Intenta de nuevo.')) }} />
          </>
        ) : <ActivityIndicator accessibilityLabel="Abriendo la base de datos" color={theme.colors.brand[600]} />}
      </View>
    </Screen>
  )
}
