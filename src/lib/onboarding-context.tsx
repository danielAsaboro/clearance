"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface OnboardingData {
  categories: string[];
  email: string;
  debtSources: string[];
  willingToDeclare: boolean | null;
  displayName: string;
  tiktokUsername: string;
  profilePhoto: string;
  consentAccepted: boolean;
}

const defaultData: OnboardingData = {
  categories: [],
  email: "",
  debtSources: [],
  willingToDeclare: null,
  displayName: "",
  tiktokUsername: "",
  profilePhoto: "",
  consentAccepted: false,
};

interface OnboardingContextType {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  resetData: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const STORAGE_KEY = "spotr-onboarding";

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>(defaultData);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) setData(JSON.parse(stored));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, loaded]);

  const updateData = (partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  };

  const resetData = () => {
    setData(defaultData);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  if (!loaded) return null;

  return (
    <OnboardingContext.Provider value={{ data, updateData, resetData }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
