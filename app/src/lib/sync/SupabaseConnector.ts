import { createClient, type Session } from '@supabase/supabase-js'
import { type CrudEntry, type PowerSyncBackendConnector } from '@powersync/react-native'

import { supabase } from '../supabase'
import { SyncUploadError } from './SyncUploadError'
import { SyncRecoveryStore, type SyncOperation } from './SyncRecoveryStore'

interface UploadSource {
  getClientId(): Promise<string>
  getNextCrudTransaction(): Promise<{
    crud: readonly Pick<CrudEntry, 'clientId' | 'id' | 'table' | 'op' | 'opData'>[]
    complete(): Promise<void>
  } | null>
}

export class SupabaseConnector implements PowerSyncBackendConnector {
  constructor(private readonly userId: string, private readonly recovery?: SyncRecoveryStore, private readonly seedIntent?: (operation: SyncOperation) => Promise<boolean>) {}

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
      const operations: SyncOperation[] = await Promise.all(entries.map(async (op) => {
        const operation: SyncOperation = {
          table: op.table, id: op.id, op: op.op,
          data: Object.fromEntries(Object.entries(op.opData ?? {}).filter(([key]) => key !== 'id')),
        }
        return await this.seedIntent?.(operation) ? { ...operation, if_absent: true } : operation
      }))
      const recovery = await this.recovery?.get(batchId, operations)
      const cancelling = recovery?.decision === 'requested' || recovery?.decision === 'cancelled'
      const uploadClient = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)!,
        {
          global: { headers: { Authorization: `Bearer ${session.access_token}` } },
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        },
      )
      let data: { protocol?: number; batch_id?: string; status?: string } | null
      try {
        const result = await uploadClient.rpc(cancelling ? 'cancelar_lote_abono' : 'aplicar_lote_sync', {
          p_lote_id: batchId, p_operaciones: operations,
        }).throwOnError()
        data = result.data
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23514') {
          await this.recovery?.record(batchId, operations)
        }
        throw error
      }
      const allowed = cancelling ? ['cancelled', 'already_applied'] : ['applied', 'already_applied']
      if (!data || data.protocol !== 1 || data.batch_id !== batchId || !allowed.includes(data.status ?? '')) {
        throw new SyncUploadError('protocol')
      }
      await this.recovery?.confirm(batchId, data.status === 'cancelled' ? 'cancelled' : 'applied')
      await transaction.complete()
    } catch (error: unknown) {
      // No registrar tokens, filas ni errores del servidor que contengan datos personales.
      if (error instanceof SyncUploadError) throw error
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
      throw new SyncUploadError(code === 'PGRST202' ? 'backend' : code === '23514' || code === '42501' || code === '22023' ? 'conflict' : 'retry')
    }
  }
}
