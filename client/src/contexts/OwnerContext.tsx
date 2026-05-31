import { createContext, useContext } from "react";

interface OwnerContextValue {
  isOwner: boolean;
  isLoading: boolean;
}

const OwnerContext = createContext<OwnerContextValue>({
  isOwner: true,
  isLoading: false,
});

// Always treat every visitor as owner — no login required
export function OwnerProvider({ children }: { children: React.ReactNode }) {
  return (
    <OwnerContext.Provider value={{ isOwner: true, isLoading: false }}>
      {children}
    </OwnerContext.Provider>
  );
}

export function useIsOwner(): boolean {
  return true;
}

export { OwnerContext };
