import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "@/lib/api";

export type BusinessType = "abarrotes" | "panaderia";

interface BusinessTypeContextType {
  businessType: BusinessType | null;
  loading: boolean;
  setBusinessType: (type: BusinessType) => Promise<void>;
}

const BusinessTypeContext = createContext<BusinessTypeContextType | null>(null);

export function BusinessTypeProvider({ children }: { children: ReactNode }) {
  const [businessType, setBusinessTypeState] = useState<BusinessType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBusinessType()
      .then((t) => {
        setBusinessTypeState(t as BusinessType | null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const setBusinessType = async (type: BusinessType) => {
    await api.setBusinessType(type);
    setBusinessTypeState(type);
  };

  return (
    <BusinessTypeContext.Provider value={{ businessType, loading, setBusinessType }}>
      {children}
    </BusinessTypeContext.Provider>
  );
}

export function useBusinessType() {
  const context = useContext(BusinessTypeContext);
  if (!context) {
    throw new Error("useBusinessType must be used within a BusinessTypeProvider");
  }
  return context;
}
