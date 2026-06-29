import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema } from '@vaulto/shared/powersync';
import { SupabaseConnector } from './SupabaseConnector';

import { OPSqliteOpenFactory } from '@powersync/op-sqlite';

const factory = new OPSqliteOpenFactory({
  dbFilename: 'vaulto.sqlite',
});

// Instancia global de la base de datos de PowerSync tipada automáticamente.
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: factory
});

export const supabaseConnector = new SupabaseConnector();

export const setupPowerSync = async () => {
  await db.init();
  await db.connect(supabaseConnector);
};
