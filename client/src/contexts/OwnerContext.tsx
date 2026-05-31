import { createContext, useContext } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

interface OwnerContextValue {
  isOwner: boolean;
  isLoading: boolean;
}

const OwnerContext = createContext<OwnerContextValue>({
  isOwner: false,
  isLoading: true,
});

export function OwnerProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const isOwner = user?.role === "admin";

  return (
    <OwnerContext.Provider value={{ isOwner, isLoading: loading }}>
      {children}
    </OwnerContext.Provider>
  );
}

/**
 * useIsOwner — returns true only when the current user is the app owner (role='admin').
 * Non-authenticated visitors and regular users get false.
 */
export function useIsOwner(): boolean {
  return useContext(OwnerContext).isOwner;
}

export { OwnerContext };
