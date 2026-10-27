import { createClient, type Session } from '@supabase/supabase-js'
import { UpdateType, type CrudEntry, type PowerSyncBackendConnector } from '@powersync/react-native'

import { supabase } from '../supabase'

interface UploadSource {
  getNextCrudTransaction(): Promise<{
    crud: readonly Pick<CrudEntry, 'id' | 'table' | 'op' | 'opData'>[]
    complete(): Promise<void>
  } | null>
}

export class SupabaseConnector implements PowerSyncBackendConnector {
  constructor(private readonly userId: string) {}

  private async requireSession(): Promise<Session> {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session || session.user.id !== this.userId) {
      throw new Error('La sesión cambió; la sincronización de esta cuenta se detuvo.')
    }
    return session
  }

  async fetchCredentials() {
    const session = await this.requireSession()
    return {
      endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL || '',
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    }
  }

  async uploadData(database: UploadSource) {
    const session = await this.requireSession()
    const transaction = await database.getNextCrudTransaction()
    if (!transaction) return
    const uploadClient = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL!,
      (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)!,
      {
        global: { headers: { Authorization: `Bearer ${session.access_token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      },
    )
    try {
      for (const op of transaction.crud) {
        const table = uploadClient.from(op.table)
        const data = Object.fromEntries(Object.entries(op.opData ?? {}).filter(([key]) => key !== 'id'))
        switch (op.op) {
          case UpdateType.PUT:
            await table.upsert({ ...data, id: op.id }).throwOnError()
            break
          case UpdateType.PATCH:
            await table.update(data).eq('id', op.id).throwOnError()
            break
          case UpdateType.DELETE:
            await table.update({ deleted_at: new Date().toISOString() }).eq('id', op.id).throwOnError()
            break
          default:
            throw new Error('Operación de sincronización no admitida')
        }
      }
      await transaction.complete()
    } catch {
      // No registrar tokens, filas ni errores del servidor que contengan datos personales.
      throw new Error('No se pudo subir la transacción. La cola local se conservó para reintentar.')
    }
  }
}
