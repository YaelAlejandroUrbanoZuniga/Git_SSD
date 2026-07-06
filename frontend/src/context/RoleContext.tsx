// DEMO ONLY — in production, replace with real auth role
import { createContext, useContext, useState, ReactNode } from 'react';
import type { AppRole } from '../types';

interface RoleContextValue {
  activeRole: AppRole;
  setActiveRole: (role: AppRole) => void;
}

const RoleContext = createContext<RoleContextValue>({
  activeRole: 'SSD',
  setActiveRole: () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [activeRole, setActiveRole] = useState<AppRole>('SSD');

  return (
    <RoleContext.Provider value={{ activeRole, setActiveRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
