
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { useUIStore } from './useUIStore';

interface AuthState {
  session: Session | null;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  initializeAuthListener: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error.message);
    }
  },
  updatePassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  },
  initializeAuthListener: () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      set({ session });
      
      // When a sign-in is complete, close the modal.
      if (event === 'SIGNED_IN') {
        useUIStore.getState().closeAuthModal();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },
}));
