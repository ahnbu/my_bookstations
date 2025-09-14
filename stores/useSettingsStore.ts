import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { UserSettings, CustomTag, TagColor, SelectedBook, Theme } from '../types';

interface SettingsState {
  settings: UserSettings;
  loading: boolean;

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
}

const defaultSettings: UserSettings = {
  showReadStatus: true,
  showRating: true,
  showTags: true,
  showLibraryStock: true,
  tagSettings: {
    tags: [],
    maxTags: 5,
  },
  theme: 'system',
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: false,

  fetchUserSettings: async () => {
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
        if (error.code === 'PGRST116') {
          // No settings found, create default settings
          const { error: insertError } = await supabase
            .from('user_settings')
            .insert({
              user_id: user.id,
              settings: defaultSettings,
            });

          if (insertError) {
            console.error('Error creating default settings:', insertError);
          }
          
          set({ settings: defaultSettings, loading: false });
        } else {
          console.error('Error fetching user settings:', error);
          set({ settings: defaultSettings, loading: false });
        }
        return;
      }

      set({ 
        settings: data?.settings || defaultSettings, 
        loading: false 
      });
    } catch (error) {
      console.error('Error in fetchUserSettings:', error);
      set({ settings: defaultSettings, loading: false });
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
    set({ settings: defaultSettings });
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
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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