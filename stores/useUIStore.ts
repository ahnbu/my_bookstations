import { create } from 'zustand';

interface UIState {
  // Global loading states
  isLoading: boolean;
  
  // Notification state
  notification: { message: string; type: 'success' | 'error' } | null;
  
  // Modal states
  isBookModalOpen: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'signup';
  
  // Context state
  isAPITestMode: boolean;

  // Actions
  setIsLoading: (isLoading: boolean) => void;
  setNotification: (notification: { message: string; type: 'success' | 'error' } | null) => void;
  
  openBookModal: () => void;
  closeBookModal: () => void;
  
  openAuthModal: (mode: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  switchAuthMode: (mode: 'login' | 'signup') => void;
  
  setAPITestMode: (isAPITestMode: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  notification: null,
  isBookModalOpen: false,
  isAuthModalOpen: false,
  authModalMode: 'login',
  isAPITestMode: false,

  setIsLoading: (isLoading) => set({ isLoading }),
  setNotification: (notification) => set({ notification }),
  
  openBookModal: () => set({ isBookModalOpen: true }),
  closeBookModal: () => set({ isBookModalOpen: false }),
  
  openAuthModal: (mode) => set({ isAuthModalOpen: true, authModalMode: mode }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  switchAuthMode: (mode) => set({ authModalMode: mode }),
  
  setAPITestMode: (isAPITestMode) => set({ isAPITestMode }),
}));
