import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema } from '@vaulto/shared/powersync';
import { SupabaseConnector } from './SupabaseConnector';

// Instancia global de la base de datos de PowerSync tipada automáticamente.
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'vaulto.sqlite',
  },
});

export const supabaseConnector = new SupabaseConnector();

export const setupPowerSync = async () => {
  await db.init();
  await db.connect(supabaseConnector);
};
