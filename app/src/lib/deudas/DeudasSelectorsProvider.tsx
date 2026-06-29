import React, { createContext, useContext } from 'react';
import { noopDeudasSelectors } from '@vaulto/shared';

const DeudasSelectorsContext = createContext<any>({});

export const DeudasSelectorsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DeudasSelectorsContext.Provider value={noopDeudasSelectors}>
      {children}
    </DeudasSelectorsContext.Provider>
  );
};

export const useDeudasSelectors = () => {
  const context = useContext(DeudasSelectorsContext);
  // Si context está vacío, retornamos noopDeudasSelectors para que no fallen los métodos como getTotalPorDireccion
  return Object.keys(context).length > 0 ? context : noopDeudasSelectors;
};
