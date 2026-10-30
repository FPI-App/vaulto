// Sustituto de @powersync/react-native en web (alias en metro.config.js):
// el paquete nativo importa op-sqlite, que no existe en el navegador.
export * from '@powersync/web'
export { PowerSyncContext, usePowerSync, useQuery, useStatus } from '@powersync/react'
