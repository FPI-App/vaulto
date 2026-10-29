export interface DatabaseLease<T> {
  database: T
  release(): Promise<void>
}

/** Serializa apertura/cierre y mantiene leases para los remontajes de React. */
export class DatabaseSessions<T extends { close(): Promise<void> }> {
  private active: { userId: string; database: T; leases: Set<symbol> } | null = null
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly open: (userId: string) => Promise<T>) {}

  acquire(userId: string): Promise<DatabaseLease<T>> {
    return this.enqueue(async () => {
      if (this.active && this.active.userId !== userId) await this.closeActive()
      if (!this.active) {
        const database = await this.open(userId)
        this.active = { userId, database, leases: new Set() }
      }
      const active = this.active
      const token = Symbol()
      active.leases.add(token)
      return {
        database: active.database,
        release: () => this.enqueue(async () => {
          if (this.active !== active || !active.leases.delete(token)) return
          if (active.leases.size === 0) await this.closeActive()
        }),
      }
    })
  }

  private async closeActive() {
    if (!this.active) return
    // Si close falla se conserva el estado; otra cuenta no puede abrir encima.
    await this.active.database.close()
    this.active = null
  }

  private enqueue<R>(operation: () => Promise<R>): Promise<R> {
    const result = this.queue.then(operation)
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }
}
