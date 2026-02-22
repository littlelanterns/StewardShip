import { useState, useEffect, useRef } from 'react';
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
  const initialized = useRef(false);

  useEffect(() => {
    // onAuthStateChange fires immediately with INITIAL_SESSION,
    // so we don't need a separate getSession() call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] onAuthStateChange:', event, session ? 'session exists' : 'no session');

        if (session?.user) {
          // Avoid duplicate profile fetches from Strict Mode double-fire
          if (event === 'INITIAL_SESSION' && initialized.current) return;
          initialized.current = true;

          // Set user/session immediately so routing works
          setState((prev) => ({ ...prev, user: session.user, session, loading: false }));

          // Fetch profile OUTSIDE the callback to avoid Supabase client deadlock.
          // Supabase locks during onAuthStateChange — async calls inside it block all other queries.
          setTimeout(() => {
            fetchProfile(session.user.id).then((profile) => {
              if (profile) setState((prev) => ({ ...prev, profile }));
            }).catch(() => {
              // Profile fetch failed — user is still authenticated
            });
          }, 0);
        } else {
          initialized.current = true;
          setState({ user: null, profile: null, session: null, loading: false });
        }
      }
    );

    // Safety timeout — if onAuthStateChange never fires, stop loading after 5s
    const timeout = setTimeout(() => {
      if (initialized.current) return;
      setState((prev) => {
        if (prev.loading) {
          console.warn('[Auth] Timed out waiting for session, continuing without auth');
          return { user: null, profile: null, session: null, loading: false };
        }
        return prev;
      });
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
      initialized.current = false; // Reset for Strict Mode remount
    };
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
    try {
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
    } catch {
      return { error: 'Unable to connect. Please check your internet connection and try again.' };
    }
  }

  async function signIn(
    email: string,
    password: string
  ): Promise<{ error: string | null }> {
    try {
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (result.error) {
        return { error: 'Invalid email or password. Please try again.' };
      }
      return { error: null };
    } catch {
      return { error: 'Unable to connect. Please check your internet connection and try again.' };
    }
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
