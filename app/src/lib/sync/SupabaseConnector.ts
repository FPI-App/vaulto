import { createClient, type Session } from '@supabase/supabase-js'
import { type CrudEntry, type PowerSyncBackendConnector } from '@powersync/react-native'

import { supabase } from '../supabase'
import { SyncUploadError } from './SyncUploadError'

interface UploadSource {
  getClientId(): Promise<string>
  getNextCrudTransaction(): Promise<{
    crud: readonly Pick<CrudEntry, 'clientId' | 'id' | 'table' | 'op' | 'opData'>[]
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
    try {
      const transaction = await database.getNextCrudTransaction()
      if (!transaction) return
      const clientId = await database.getClientId()
      const entries = transaction.crud
      const first = entries[0]
      const last = entries[entries.length - 1]
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(clientId) || !first || !last || entries.some((entry) => !Number.isSafeInteger(entry.clientId) || entry.clientId < 1)) {
        throw new SyncUploadError('protocol')
      }
      // Identidad persistente de esta base + rango de operaciones, estable en reintentos.
      const batchId = `${clientId}:${first.clientId}:${last.clientId}`
      const uploadClient = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)!,
        {
          global: { headers: { Authorization: `Bearer ${session.access_token}` } },
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        },
      )
      const { data } = await uploadClient.rpc('aplicar_lote_sync', {
        p_lote_id: batchId,
        p_operaciones: entries.map((op) => ({
          table: op.table, id: op.id, op: op.op,
          data: Object.fromEntries(Object.entries(op.opData ?? {}).filter(([key]) => key !== 'id')),
        })),
      }).throwOnError()
      if (!data || data.protocol !== 1 || data.batch_id !== batchId || !['applied', 'already_applied'].includes(data.status)) {
        throw new SyncUploadError('protocol')
      }
      await transaction.complete()
    } catch (error: unknown) {
      // No registrar tokens, filas ni errores del servidor que contengan datos personales.
      if (error instanceof SyncUploadError) throw error
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
      throw new SyncUploadError(code === 'PGRST202' ? 'backend' : code === '23514' || code === '42501' || code === '22023' ? 'conflict' : 'retry')
    }
  }
}
