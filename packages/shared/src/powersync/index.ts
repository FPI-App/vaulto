// Punto de entrada del esquema de PowerSync (lado cliente).
//
// Reexporta el AppSchema y el tipo Database derivado. La app importa desde
// `@vaulto/shared` (que reexporta esto) para construir el PowerSyncDatabase.

export { AppSchema } from './schema'
export type { Database } from './schema'
