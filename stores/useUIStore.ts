import { create } from 'zustand';

interface UIState {
  // Global loading states
  isLoading: boolean;
  
  // Notification state
  notification: { message: string; type: 'success' | 'error' | 'warning' } | null;
  
  // Modal states
  isBookSearchListModalOpen: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'signup';
  isProfileModalOpen: boolean;
  isSettingsModalOpen: boolean;
  isFeedbackModalOpen: boolean;
  
  // Context state
  isAPITestMode: boolean;

  // Actions
  setIsLoading: (isLoading: boolean) => void;
  setNotification: (notification: { message: string; type: 'success' | 'error' | 'warning' } | null) => void;
  
  openBookSearchListModal: () => void;
  closeBookSearchListModal: () => void;
  
  openAuthModal: (mode: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  switchAuthMode: (mode: 'login' | 'signup') => void;
  
  openProfileModal: () => void;
  closeProfileModal: () => void;
  
  openSettingsModal: () => void;
  closeSettingsModal: () => void;

  openFeedbackModal: () => void;
  closeFeedbackModal: () => void;

  setAPITestMode: (isAPITestMode: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  notification: null,
  isBookSearchListModalOpen: false,
  isAuthModalOpen: false,
  authModalMode: 'login',
  isProfileModalOpen: false,
  isSettingsModalOpen: false,
  isFeedbackModalOpen: false,
  isAPITestMode: false,

  setIsLoading: (isLoading) => set({ isLoading }),
  setNotification: (notification) => set({ notification }),
  
  openBookSearchListModal: () => set({ isBookSearchListModalOpen: true }),
  closeBookSearchListModal: () => set({ isBookSearchListModalOpen: false }),
  
  openAuthModal: (mode) => set({ isAuthModalOpen: true, authModalMode: mode }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  switchAuthMode: (mode) => set({ authModalMode: mode }),
  
  openProfileModal: () => set({ isProfileModalOpen: true }),
  closeProfileModal: () => set({ isProfileModalOpen: false }),
  
  openSettingsModal: () => set({ isSettingsModalOpen: true }),
  closeSettingsModal: () => set({ isSettingsModalOpen: false }),

  openFeedbackModal: () => set({ isFeedbackModalOpen: true }),
  closeFeedbackModal: () => set({ isFeedbackModalOpen: false }),

  setAPITestMode: (isAPITestMode) => set({ isAPITestMode }),
}));
