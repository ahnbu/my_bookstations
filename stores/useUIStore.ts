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
  isAdminModalOpen: boolean;

  // Book Detail Modal state
  selectedBookIdForDetail: number | null;

  // Dev Tools Modal states
  isBulkSearchModalOpen: boolean;
  isAPITestModalOpen: boolean;
  isDevNoteModalOpen: boolean;

  // Welcome Modal state
  isWelcomeModalOpen: boolean;
  
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

  openAdminModal: () => void;
  closeAdminModal: () => void;

  // Book Detail Modal actions
  openMyLibraryBookDetailModal: (bookId: number) => void;
  closeMyLibraryBookDetailModal: () => void;

  // Dev Tools Modal actions
  openBulkSearchModal: () => void;
  closeBulkSearchModal: () => void;
  openAPITestModal: () => void;
  closeAPITestModal: () => void;
  openDevNoteModal: () => void;
  closeDevNoteModal: () => void;

  // Welcome Modal actions
  openWelcomeModal: () => void;
  closeWelcomeModal: () => void;

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
  isAdminModalOpen: false,
  selectedBookIdForDetail: null,
  isBulkSearchModalOpen: false,
  isAPITestModalOpen: false,
  isDevNoteModalOpen: false,
  isWelcomeModalOpen: false,
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

  openAdminModal: () => set({ isAdminModalOpen: true }),
  closeAdminModal: () => set({ isAdminModalOpen: false }),

  // Book Detail Modal implementations
  openMyLibraryBookDetailModal: (bookId) => set({ selectedBookIdForDetail: bookId }),
  closeMyLibraryBookDetailModal: () => set({ selectedBookIdForDetail: null }),

  // Dev Tools Modal implementations
  openBulkSearchModal: () => set({ isBulkSearchModalOpen: true }),
  closeBulkSearchModal: () => set({ isBulkSearchModalOpen: false }),
  openAPITestModal: () => set({ isAPITestModalOpen: true }),
  closeAPITestModal: () => set({ isAPITestModalOpen: false }),
  openDevNoteModal: () => set({ isDevNoteModalOpen: true }),
  closeDevNoteModal: () => set({ isDevNoteModalOpen: false }),

  // Welcome Modal implementations
  openWelcomeModal: () => set({ isWelcomeModalOpen: true }),
  closeWelcomeModal: () => set({ isWelcomeModalOpen: false }),

  setAPITestMode: (isAPITestMode) => set({ isAPITestMode }),
}));
