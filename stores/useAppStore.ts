import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

interface AppState {
  schemaVersions: Record<string, number>;
  currentBookDataSchemaVersion: number;
  isInitialized: boolean;
  initializeApp: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  schemaVersions: {},
  currentBookDataSchemaVersion: 1, // 👈 안전을 위한 기본값
  isInitialized: false,

  initializeApp: async () => {
    try {
      // 1. DB에서 스키마 버전 정보 가져오기
      const { data, error } = await supabase
        .from('app_metadata')
        .select('value')
        .eq('key', 'schema_versions')
        .single();

      if (error) throw error;
      
      const versions = data.value as Record<string, number>;

      // 2. 전역 상태 업데이트
      set({
        schemaVersions: versions,
        currentBookDataSchemaVersion: versions.book_data || 1, // DB에 값이 없을 경우 대비
        isInitialized: true,
      });

    } catch (error) {
      console.error("Failed to initialize app state and fetch schema versions:", error);
      // 에러 발생 시에도 앱이 멈추지 않도록 기본값으로 초기화
      set({ isInitialized: true });
    }
  },
}));