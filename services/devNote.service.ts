import { supabase } from '../lib/supabaseClient';
import { Database } from '../types';

type DevNote = Database['public']['Tables']['dev_notes']['Row'];
type DevNoteInsert = Database['public']['Tables']['dev_notes']['Insert'];
type DevNoteUpdate = Database['public']['Tables']['dev_notes']['Update'];

// 로컬 스토리지 키
const LOCAL_STORAGE_KEY = 'devNote';
const LOCAL_TIMESTAMP_KEY = 'devNote_timestamp';

export class DevNoteService {
  /**
   * 개발자 노트 조회 (서버 우선, 실패시 로컬 스토리지)
   */
  static async getDevNote(): Promise<{ content: string; lastModified: number; source: 'server' | 'local' }> {
    try {
      // 현재 사용자 확인
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // 비로그인 상태면 로컬 스토리지에서 가져오기
        return this.getLocalDevNote();
      }

      // 서버에서 노트 조회
      const { data, error } = await supabase
        .from('dev_notes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('서버에서 개발자 노트 조회 실패:', error);
        return this.getLocalDevNote();
      }

      if (data) {
        // 서버 데이터가 있으면 로컬과 동기화
        const serverTimestamp = new Date(data.updated_at).getTime();
        this.saveToLocalStorage(data.content, serverTimestamp);

        return {
          content: data.content,
          lastModified: serverTimestamp,
          source: 'server'
        };
      } else {
        // 서버에 데이터가 없으면 로컬 데이터 확인
        const localData = this.getLocalDevNote();

        // 로컬에 데이터가 있으면 서버에 업로드
        if (localData.content) {
          await this.createDevNote(localData.content);
        }

        return localData;
      }
    } catch (error) {
      console.error('개발자 노트 조회 중 오류:', error);
      return this.getLocalDevNote();
    }
  }

  /**
   * 개발자 노트 저장 (서버 우선, 실패시 로컬 스토리지)
   */
  static async saveDevNote(content: string): Promise<{ success: boolean; source: 'server' | 'local' }> {
    const timestamp = Date.now();

    try {
      // 현재 사용자 확인
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // 비로그인 상태면 로컬 스토리지에만 저장
        this.saveToLocalStorage(content, timestamp);
        return { success: true, source: 'local' };
      }

      // 기존 노트 확인
      const { data: existingNote } = await supabase
        .from('dev_notes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let result;

      if (existingNote) {
        // 업데이트
        result = await supabase
          .from('dev_notes')
          .update({ content })
          .eq('user_id', user.id)
          .select();
      } else {
        // 새로 생성
        result = await supabase
          .from('dev_notes')
          .insert({ user_id: user.id, content })
          .select();
      }

      if (result.error) {
        console.error('서버 저장 실패:', result.error);
        this.saveToLocalStorage(content, timestamp);
        return { success: true, source: 'local' };
      }

      // 성공시 로컬에도 백업
      this.saveToLocalStorage(content, timestamp);
      return { success: true, source: 'server' };

    } catch (error) {
      console.error('개발자 노트 저장 중 오류:', error);
      this.saveToLocalStorage(content, timestamp);
      return { success: true, source: 'local' };
    }
  }

  /**
   * 개발자 노트 생성
   */
  private static async createDevNote(content: string): Promise<DevNote | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      const { data, error } = await supabase
        .from('dev_notes')
        .insert({
          user_id: user.id,
          content,
          title: '개발자 노트'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('개발자 노트 생성 실패:', error);
      return null;
    }
  }

  /**
   * 로컬 스토리지에서 개발자 노트 조회
   */
  private static getLocalDevNote(): { content: string; lastModified: number; source: 'local' } {
    const content = localStorage.getItem(LOCAL_STORAGE_KEY) || '';
    const timestamp = parseInt(localStorage.getItem(LOCAL_TIMESTAMP_KEY) || '0', 10);

    return {
      content,
      lastModified: timestamp,
      source: 'local'
    };
  }

  /**
   * 로컬 스토리지에 개발자 노트 저장
   */
  private static saveToLocalStorage(content: string, timestamp: number): void {
    localStorage.setItem(LOCAL_STORAGE_KEY, content);
    localStorage.setItem(LOCAL_TIMESTAMP_KEY, timestamp.toString());
  }

  /**
   * 온라인 상태 확인 후 동기화
   */
  static async syncWhenOnline(): Promise<void> {
    if (!navigator.onLine) {
      return;
    }

    try {
      const localData = this.getLocalDevNote();
      if (localData.content && localData.lastModified > 0) {
        const serverData = await this.getDevNote();

        // 로컬이 더 최신이면 서버에 업로드
        if (localData.lastModified > serverData.lastModified) {
          await this.saveDevNote(localData.content);
        }
      }
    } catch (error) {
      console.error('동기화 중 오류:', error);
    }
  }

  /**
   * 사용자 로그아웃시 로컬 데이터 정리
   */
  static clearLocalData(): void {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LOCAL_TIMESTAMP_KEY);
  }
}