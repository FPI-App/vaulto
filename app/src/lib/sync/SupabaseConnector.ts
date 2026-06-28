import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType
} from '@powersync/react-native';
import { supabase } from '../supabase';

export class SupabaseConnector implements PowerSyncBackendConnector {
  constructor() {}

  async fetchCredentials() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      throw new Error('No Supabase session available');
    }

    return {
      endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL || '',
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      return;
    }

    let lastOp: CrudEntry | null = null;
    try {
      for (let op of transaction.crud) {
        lastOp = op;
        const table = supabase.from(op.table);
        
        switch (op.op) {
          case UpdateType.PUT:
            const { id: putId, ...putData } = op.opData || {};
            await table.upsert({ id: op.id, ...putData }).throwOnError();
            break;
          case UpdateType.PATCH:
            const { id: patchId, ...patchData } = op.opData || {};
            await table.update(patchData).eq('id', op.id).throwOnError();
            break;
          case UpdateType.DELETE:
            await table.delete().eq('id', op.id).throwOnError();
            break;
        }
      }

      await transaction.complete();
    } catch (ex: any) {
      console.error('Error subiendo datos a Supabase', ex, 'Operation:', lastOp);
      throw ex;
    }
  }
}
