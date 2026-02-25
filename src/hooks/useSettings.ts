import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { UserProfile, UserSettings } from '../lib/types';

const DEBOUNCE_MS = 500;

export function useSettings() {
  const { user, profile, signOut, refreshProfile } = useAuthContext();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // --- Fetch Settings ---

  const fetchSettings = useCallback(async () => {
    if (!user) return null;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (err) throw err;
      const s = data as UserSettings;
      setSettings(s);
      return s;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // --- Update Profile ---

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (err) throw err;
      await refreshProfile();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update profile');
    }
  }, [user, refreshProfile]);

  const updateProfileDebounced = useCallback((field: string, value: unknown) => {
    if (debounceTimers.current[field]) {
      clearTimeout(debounceTimers.current[field]);
    }
    debounceTimers.current[field] = setTimeout(() => {
      updateProfile({ [field]: value } as Partial<UserProfile>);
    }, DEBOUNCE_MS);
  }, [updateProfile]);

  // --- Update Setting (single key) ---

  const updateSetting = useCallback(async (key: string, value: unknown) => {
    if (!user) return;
    setError(null);
    // Optimistic update
    setSettings(prev => prev ? { ...prev, [key]: value } as UserSettings : null);

    try {
      const { error: err } = await supabase
        .from('user_settings')
        .update({ [key]: value })
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update setting');
      // Revert on error
      fetchSettings();
    }
  }, [user, fetchSettings]);

  // --- Update Settings (batch) ---

  const updateSettings = useCallback(async (updates: Record<string, unknown>) => {
    if (!user) return;
    setError(null);
    // Optimistic update
    setSettings(prev => prev ? { ...prev, ...updates } as UserSettings : null);

    try {
      const { error: err } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update settings');
      fetchSettings();
    }
  }, [user, fetchSettings]);

  // --- Change Password ---

  const changePassword = useCallback(async (newPassword: string): Promise<{ error: string | null }> => {
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) return { error: err.message };
      return { error: null };
    } catch {
      return { error: 'Failed to change password. Please try again.' };
    }
  }, []);

  // --- Delete Account ---

  const deleteAccount = useCallback(async (): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' };
    try {
      const { error: err } = await supabase.rpc('delete_user_account');
      if (err) throw err;
      await signOut();
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : 'Failed to delete account' };
    }
  }, [user, signOut]);

  // --- API Key Operations ---

  const saveApiKey = useCallback(async (key: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' };
    try {
      // Base64 encode for basic obfuscation (stored server-side behind RLS)
      const encoded = btoa(key);
      const { error: err } = await supabase
        .from('user_settings')
        .update({ ai_api_key_encrypted: encoded })
        .eq('user_id', user.id);

      if (err) throw err;
      setSettings(prev => prev ? { ...prev, ai_api_key_encrypted: encoded } : null);
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : 'Failed to save API key' };
    }
  }, [user]);

  const clearApiKey = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('user_settings')
      .update({ ai_api_key_encrypted: null })
      .eq('user_id', user.id);

    setSettings(prev => prev ? { ...prev, ai_api_key_encrypted: null } : null);
  }, [user]);

  const testApiConnection = useCallback(async (
    provider: string,
    apiKey: string,
    model: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error: err } = await supabase.functions.invoke('chat', {
        body: {
          messages: [{ role: 'user', content: 'Say "Connection successful" in exactly two words.' }],
          model,
          provider,
          apiKey,
          max_tokens: 32,
          test_mode: true,
        },
      });

      if (err) return { success: false, error: err.message };
      if (data?.error) return { success: false, error: data.error };
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Connection test failed' };
    }
  }, []);

  // --- Data Export ---

  const exportAllData = useCallback(async (): Promise<Blob | null> => {
    if (!user) return null;
    setError(null);

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      const tables = [
        'user_profiles', 'user_settings',
        'mast_entries', 'keel_entries',
        'helm_conversations', 'helm_messages',
        'log_entries', 'compass_tasks',
        'lists', 'list_items',
        'goals', 'custom_trackers', 'tracker_entries',
        'victories',
        'wheel_instances', 'wheel_rim_entries',
        'life_inventory_areas', 'life_inventory_snapshots',
        'people', 'spouse_insights', 'spouse_prompts', 'crew_notes', 'sphere_entities',
        'manifest_items', 'ai_frameworks', 'ai_framework_principles',
        'rigging_plans', 'rigging_milestones', 'rigging_obstacles',
        'meetings', 'meeting_schedules', 'meeting_templates',
        'reminders', 'daily_rhythm_status', 'rhythm_status',
        'hold_dumps', 'cyrano_messages',
      ];

      for (const table of tables) {
        try {
          const { data } = await supabase
            .from(table)
            .select('*')
            .eq('user_id', user.id);

          zip.file(`${table}.json`, JSON.stringify(data || [], null, 2));
        } catch {
          // Some tables may not exist or have different structures
          zip.file(`${table}.json`, '[]');
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      return blob;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to export data');
      return null;
    }
  }, [user]);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return {
    profile,
    settings,
    loading,
    error,
    fetchSettings,
    updateProfile,
    updateProfileDebounced,
    updateSetting,
    updateSettings,
    changePassword,
    deleteAccount,
    saveApiKey,
    clearApiKey,
    testApiConnection,
    exportAllData,
    downloadBlob,
  };
}
