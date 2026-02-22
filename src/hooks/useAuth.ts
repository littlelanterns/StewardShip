import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile } from '../lib/types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id).then((profile) => {
          setState({ user: session.user, profile, session, loading: false });
        });
      } else {
        setState({ user: null, profile: null, session: null, loading: false });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setState({ user: session.user, profile, session, loading: false });
        } else {
          setState({ user: null, profile: null, session: null, loading: false });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) return null;
    return data as UserProfile;
  }

  async function signUp(
    email: string,
    password: string,
    displayName: string
  ): Promise<{ error: string | null }> {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          timezone,
        },
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return { error: 'An account with this email already exists. Would you like to sign in instead?' };
      }
      return { error: error.message };
    }
    return { error: null };
  }

  async function signIn(
    email: string,
    password: string
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: 'Invalid email or password. Please try again.' };
    }
    return { error: null };
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  async function resetPassword(
    email: string
  ): Promise<{ error: string | null }> {
    await supabase.auth.resetPasswordForEmail(email);
    // Always return success — never reveal if email exists
    return { error: null };
  }

  async function refreshProfile(): Promise<void> {
    if (state.user) {
      const profile = await fetchProfile(state.user.id);
      setState((prev) => ({ ...prev, profile }));
    }
  }

  return {
    user: state.user,
    profile: state.profile,
    session: state.session,
    loading: state.loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    refreshProfile,
  };
}
