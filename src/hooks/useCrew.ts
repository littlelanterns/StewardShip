import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type {
  Person,
  CrewNote,
  CrewNoteCategory,
  CrewNoteSourceType,
  RelationshipType,
  ImportantDate,
} from '../lib/types';

export function useCrew() {
  const { user } = useAuthContext();
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [crewNotes, setCrewNotes] = useState<CrewNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPeople = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('people')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('is_first_mate', { ascending: false })
        .order('name', { ascending: true });

      if (err) throw err;
      setPeople((data as Person[]) || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchPerson = useCallback(async (id: string) => {
    if (!user) return null;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('people')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (err) throw err;
      const person = data as Person;
      setSelectedPerson(person);
      return person;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createPerson = useCallback(async (data: {
    name: string;
    relationship_type: RelationshipType;
    categories?: string[];
    notes?: string;
    age?: number;
    personality_summary?: string;
    love_language?: string;
    important_dates?: ImportantDate[];
  }): Promise<Person | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from('people')
        .insert({
          user_id: user.id,
          name: data.name,
          relationship_type: data.relationship_type,
          is_first_mate: false,
          categories: data.categories || [],
          notes: data.notes || null,
          age: data.age || null,
          personality_summary: data.personality_summary || null,
          love_language: data.love_language || null,
          important_dates: data.important_dates || null,
          has_rich_context: data.relationship_type === 'child',
          desired_sphere: null,
          current_sphere: null,
        })
        .select()
        .single();

      if (err) throw err;
      const person = result as Person;
      setPeople((prev) => [person, ...prev]);
      return person;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user]);

  const updatePerson = useCallback(async (
    id: string,
    updates: Partial<Pick<
      Person,
      | 'name'
      | 'relationship_type'
      | 'categories'
      | 'notes'
      | 'age'
      | 'personality_summary'
      | 'love_language'
      | 'important_dates'
      | 'has_rich_context'
      | 'desired_sphere'
      | 'current_sphere'
    >>
  ) => {
    if (!user) return;
    setError(null);
    // Optimistic update
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    if (selectedPerson?.id === id) {
      setSelectedPerson((prev) => prev ? { ...prev, ...updates } : prev);
    }
    try {
      const { error: err } = await supabase
        .from('people')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
      // Revert on failure
      fetchPeople();
    }
  }, [user, selectedPerson, fetchPeople]);

  const archivePerson = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('people')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
      setPeople((prev) => prev.filter((p) => p.id !== id));
      if (selectedPerson?.id === id) {
        setSelectedPerson(null);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user, selectedPerson]);

  const fetchCrewNotes = useCallback(async (personId: string, category?: CrewNoteCategory) => {
    if (!user) return;
    try {
      let query = supabase
        .from('crew_notes')
        .select('*')
        .eq('person_id', personId)
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setCrewNotes((data as CrewNote[]) || []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  const createCrewNote = useCallback(async (
    personId: string,
    data: {
      text: string;
      category: CrewNoteCategory;
      source_type?: CrewNoteSourceType;
      source_label?: string;
      source_reference_id?: string;
    }
  ) => {
    if (!user) return;
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from('crew_notes')
        .insert({
          user_id: user.id,
          person_id: personId,
          category: data.category,
          text: data.text,
          source_type: data.source_type || 'manual',
          source_label: data.source_label || null,
          source_reference_id: data.source_reference_id || null,
          file_storage_path: null,
        })
        .select()
        .single();

      if (err) throw err;
      const note = result as CrewNote;
      setCrewNotes((prev) => [note, ...prev]);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  const updateCrewNote = useCallback(async (
    id: string,
    updates: { text?: string; category?: CrewNoteCategory }
  ) => {
    if (!user) return;
    setError(null);
    // Optimistic update
    setCrewNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
    try {
      const { error: err } = await supabase
        .from('crew_notes')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
      // Refresh current person's notes
      if (selectedPerson) {
        await fetchCrewNotes(selectedPerson.id);
      }
    } catch (err) {
      setError((err as Error).message);
      // Revert on failure
      if (selectedPerson) {
        fetchCrewNotes(selectedPerson.id);
      }
    }
  }, [user, selectedPerson, fetchCrewNotes]);

  const archiveCrewNote = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('crew_notes')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
      setCrewNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  const searchPeopleByName = useCallback(async (query: string): Promise<Person[]> => {
    if (!user) return [];
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('people')
        .select('id, name, relationship_type, has_rich_context')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .ilike('name', `%${query}%`)
        .limit(10);

      if (err) throw err;
      return (data as Person[]) || [];
    } catch (err) {
      setError((err as Error).message);
      return [];
    }
  }, [user]);

  return {
    people,
    selectedPerson,
    crewNotes,
    loading,
    error,
    fetchPeople,
    fetchPerson,
    createPerson,
    updatePerson,
    archivePerson,
    fetchCrewNotes,
    createCrewNote,
    updateCrewNote,
    archiveCrewNote,
    searchPeopleByName,
    setSelectedPerson,
  };
}
