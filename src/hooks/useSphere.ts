import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type {
  Person,
  SphereEntity,
  SphereEntityCategory,
  SphereLevel,
} from '../lib/types';
import { SPHERE_LEVEL_ORDER, SPHERE_LEVEL_LABELS } from '../lib/types';

export interface SphereData {
  levels: Record<SphereLevel, {
    people: Person[];
    entities: SphereEntity[];
  }>;
  unassigned: {
    people: Person[];
    entities: SphereEntity[];
  };
  focusCenter: {
    self: true;
    spouse: Person | null;
    god: boolean;
  };
}

export interface GapIndicator {
  hasGap: boolean;
  direction: 'inward' | 'outward' | null;
  description: string;
}

export function useSphere() {
  const { user } = useAuthContext();
  const [sphereEntities, setSphereEntities] = useState<SphereEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSphereEntities = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('sphere_entities')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('desired_sphere', { ascending: true })
        .order('name', { ascending: true });

      if (err) throw err;
      setSphereEntities((data as SphereEntity[]) || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createSphereEntity = useCallback(async (data: {
    name: string;
    entity_category: SphereEntityCategory;
    desired_sphere: SphereLevel;
    current_sphere?: SphereLevel;
    notes?: string;
  }): Promise<SphereEntity | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from('sphere_entities')
        .insert({
          user_id: user.id,
          name: data.name,
          entity_category: data.entity_category,
          desired_sphere: data.desired_sphere,
          current_sphere: data.current_sphere || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (err) throw err;
      const entity = result as SphereEntity;
      setSphereEntities((prev) => [...prev, entity]);
      return entity;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user]);

  const updateSphereEntity = useCallback(async (
    id: string,
    updates: Partial<Pick<SphereEntity, 'name' | 'entity_category' | 'desired_sphere' | 'current_sphere' | 'notes'>>
  ) => {
    if (!user) return;
    setError(null);
    setSphereEntities((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    try {
      const { error: err } = await supabase
        .from('sphere_entities')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
      fetchSphereEntities();
    }
  }, [user, fetchSphereEntities]);

  const archiveSphereEntity = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('sphere_entities')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
      setSphereEntities((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  const getSphereData = useCallback(async (people: Person[]): Promise<SphereData> => {
    // Initialize levels
    const levels = {} as SphereData['levels'];
    for (const level of SPHERE_LEVEL_ORDER) {
      levels[level] = { people: [], entities: [] };
    }

    // Group people by desired_sphere
    const unassignedPeople: Person[] = [];
    for (const person of people) {
      if (person.desired_sphere && levels[person.desired_sphere]) {
        levels[person.desired_sphere].people.push(person);
      } else {
        unassignedPeople.push(person);
      }
    }

    // Group entities by desired_sphere
    for (const entity of sphereEntities) {
      if (levels[entity.desired_sphere]) {
        levels[entity.desired_sphere].entities.push(entity);
      }
    }

    // Determine focus center
    const spouse = people.find((p) => p.is_first_mate) || null;

    // Check for faith Mast entries
    let hasFaith = false;
    if (user) {
      const { data: faithEntries } = await supabase
        .from('mast_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'faith_foundation')
        .is('archived_at', null)
        .limit(1);
      hasFaith = (faithEntries && faithEntries.length > 0) || false;
    }

    return {
      levels,
      unassigned: { people: unassignedPeople, entities: [] },
      focusCenter: {
        self: true,
        spouse,
        god: hasFaith,
      },
    };
  }, [user, sphereEntities]);

  const getGapIndicator = useCallback((
    item: { desired_sphere: SphereLevel | null; current_sphere: SphereLevel | null }
  ): GapIndicator => {
    if (!item.desired_sphere || !item.current_sphere) {
      return { hasGap: false, direction: null, description: '' };
    }
    if (item.desired_sphere === item.current_sphere) {
      return { hasGap: false, direction: null, description: '' };
    }

    const desiredIdx = SPHERE_LEVEL_ORDER.indexOf(item.desired_sphere);
    const currentIdx = SPHERE_LEVEL_ORDER.indexOf(item.current_sphere);

    if (currentIdx < desiredIdx) {
      return {
        hasGap: true,
        direction: 'inward',
        description: `Currently at ${SPHERE_LEVEL_LABELS[item.current_sphere]} — closer than intended (${SPHERE_LEVEL_LABELS[item.desired_sphere]})`,
      };
    }
    return {
      hasGap: true,
      direction: 'outward',
      description: `Currently at ${SPHERE_LEVEL_LABELS[item.current_sphere]} — further than intended (${SPHERE_LEVEL_LABELS[item.desired_sphere]})`,
    };
  }, []);

  return {
    sphereEntities,
    loading,
    error,
    fetchSphereEntities,
    createSphereEntity,
    updateSphereEntity,
    archiveSphereEntity,
    getSphereData,
    getGapIndicator,
  };
}
