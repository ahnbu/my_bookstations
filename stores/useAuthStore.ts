
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { useUIStore } from './useUIStore';

interface AuthState {
  session: Session | null;
  user: Session['user'] | null;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  initializeAuthListener: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
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

  deleteAccount: async () => {
    try {
      // 현재 사용자 정보 가져오기
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        return { success: false, error: '사용자 정보를 가져올 수 없습니다.' };
      }

      // Supabase Admin API를 통한 사용자 삭제 (RLS 정책에 의해 관련 데이터 자동 삭제)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

      if (deleteError) {
        console.error('Account deletion error:', deleteError);

        // Admin API가 사용할 수 없는 경우 일반 사용자 삭제 시도
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error('Sign out error during account deletion:', signOutError);
        }

        return {
          success: false,
          error: '계정 삭제 중 오류가 발생했습니다. 고객센터에 문의해주세요.'
        };
      }

      // 성공적으로 삭제된 경우 세션 정리
      set({ session: null });

      return { success: true };
    } catch (error) {
      console.error('Account deletion error:', error);
      return {
        success: false,
        error: '계정 삭제 중 예상치 못한 오류가 발생했습니다.'
      };
    }
  },
  initializeAuthListener: () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      set({ session, user: session?.user || null });

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
