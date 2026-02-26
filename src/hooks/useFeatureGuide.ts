import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';

interface FeatureGuideState {
  show_feature_guides: boolean;
  dismissed_guides: string[];
  loaded: boolean;
}

// Module-level cache so we only fetch once per session
let cachedState: FeatureGuideState | null = null;
let fetchPromise: Promise<FeatureGuideState | null> | null = null;

export function useFeatureGuide(featureKey: string) {
  const { user } = useAuthContext();
  const [state, setState] = useState<FeatureGuideState>(
    cachedState || { show_feature_guides: true, dismissed_guides: [], loaded: false }
  );
  const [hiding, setHiding] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (cachedState) {
      setState(cachedState);
      return;
    }

    // Deduplicate concurrent fetches
    if (!fetchPromise) {
      fetchPromise = Promise.resolve(
        supabase
          .from('user_settings')
          .select('show_feature_guides, dismissed_guides')
          .eq('user_id', user.id)
          .single()
      )
        .then(({ data }) => {
          const result: FeatureGuideState = {
            show_feature_guides: data?.show_feature_guides ?? true,
            dismissed_guides: data?.dismissed_guides ?? [],
            loaded: true,
          };
          cachedState = result;
          fetchPromise = null;
          return result;
        })
        .catch(() => {
          fetchPromise = null;
          return null;
        });
    }

    fetchPromise!.then((result) => {
      if (result && mountedRef.current) {
        setState(result);
      }
    });
  }, [user]);

  const shouldShow = state.loaded && state.show_feature_guides && !state.dismissed_guides.includes(featureKey);

  const dismiss = useCallback(async () => {
    if (!user) return;
    setHiding(true);

    const newDismissed = [...state.dismissed_guides, featureKey];
    const newState = { ...state, dismissed_guides: newDismissed };
    cachedState = newState;
    setState(newState);

    // Wait for animation then persist
    setTimeout(async () => {
      await supabase
        .from('user_settings')
        .update({ dismissed_guides: newDismissed })
        .eq('user_id', user.id);
    }, 250);
  }, [user, state, featureKey]);

  const hideAll = useCallback(async () => {
    if (!user) return;
    setHiding(true);

    const newState = { ...state, show_feature_guides: false };
    cachedState = newState;
    setState(newState);

    setTimeout(async () => {
      await supabase
        .from('user_settings')
        .update({ show_feature_guides: false })
        .eq('user_id', user.id);
    }, 250);
  }, [user, state]);

  return { shouldShow, hiding, dismiss, hideAll };
}

// Reset cache (for Settings "Reset All Guides")
export function resetFeatureGuideCache() {
  cachedState = null;
  fetchPromise = null;
}
