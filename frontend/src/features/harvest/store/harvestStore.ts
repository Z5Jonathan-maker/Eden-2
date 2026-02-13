import { create } from 'zustand';

interface HarvestState {
  selectedPin: string | null;
  mapCenter: [number, number];
  mapZoom: number;
  setSelectedPin: (pin: string | null) => void;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
}

export const useHarvestStore = create<HarvestState>((set) => ({
  selectedPin: null,
  mapCenter: [27.9506, -82.4572], // Tampa default
  mapZoom: 13,
  setSelectedPin: (pin) => set({ selectedPin: pin }),
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
}));
