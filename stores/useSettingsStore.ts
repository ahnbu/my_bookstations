import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { UserSettings } from '../types';

interface SettingsState {
  settings: UserSettings;
  loading: boolean;
  
  // Actions
  fetchUserSettings: () => Promise<void>;
  updateUserSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  resetSettings: () => void;
}

const defaultSettings: UserSettings = {
  showReadStatus: true,
  showRating: true,
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
}));