import React, { createContext, useContext } from 'react';

const DeudasSelectorsContext = createContext<any>(null);

export const DeudasSelectorsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DeudasSelectorsContext.Provider value={{}}>
      {children}
    </DeudasSelectorsContext.Provider>
  );
};

export const useDeudasSelectors = () => {
  const context = useContext(DeudasSelectorsContext);
  if (!context) {
    throw new Error('useDeudasSelectors debe usarse dentro de DeudasSelectorsProvider');
  }
  return context;
};
