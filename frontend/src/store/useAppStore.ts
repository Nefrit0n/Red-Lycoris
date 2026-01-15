import { create } from "zustand";

export type Finding = {
  id: string;
  title: string;
  severity: string;
  status: string;
};

type AppState = {
  findings: Finding[];
  setFindings: (findings: Finding[]) => void;
};

export const useAppStore = create<AppState>((set) => ({
  findings: [],
  setFindings: (findings) => set({ findings }),
}));
