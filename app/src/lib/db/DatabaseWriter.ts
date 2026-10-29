/** Superficie SQL que necesitan las mutaciones locales, sin depender del driver nativo. */
export interface QueryExecutor {
  execute(sql: string, parameters?: unknown[]): Promise<unknown>
  getOptional<T>(sql: string, parameters?: unknown[]): Promise<T | null>
  getAll<T>(sql: string, parameters?: unknown[]): Promise<T[]>
}

export interface DatabaseWriter {
  execute: QueryExecutor['execute']
  writeTransaction<T>(callback: (transaction: QueryExecutor) => Promise<T>): Promise<T>
}
