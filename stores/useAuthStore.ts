
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { useUIStore } from './useUIStore';
import { markSignedIn } from '../utils/authFlags';

// 사용자가 직접 누른 로그아웃과, 토큰 만료로 세션이 끊긴 경우를 구분한다.
// 명시적 로그아웃은 Auth.tsx가 이미 토스트를 띄우므로 중복 알림을 막는다.
let isExplicitSignOut = false;

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
    isExplicitSignOut = true;
    const { error } = await supabase.auth.signOut();
    if (error) {
      // signOut이 실패하면 SIGNED_OUT 이벤트가 오지 않는다.
      // 플래그를 원복하지 않으면 true로 굳어 이후 진짜 만료 시 알림이 사라진다.
      isExplicitSignOut = false;
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
      // 로그인 이력 기록. SIGNED_IN만 보면 안 된다.
      // supabase-js는 로그인 상태로 페이지를 열면 INITIAL_SESSION, 토큰 갱신 시 TOKEN_REFRESHED를
      // 발생시키므로, SIGNED_IN 조건으로는 기존 로그인 사용자의 브라우저에 키가 남지 않는다.
      if (session) {
        markSignedIn();
      }

      set({ session, user: session?.user || null });

      // When a sign-in is complete, close the modal.
      if (event === 'SIGNED_IN') {
        useUIStore.getState().closeAuthModal();
      }

      // 세션이 끊겼을 때: 사용자가 직접 로그아웃한 경우는 Auth.tsx가 토스트를 띄우므로 건너뛴다.
      // 플래그가 서 있지 않으면 토큰 만료로 끊긴 것이므로 재로그인을 안내한다.
      if (event === 'SIGNED_OUT') {
        if (!isExplicitSignOut) {
          useUIStore.getState().setNotification({
            message: '로그인이 만료되었습니다. 다시 로그인해주세요.',
            type: 'info',
          });
        }
        isExplicitSignOut = false;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },
}));
