import { create } from "zustand";

interface FindingsSelectionState {
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
  setMany: (ids: string[]) => void;
  addMany: (ids: string[]) => void;
}

export const useFindingsSelection = create<FindingsSelectionState>((set) => ({
  selected: new Set<string>(),
  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selected: next };
    }),
  clear: () => set({ selected: new Set<string>() }),
  setMany: (ids) => set({ selected: new Set(ids) }),
  addMany: (ids) =>
    set((state) => {
      const next = new Set(state.selected);
      for (const id of ids) next.add(id);
      return { selected: next };
    }),
}));
