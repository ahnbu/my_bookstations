import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { UserSettings, CustomTag, TagColor, SelectedBook, Theme } from '../types';

interface SettingsState {
  settings: UserSettings;
  loading: boolean;
  isCreatingSettings: boolean;

  // Actions
  fetchUserSettings: () => Promise<void>;
  updateUserSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  resetSettings: () => void;

  // Tag Management Actions
  createTag: (name: string, color: TagColor) => Promise<CustomTag>;
  updateTag: (tagId: string, updates: Partial<Pick<CustomTag, 'name' | 'color'>>) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  getTagUsageCount: (tagId: string, allBooks: SelectedBook[]) => number;
  exportToCSV: (books: SelectedBook[]) => void;

  // Theme Management Actions
  setTheme: (theme: Theme) => Promise<void>;
  getSystemTheme: () => 'light' | 'dark';
  applyTheme: (theme: Theme) => void;

  // Internal helper methods
  createDefaultSettingsForUser: (userId: string) => Promise<void>;
}

const getDefaultSettings = (): UserSettings => {
  // 관리자가 설정한 기본값 확인
  const adminDefaults = localStorage.getItem('adminDefaultSettings');
  if (adminDefaults) {
    try {
      return JSON.parse(adminDefaults);
    } catch (error) {
      console.error('관리자 기본값 파싱 실패:', error);
    }
  }

  // 기본값 (fallback)
  return {
    showReadStatus: true,
    showRating: true,
    showTags: true,
    showLibraryStock: true,
    showFavorites: true,
    showBookNotes: true,
    defaultPageSize: 50,
    tagSettings: {
      tags: [
        {
          id: 'default_personal',
          name: '개인',
          color: 'primary',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      ],
      maxTags: 5,
    },
    theme: 'system',
  };
};

const defaultSettings: UserSettings = getDefaultSettings();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: false,
  isCreatingSettings: false,

  fetchUserSettings: async () => {
    const { loading, isCreatingSettings } = get();

    // 이미 로딩 중이거나 생성 중인 경우 중복 호출 방지
    if (loading || isCreatingSettings) {
      return;
    }

    set({ loading: true });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ settings: defaultSettings, loading: false });
        return;
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.log('Supabase error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          fullError: error
        });

        if (error.code === 'PGRST116') {
          // No settings found, create default settings
          console.log('No settings found for user, creating default settings');
          await get().createDefaultSettingsForUser(user.id);
        } else {
          console.error('Error fetching user settings:', error);
          // 406 에러나 다른 에러의 경우에도 기본 설정 생성 시도
          console.log('Attempting to create default settings for any error');
          await get().createDefaultSettingsForUser(user.id);
        }
        return;
      }

      set({
        settings: data?.settings || getDefaultSettings(),
        loading: false
      });
    } catch (error) {
      console.error('Error in fetchUserSettings:', error);
      const currentDefaultSettings = getDefaultSettings();
      set({ settings: currentDefaultSettings, loading: false });
    }
  },

  createDefaultSettingsForUser: async (userId: string) => {
    const { isCreatingSettings } = get();

    // 이미 생성 중인 경우 중복 방지
    if (isCreatingSettings) {
      return;
    }

    set({ isCreatingSettings: true });

    try {
      const currentDefaultSettings = getDefaultSettings();

      const { error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          settings: currentDefaultSettings,
        });

      if (insertError) {
        // 409 Conflict (중복 키) 에러인 경우 기존 설정 조회
        if (insertError.code === '23505') {
          console.log('Settings already exist for user, fetching existing settings');

          const { data, error: fetchError } = await supabase
            .from('user_settings')
            .select('settings')
            .eq('user_id', userId)
            .single();

          if (fetchError) {
            console.error('Error fetching existing settings after conflict:', fetchError);
            set({ settings: currentDefaultSettings, loading: false, isCreatingSettings: false });
          } else {
            set({ settings: data?.settings || currentDefaultSettings, loading: false, isCreatingSettings: false });
          }
        } else {
          console.error('Error creating default settings:', insertError);
          set({ settings: currentDefaultSettings, loading: false, isCreatingSettings: false });
        }
      } else {
        console.log('Default settings created successfully for new user');
        set({ settings: currentDefaultSettings, loading: false, isCreatingSettings: false });
      }
    } catch (error) {
      console.error('Error in createDefaultSettingsForUser:', error);
      const currentDefaultSettings = getDefaultSettings();
      set({ settings: currentDefaultSettings, loading: false, isCreatingSettings: false });
    }
  },

  updateUserSettings: async (newSettings: Partial<UserSettings>) => {
    const currentSettings = get().settings;
    const updatedSettings = { ...currentSettings, ...newSettings };
    
    // Optimistically update local state
    set({ settings: updatedSettings });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings: updatedSettings,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating user settings:', error);
        // Revert optimistic update on error
        set({ settings: currentSettings });
        throw error;
      }
    } catch (error) {
      console.error('Error in updateUserSettings:', error);
      // Revert optimistic update on error
      set({ settings: currentSettings });
      throw error;
    }
  },

  resetSettings: () => {
    set({ settings: getDefaultSettings() });
  },

  // Tag Management Implementation
  createTag: async (name: string, color: TagColor) => {
    const currentSettings = get().settings;
    const newTag: CustomTag = {
      id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedTags = [...currentSettings.tagSettings.tags, newTag];
    const updatedSettings = {
      ...currentSettings,
      tagSettings: {
        ...currentSettings.tagSettings,
        tags: updatedTags,
      },
    };

    // Optimistically update local state
    set({ settings: updatedSettings });

    try {
      await get().updateUserSettings({ tagSettings: updatedSettings.tagSettings });
      return newTag;
    } catch (error) {
      // Revert on error
      set({ settings: currentSettings });
      throw error;
    }
  },

  updateTag: async (tagId: string, updates: Partial<Pick<CustomTag, 'name' | 'color'>>) => {
    const currentSettings = get().settings;
    const updatedTags = currentSettings.tagSettings.tags.map(tag =>
      tag.id === tagId
        ? { ...tag, ...updates, updatedAt: Date.now() }
        : tag
    );

    const updatedSettings = {
      ...currentSettings,
      tagSettings: {
        ...currentSettings.tagSettings,
        tags: updatedTags,
      },
    };

    // Optimistically update local state
    set({ settings: updatedSettings });

    try {
      await get().updateUserSettings({ tagSettings: updatedSettings.tagSettings });
    } catch (error) {
      // Revert on error
      set({ settings: currentSettings });
      throw error;
    }
  },

  deleteTag: async (tagId: string) => {
    const currentSettings = get().settings;
    const updatedTags = currentSettings.tagSettings.tags.filter(tag => tag.id !== tagId);

    const updatedSettings = {
      ...currentSettings,
      tagSettings: {
        ...currentSettings.tagSettings,
        tags: updatedTags,
      },
    };

    // Optimistically update local state
    set({ settings: updatedSettings });

    try {
      await get().updateUserSettings({ tagSettings: updatedSettings.tagSettings });
    } catch (error) {
      // Revert on error
      set({ settings: currentSettings });
      throw error;
    }
  },

  getTagUsageCount: (tagId: string, allBooks: SelectedBook[]) => {
    return allBooks.filter(book => book.customTags?.includes(tagId)).length;
  },

  exportToCSV: (books: SelectedBook[]) => {
    const currentSettings = get().settings;
    const { tags } = currentSettings.tagSettings;

    const csvContent = [
      // CSV Header
      ['제목', '저자', '출간일', 'ISBN13', '별점', '읽음상태', '태그', '추가일'].join(','),
      // CSV Data
      ...books.map(book => {
        const bookTags = book.customTags?.map(tagId =>
          tags.find(tag => tag.id === tagId)?.name || tagId
        ).join(' | ') || '';

        return [
          `"${book.title.replace(/"/g, '""')}"`,
          `"${book.author.replace(/"/g, '""')}"`,
          book.pubDate,
          book.isbn13,
          book.rating,
          book.readStatus,
          `"${bookTags}"`,
          new Date(book.addedDate).toISOString().split('T')[0]
        ].join(',');
      })
    ].join('\n');

    // Download CSV file
    // [수정] UTF-8 BOM('\uFEFF')을 csvContent 앞에 추가하여 Excel 호환성 확보
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    // const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `내서재_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // Theme Management Implementation
  getSystemTheme: () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark'; // default fallback
  },

  applyTheme: (theme: Theme) => {
    const { getSystemTheme } = get();
    const actualTheme = theme === 'system' ? getSystemTheme() : theme;

    const body = document.body;
    if (actualTheme === 'dark') {
      body.classList.add('dark');
      body.classList.remove('light');
    } else {
      body.classList.add('light');
      body.classList.remove('dark');
    }
  },

  setTheme: async (theme: Theme) => {
    const { applyTheme, updateUserSettings } = get();

    // Apply theme immediately
    applyTheme(theme);

    // Save to database
    try {
      await updateUserSettings({ theme });
    } catch (error) {
      console.error('Failed to save theme:', error);
      throw error;
    }
  },
}));