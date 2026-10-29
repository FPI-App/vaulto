import { CATEGORIAS_POR_DEFECTO, idCategoriaSugerida } from '@vaulto/shared/domain'
import type { QueryExecutor } from '@/lib/db/DatabaseWriter'
import type { SyncOperation } from './SyncRecoveryStore'

export const CATEGORY_SEED_TABLE = `CREATE TABLE IF NOT EXISTS vaulto_category_seed (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL
)`

export async function isCategorySeedIntent(db: Pick<QueryExecutor, 'execute' | 'getOptional'>, operation: SyncOperation): Promise<boolean> {
  if (operation.table !== 'categoria' || operation.op !== 'PUT' || typeof operation.data.created_at !== 'string') return false
  await db.execute(CATEGORY_SEED_TABLE)
  const known = await db.getOptional<{ created_at: string }>('SELECT created_at FROM vaulto_category_seed WHERE id = ?', [operation.id])
  if (known) return known.created_at === operation.data.created_at
  // Recuperar intención de semillas antiguas, antes de la primera petición RPC.
  if (typeof operation.data.espacio_id !== 'string') return false
  const espacioId = operation.data.espacio_id
  const seed = CATEGORIAS_POR_DEFECTO.find((item) => idCategoriaSugerida(espacioId, item.slug) === operation.id)
  const campos = ['nombre', 'tipo', 'icono', 'color'] as const
  if (!seed || campos.some((key) => operation.data[key] !== seed[key])) return false
  await db.execute('INSERT OR IGNORE INTO vaulto_category_seed (id, created_at) VALUES (?, ?)', [operation.id, operation.data.created_at])
  return true
}
