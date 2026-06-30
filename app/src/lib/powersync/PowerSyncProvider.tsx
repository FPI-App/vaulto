import React, { useEffect, useState } from 'react';
import { PowerSyncContext } from '@powersync/react-native';
import { db, setupPowerSync } from '../sync/db';

export const PowerSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    // Inicializar PowerSync y conectar con Supabase
    setupPowerSync()
      .then(() => {
        if (mounted) setIsReady(true);
      })
      .catch((err) => {
        console.error('Error inicializando PowerSync:', err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Mientras inicializa, no renderizamos los hijos (evita accesos prematuros a DB)
  if (!isReady) {
    return null; // Aquí podría ir un Loading / Splash Screen
  }

  return (
    <PowerSyncContext.Provider value={db}>
      {children}
    </PowerSyncContext.Provider>
  );
};
