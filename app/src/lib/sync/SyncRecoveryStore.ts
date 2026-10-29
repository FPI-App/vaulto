import type { QueryExecutor } from '@/lib/db/DatabaseWriter'

export interface SyncOperation {
  table: string
  id: string
  op: string
  data: Record<string, unknown>
  if_absent?: boolean
}

export interface RecoveryRow {
  batch_id: string
  operations_json: string
  decision: 'blocked' | 'requested' | 'cancelled' | 'applied'
}

export function esLoteAbono(operations: readonly SyncOperation[]): boolean {
  if (operations.length !== 2) return false
  const pago = operations.find((op) => op.table === 'pago' && op.op === 'PUT')
  const deuda = operations.find((op) => op.table === 'deuda' && op.op === 'PATCH')
  return Boolean(pago && deuda && pago.data.deuda_id === deuda.id)
}

/** Tabla local normal, fuera de los streams y de la cola CRUD; la protege SQLCipher. */
export class SyncRecoveryStore {
  constructor(private readonly db: Pick<QueryExecutor, 'execute' | 'getOptional'>) {}

  async init(): Promise<void> {
    await this.db.execute(`CREATE TABLE IF NOT EXISTS vaulto_sync_recovery (
      batch_id TEXT PRIMARY KEY, operations_json TEXT NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('blocked', 'requested', 'cancelled', 'applied')),
      created_at TEXT NOT NULL, confirmed_at TEXT
    )`)
  }

  async get(batchId: string, operations: readonly SyncOperation[]): Promise<RecoveryRow | null> {
    const row = await this.db.getOptional<RecoveryRow>('SELECT * FROM vaulto_sync_recovery WHERE batch_id = ?', [batchId])
    if (row && row.operations_json !== JSON.stringify(operations)) {
      throw new Error('El lote guardado no coincide con la cola pendiente')
    }
    return row
  }

  async record(batchId: string, operations: readonly SyncOperation[]): Promise<void> {
    if (!esLoteAbono(operations)) return
    await this.db.execute(
      `INSERT INTO vaulto_sync_recovery (batch_id, operations_json, decision, created_at)
       VALUES (?, ?, 'blocked', ?) ON CONFLICT(batch_id) DO NOTHING`,
      [batchId, JSON.stringify(operations), new Date().toISOString()],
    )
    await this.get(batchId, operations)
  }

  async requestCancellation(batchId: string): Promise<void> {
    await this.db.execute("UPDATE vaulto_sync_recovery SET decision = 'requested' WHERE batch_id = ? AND decision = 'blocked'", [batchId])
  }

  async confirm(batchId: string, decision: 'cancelled' | 'applied'): Promise<void> {
    await this.db.execute('UPDATE vaulto_sync_recovery SET decision = ?, confirmed_at = ? WHERE batch_id = ?', [decision, new Date().toISOString(), batchId])
  }
}
