import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, setupPowerSync } from '../sync/db';

const PowerSyncContext = createContext<typeof db | null>(null);

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

export const usePowerSync = () => {
  const context = useContext(PowerSyncContext);
  if (!context) {
    throw new Error('usePowerSync debe usarse dentro de un PowerSyncProvider');
  }
  return context;
};
