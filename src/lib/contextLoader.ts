import { supabase } from './supabase';
import type { MastEntry, KeelEntry, LogEntry, Victory, CompassTask, GuidedMode, GuidedSubtype, HelmMessage, WheelInstance, LifeInventoryArea, RiggingPlan, Person, SpouseInsight, SphereEntity, ManifestSearchResult, Meeting, CrewNote, MeetingAgendaItem, MeetingTemplateSection } from './types';
import { SPOKE_LABELS, PLANNING_FRAMEWORK_LABELS, CREW_NOTE_CATEGORY_LABELS } from './types';
import { searchManifest } from './rag';
import {
  shouldLoadKeel,
  shouldLoadLog,
  shouldLoadCompass,
  shouldLoadVictories,
  shouldLoadCharts,
  shouldLoadDashboard,
  shouldLoadReveille,
  shouldLoadReckoning,
  shouldLoadWheel,
  shouldLoadLifeInventory,
  shouldLoadRigging,
  shouldLoadFirstMate,
  shouldLoadCrew,
  shouldLoadSphere,
  shouldLoadFrameworks,
  shouldLoadManifest,
  shouldLoadMeeting,
  shouldLoadReflections,
  shouldLoadHatch,
  shouldLoadAppGuide,
  formatFirstMateContext,
  formatCrewContext,
  formatSphereContext,
  formatFrameworksContext,
  formatManifestContext,
  formatMeetingContext,
  formatReflectionsContext,
  formatHatchContext,
  type SystemPromptContext,
  type GuidedModeContext,
} from './systemPrompt';
import { getAppGuideContext } from './appGuide';

interface LoadContextOptions {
  message: string;
  pageContext: string;
  userId: string;
  guidedMode?: GuidedMode;
  guidedSubtype?: GuidedSubtype;
  guidedModeContext?: GuidedModeContext;
  conversationHistory: HelmMessage[];
  contextBudget?: 'short' | 'medium' | 'long';
}

export async function loadContext(options: LoadContextOptions): Promise<SystemPromptContext> {
  const {
    message,
    pageContext,
    userId,
    guidedMode,
    guidedSubtype,
    guidedModeContext,
    conversationHistory,
    contextBudget = 'medium',
  } = options;

  // Always fetch: user profile and Mast entries
  const [profileResult, mastResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('mast_entries')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
  ]);

  const displayName = profileResult.data?.display_name || '';
  const mastEntries = (mastResult.data as MastEntry[]) || [];

  // Conditionally fetch based on keyword detection
  const needKeel = shouldLoadKeel(message, pageContext, guidedMode);
  const needLog = shouldLoadLog(message, pageContext) || pageContext === 'reveille' || pageContext === 'reckoning';
  const needCompass = shouldLoadCompass(message, pageContext) || pageContext === 'reveille' || pageContext === 'reckoning';
  const needVictories = shouldLoadVictories(message, pageContext);
  const needCharts = shouldLoadCharts(message, pageContext);
  const needDashboard = shouldLoadDashboard(message, pageContext);
  const needReveille = shouldLoadReveille(pageContext);
  const needReckoning = shouldLoadReckoning(pageContext);
  const needWheel = shouldLoadWheel(message, pageContext);
  const needLifeInventory = shouldLoadLifeInventory(message, pageContext);
  const needRigging = shouldLoadRigging(message, pageContext);
  const needFirstMate = shouldLoadFirstMate(message, pageContext, guidedMode);
  let needCrew = shouldLoadCrew(message, pageContext, guidedMode);
  const needSphere = shouldLoadSphere(message, pageContext);
  const needFrameworks = shouldLoadFrameworks(message, pageContext, guidedMode);
  const needManifest = shouldLoadManifest(message, pageContext, guidedMode);
  const needMeeting = shouldLoadMeeting(message, pageContext, guidedMode);
  const needReflections = shouldLoadReflections(message, pageContext);
  const needHatch = shouldLoadHatch(message, pageContext);
  const needAppGuide = shouldLoadAppGuide(message, pageContext);

  // Name recognition: lightweight fetch of all crew names to detect mentions
  let detectedCrewNames: string[] = [];
  if (!needCrew && message.trim()) {
    const { data: crewNames } = await supabase
      .from('people')
      .select('name')
      .eq('user_id', userId)
      .is('archived_at', null);
    if (crewNames && crewNames.length > 0) {
      const messageLower = message.toLowerCase();
      detectedCrewNames = (crewNames as { name: string }[])
        .filter((p) => {
          const nameRegex = new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          return nameRegex.test(messageLower);
        })
        .map((p) => p.name);
      if (detectedCrewNames.length > 0) {
        needCrew = true;
      }
    }
  }

  let keelEntries: KeelEntry[] | undefined;
  let recentLogEntries: LogEntry[] | undefined;
  let compassContext: string | undefined;
  let recentVictories: Victory[] | undefined;
  let chartsContext: string | undefined;
  let dashboardContext: string | undefined;
  let reveilleContext: string | undefined;
  let reckoningContext: string | undefined;
  let wheelContext: string | undefined;
  let lifeInventoryContext: string | undefined;
  let riggingContext: string | undefined;
  let firstMateContext: string | undefined;
  let crewContext: string | undefined;
  let sphereContext: string | undefined;
  let frameworksContext: string | undefined;
  let manifestContext: string | undefined;
  let cyranoContext: string | undefined;
  let higginsContext: string | undefined;
  let meetingContext: string | undefined;
  let meetingSections: MeetingTemplateSection[] | undefined;
  let reflectionsContext: string | undefined;
  let hatchContext: string | undefined;
  let appGuideContext: string | undefined;

  // Fetch conditional data in parallel
  const keelPromise = needKeel
    ? supabase
        .from('keel_entries')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('sort_order', { ascending: true })
    : null;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const logPromise = needLog
    ? supabase
        .from('log_entries')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10)
    : null;

  const today = new Date().toISOString().split('T')[0];
  const compassPromise = needCompass
    ? supabase
        .from('compass_tasks')
        .select('title, status, life_area_tag, due_date, recurrence_rule')
        .eq('user_id', userId)
        .eq('due_date', today)
        .is('archived_at', null)
        .order('sort_order')
    : null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const victoriesPromise = needVictories
    ? supabase
        .from('victories')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10)
    : null;

  const wheelPromise = needWheel
    ? supabase
        .from('wheel_instances')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .in('status', ['in_progress', 'active'])
        .order('updated_at', { ascending: false })
        .limit(5)
    : null;

  const lifeInvPromise = needLifeInventory
    ? supabase
        .from('life_inventory_areas')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true })
    : null;

  const riggingPromise = needRigging
    ? supabase
        .from('rigging_plans')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .in('status', ['active', 'paused'])
        .order('updated_at', { ascending: false })
        .limit(5)
    : null;

  const firstMatePromise = needFirstMate
    ? supabase
        .from('people')
        .select('*')
        .eq('user_id', userId)
        .eq('is_first_mate', true)
        .is('archived_at', null)
        .maybeSingle()
    : null;

  const spouseInsightsPromise = needFirstMate
    ? supabase
        .from('spouse_insights')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
    : null;

  const crewPromise = needCrew
    ? supabase
        .from('people')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('name')
        .limit(50)
    : null;

  const sphereEntitiesPromise = needSphere
    ? supabase
        .from('sphere_entities')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('desired_sphere')
        .order('name')
    : null;

  const frameworksPromise = needFrameworks
    ? supabase
        .from('ai_frameworks')
        .select('*, ai_framework_principles(*)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .is('archived_at', null)
    : null;

  // Meeting context — previous meetings for the current type/person
  const meetingPromise = needMeeting
    ? supabase
        .from('meetings')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('meeting_date', { ascending: false })
        .limit(3)
    : null;

  // Agenda items — pending items users have queued between meetings
  const agendaPromise = needMeeting
    ? supabase
        .from('meeting_agenda_items')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('sort_order', { ascending: true })
    : null;

  // Meeting template sections — user's customized agenda sections for the meeting subtype
  const meetingSubtype = guidedMode === 'meeting' ? (guidedSubtype || 'weekly_review') : null;
  const meetingSectionsPromise = meetingSubtype
    ? (() => {
        let q = supabase
          .from('meeting_template_sections')
          .select('*')
          .eq('user_id', userId)
          .eq('meeting_type', meetingSubtype)
          .is('archived_at', null)
          .order('sort_order', { ascending: true });
        // For custom types with a template_id from guided mode context
        if (meetingSubtype === 'custom' && guidedModeContext?.manifest_item_id) {
          q = q.eq('template_id', guidedModeContext.manifest_item_id);
        } else {
          q = q.is('template_id', null);
        }
        return q;
      })()
    : null;

  const reflectionsPromise = needReflections
    ? supabase
        .from('reflection_responses')
        .select('response_text, response_date, question_id, reflection_questions(question_text)')
        .eq('user_id', userId)
        .order('response_date', { ascending: false })
        .limit(10)
    : null;

  const hatchPromise = needHatch
    ? supabase
        .from('hatch_tabs')
        .select('title, content')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('sort_order', { ascending: true })
        .limit(5)
    : null;

  // Manifest RAG search — depth varies by mode
  const isManifestDiscuss = guidedMode === 'manifest_discuss';
  let manifestPromise: Promise<ManifestSearchResult[]> | null = null;

  if (needManifest && message.trim()) {
    if (isManifestDiscuss && guidedModeContext?.manifest_item_id) {
      // "Discuss This" mode: 8 chunks from specific item + 3 from other sources
      manifestPromise = Promise.all([
        searchManifest(message, userId, {
          matchCount: 8,
          matchThreshold: 0.5,
          manifestItemId: guidedModeContext.manifest_item_id,
        }),
        searchManifest(message, userId, {
          matchCount: 3,
          matchThreshold: 0.6,
          excludeItemId: guidedModeContext.manifest_item_id,
        }),
      ]).then(([focused, broader]) => [...focused, ...broader]);
    } else if (isManifestDiscuss) {
      // "Ask Your Library" mode: 10 from entire library
      manifestPromise = searchManifest(message, userId, {
        matchCount: 10,
        matchThreshold: 0.5,
      });
    } else {
      // Standard RAG: 3-5 from library, higher threshold
      manifestPromise = searchManifest(message, userId, {
        matchCount: 5,
        matchThreshold: 0.7,
      });
    }
  }

  const [keelResult, logResult, compassResult, victoriesResult, wheelResult, lifeInvResult, riggingResult, firstMateResult, spouseInsightsResult, crewResult, sphereEntitiesResult, frameworksResult, manifestResults, meetingResult, agendaResult, reflectionsResult, hatchResult, meetingSectionsResult] = await Promise.all([
    keelPromise,
    logPromise,
    compassPromise,
    victoriesPromise,
    wheelPromise,
    lifeInvPromise,
    riggingPromise,
    firstMatePromise,
    spouseInsightsPromise,
    crewPromise,
    sphereEntitiesPromise,
    frameworksPromise,
    manifestPromise,
    meetingPromise,
    agendaPromise,
    reflectionsPromise,
    hatchPromise,
    meetingSectionsPromise,
  ]);

  if (keelResult?.data) {
    keelEntries = keelResult.data as KeelEntry[];
  }
  if (logResult?.data) {
    recentLogEntries = logResult.data as LogEntry[];
  }
  if (compassResult?.data && compassResult.data.length > 0) {
    compassContext = formatCompassContext(compassResult.data as CompassTask[]);
  }
  if (victoriesResult?.data) {
    recentVictories = victoriesResult.data as Victory[];
  }
  if (wheelResult?.data && wheelResult.data.length > 0) {
    wheelContext = buildWheelContext(wheelResult.data as WheelInstance[]);
  }
  if (lifeInvResult?.data && lifeInvResult.data.length > 0) {
    lifeInventoryContext = buildLifeInventoryContext(lifeInvResult.data as LifeInventoryArea[]);
  }
  if (riggingResult?.data && riggingResult.data.length > 0) {
    riggingContext = buildRiggingContext(riggingResult.data as RiggingPlan[]);
  }
  // Meeting context — format previous meetings
  if (meetingResult?.data && meetingResult.data.length > 0) {
    const recentMeetings = meetingResult.data as Meeting[];
    // Resolve person names for meetings
    const meetingPersonIds = [...new Set(recentMeetings.filter(m => m.related_person_id).map(m => m.related_person_id!))];
    let meetingPersonMap: Record<string, string> = {};
    if (meetingPersonIds.length > 0) {
      const { data: mPeople } = await supabase
        .from('people')
        .select('id, name')
        .in('id', meetingPersonIds);
      for (const p of (mPeople || []) as { id: string; name: string }[]) {
        meetingPersonMap[p.id] = p.name;
      }
    }
    meetingContext = formatMeetingContext(
      recentMeetings.map(m => ({
        meeting_type: m.meeting_type,
        meeting_date: m.meeting_date,
        summary: m.summary,
        person_name: m.related_person_id ? meetingPersonMap[m.related_person_id] : undefined,
      })),
    );
  }

  // Append pending agenda items to meeting context
  if (agendaResult?.data && agendaResult.data.length > 0) {
    const agendaItems = agendaResult.data as MeetingAgendaItem[];
    const agendaSection = formatAgendaItems(agendaItems);
    if (agendaSection) {
      meetingContext = (meetingContext || '') + agendaSection;
    }
  }

  // Meeting template sections — pass to systemPrompt for dynamic agenda
  if (meetingSectionsResult?.data && meetingSectionsResult.data.length > 0) {
    meetingSections = meetingSectionsResult.data as MeetingTemplateSection[];
  }

  if (firstMateResult?.data) {
    const spouse = firstMateResult.data as Person;
    const insights = (spouseInsightsResult?.data as SpouseInsight[]) || [];
    firstMateContext = formatFirstMateContext(spouse.name, insights);
  }

  // Cyrano context — load recent teaching skills for rotation when in Cyrano mode
  if (guidedMode === 'first_mate_action' && guidedSubtype === 'cyrano') {
    const [skillsResult, countResult] = await Promise.all([
      supabase
        .from('cyrano_messages')
        .select('teaching_skill')
        .eq('user_id', userId)
        .not('teaching_skill', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('cyrano_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    const recentSkills = (skillsResult.data || [])
      .map((s: { teaching_skill: string }) => s.teaching_skill)
      .filter(Boolean);
    const totalCount = countResult.count || 0;

    let ctx = '\n\nCYRANO COACHING CONTEXT:';
    if (recentSkills.length > 0) {
      ctx += `\nRecent teaching skills used (avoid repeating the most recent): ${recentSkills.join(', ')}`;
    } else {
      ctx += '\nThis may be their first Cyrano interaction. Start with the basics.';
    }
    if (totalCount >= 5) {
      ctx += `\nThe user has used Cyrano ${totalCount} times. You may occasionally offer "skill check" mode — let them write first, then give feedback instead of rewriting.`;
    }
    cyranoContext = ctx;
  }

  // Higgins context — load recent teaching skills and crew notes for person(s)
  if (guidedMode === 'crew_action') {
    const primaryPersonId = guidedModeContext?.people_id;
    const extraPeopleIds = guidedModeContext?.higgins_people_ids || [];
    // Combine: primary ID + any extra IDs, deduplicated
    const allPeopleIds = [...new Set([...(primaryPersonId ? [primaryPersonId] : []), ...extraPeopleIds])];

    if (allPeopleIds.length > 0) {
      // Fetch teaching skills (global, not per-person)
      const [skillsResult, ...personResults] = await Promise.all([
        supabase
          .from('higgins_messages')
          .select('teaching_skill')
          .eq('user_id', userId)
          .not('teaching_skill', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10),
        // For each person, fetch notes + profile in parallel
        ...allPeopleIds.flatMap((pid) => [
          supabase
            .from('crew_notes')
            .select('*')
            .eq('user_id', userId)
            .eq('person_id', pid)
            .is('archived_at', null)
            .order('category')
            .order('created_at', { ascending: false }),
          supabase
            .from('people')
            .select('*')
            .eq('id', pid)
            .eq('user_id', userId)
            .maybeSingle(),
        ]),
      ]);

      const recentSkills = (skillsResult.data || [])
        .map((s: { teaching_skill: string }) => s.teaching_skill)
        .filter(Boolean);

      let ctx = '\n\nHIGGINS COACHING CONTEXT:';

      if (allPeopleIds.length > 1) {
        ctx += '\n\nPEOPLE INVOLVED IN THIS CONVERSATION:';
      }

      // Process each person (results come in pairs: notes, person)
      for (let i = 0; i < allPeopleIds.length; i++) {
        const notesResult = personResults[i * 2];
        const personResult = personResults[i * 2 + 1];
        const notes = (notesResult.data || []) as CrewNote[];
        const person = personResult.data as Person | null;

        if (person) {
          ctx += `\n${allPeopleIds.length > 1 ? '\nAbout ' : '\nPerson: '}${person.name}`;
          if (person.relationship_type) ctx += ` (${person.relationship_type})`;
          if (person.age) ctx += `, age ${person.age}`;
          if (person.personality_summary) ctx += `\nPersonality: ${person.personality_summary}`;
          if (person.love_language) ctx += `\nLove language: ${person.love_language}`;
        }
        if (notes.length > 0) {
          ctx += `\n\nDetailed notes about ${person?.name || 'this person'}:`;
          const grouped: Record<string, string[]> = {};
          for (const note of notes) {
            const label = CREW_NOTE_CATEGORY_LABELS[note.category] || note.category;
            if (!grouped[label]) grouped[label] = [];
            grouped[label].push(note.text.length > 300 ? note.text.slice(0, 300) + '...' : note.text);
          }
          for (const [label, texts] of Object.entries(grouped)) {
            ctx += `\n${label.toUpperCase()}:`;
            for (const text of texts.slice(0, 5)) {
              ctx += `\n- ${text}`;
            }
          }
        }
      }

      if (recentSkills.length > 0) {
        ctx += `\n\nRecent teaching skills used (avoid repeating the most recent): ${recentSkills.join(', ')}`;
      } else {
        ctx += '\n\nThis may be their first Higgins interaction. Start with the basics.';
      }

      // Count for primary person only (skill check offer)
      if (primaryPersonId) {
        const countResult = await supabase
          .from('higgins_messages')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('people_id', primaryPersonId);
        const totalCount = countResult.count || 0;
        if (totalCount >= 5) {
          ctx += `\nThe user has used Higgins ${totalCount} times with this person. You may occasionally offer "skill check" mode — let them write first, then give feedback instead of rewriting.`;
        }
      }
      higginsContext = ctx;
    } else {
      // No person pre-selected ("Just start talking" mode)
      higginsContext = '\n\nHIGGINS COACHING CONTEXT:\nNO PERSON PRE-SELECTED. The user chose to start talking without selecting a specific person. Ask who they want to talk about. Use crew name detection from the broader context to match when they mention someone.';
    }
  }

  if (crewResult?.data && crewResult.data.length > 0) {
    crewContext = formatCrewContext(crewResult.data as Person[]);
    // Annotate crew context with detected names so AI knows which people were mentioned
    if (detectedCrewNames.length > 0) {
      crewContext += `\nThe user just mentioned: ${detectedCrewNames.join(', ')}. Pay special attention to context about these people.\n`;
    }
  }

  // Sphere context — needs crew data for people sphere assignments
  if (needSphere) {
    const spherePeople = (crewResult?.data as Person[]) || [];
    const sphereEntities = (sphereEntitiesResult?.data as SphereEntity[]) || [];
    if (spherePeople.length > 0 || sphereEntities.length > 0) {
      sphereContext = formatSphereContext(spherePeople, sphereEntities);
    }
  }

  // Frameworks context
  if (frameworksResult?.data && frameworksResult.data.length > 0) {
    frameworksContext = formatFrameworksContext(
      frameworksResult.data.map((fw: Record<string, unknown>) => ({
        name: fw.name as string,
        principles: (fw.ai_framework_principles as Array<{ text: string; sort_order: number }>) || [],
      })),
    );
  }

  // Manifest RAG context
  if (manifestResults && manifestResults.length > 0) {
    manifestContext = formatManifestContext(manifestResults);
  }

  // Reflections context
  if (reflectionsResult?.data && reflectionsResult.data.length > 0) {
    const formatted = (reflectionsResult.data as unknown as Array<{
      response_text: string;
      response_date: string;
      reflection_questions: Array<{ question_text: string }> | { question_text: string } | null;
    }>).map((r) => {
      const q = r.reflection_questions;
      const questionText = Array.isArray(q) ? q[0]?.question_text : q?.question_text;
      return {
        question_text: questionText || 'Unknown question',
        response_text: r.response_text,
        response_date: r.response_date,
      };
    });
    reflectionsContext = formatReflectionsContext(formatted);
  }

  // Hatch context — active tabs
  if (hatchResult?.data && hatchResult.data.length > 0) {
    hatchContext = formatHatchContext(
      hatchResult.data as Array<{ title: string; content: string }>,
    );
  }

  // App guide context — static, no async needed
  if (needAppGuide) {
    appGuideContext = getAppGuideContext();
  }

  // Charts context — aggregated summary
  if (needCharts || needDashboard) {
    chartsContext = await buildChartsContext(userId, today);
  }

  // Dashboard context
  if (needDashboard) {
    dashboardContext = await buildDashboardContext(userId, today, compassResult?.data as CompassTask[] | undefined, recentVictories);
  }

  // Reveille context — morning briefing opening for Helm
  if (needReveille) {
    reveilleContext = buildReveilleContext(
      compassResult?.data as CompassTask[] | undefined,
      mastEntries,
    );
  }

  // Reckoning context — evening review opening for Helm
  if (needReckoning) {
    reckoningContext = await buildReckoningContext(userId, today, compassResult?.data as CompassTask[] | undefined, recentVictories);
  }

  return {
    displayName,
    mastEntries,
    keelEntries,
    recentLogEntries,
    recentVictories,
    compassContext,
    chartsContext,
    dashboardContext,
    reveilleContext,
    reckoningContext,
    wheelContext,
    lifeInventoryContext,
    riggingContext,
    firstMateContext,
    crewContext,
    sphereContext,
    frameworksContext,
    manifestContext,
    cyranoContext,
    higginsContext,
    meetingContext,
    meetingSections,
    reflectionsContext,
    hatchContext,
    appGuideContext,
    pageContext,
    guidedMode: guidedMode || null,
    guidedSubtype: guidedSubtype || null,
    guidedModeContext,
    conversationHistory,
    contextBudget,
  };
}

function formatCompassContext(tasks: Pick<CompassTask, 'title' | 'status' | 'life_area_tag' | 'due_date' | 'recurrence_rule'>[]): string {
  const pending = tasks.filter((t) => t.status === 'pending');
  const completed = tasks.filter((t) => t.status === 'completed');

  let result = '\n\nTODAY\'S COMPASS (Tasks):\n';
  if (pending.length > 0) {
    result += `Pending (${pending.length}):\n`;
    for (const t of pending) {
      const tag = t.life_area_tag ? ` [${t.life_area_tag}]` : '';
      const recurring = t.recurrence_rule ? ` (${t.recurrence_rule})` : '';
      result += `- ${t.title}${tag}${recurring}\n`;
    }
  }
  if (completed.length > 0) {
    result += `Completed (${completed.length}):\n`;
    for (const t of completed) {
      result += `- ${t.title}\n`;
    }
  }
  return result;
}

async function buildChartsContext(userId: string, today: string): Promise<string | undefined> {
  try {
    // Get this week's task completion
    const weekStart = new Date();
    const dayOfWeek = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const { data: weekTasks } = await supabase
      .from('compass_tasks')
      .select('status')
      .eq('user_id', userId)
      .is('archived_at', null)
      .gte('due_date', weekStartStr)
      .lte('due_date', today);

    const totalTasks = weekTasks?.length || 0;
    const completedTasks = weekTasks?.filter((t: { status: string }) => t.status === 'completed').length || 0;

    // Get active goals
    const { data: goals } = await supabase
      .from('goals')
      .select('title, progress_current, progress_target')
      .eq('user_id', userId)
      .eq('status', 'active')
      .is('archived_at', null)
      .limit(5);

    // Get this month's victory count
    const monthStart = new Date();
    monthStart.setDate(1);
    const { count: victoryCount } = await supabase
      .from('victories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('archived_at', null)
      .gte('created_at', monthStart.toISOString());

    // Get this week's journal count
    const { count: journalCount } = await supabase
      .from('log_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('archived_at', null)
      .gte('created_at', weekStart.toISOString());

    let result = '\n\nProgress summary (Charts):\n';
    if (totalTasks > 0) {
      const pct = Math.round((completedTasks / totalTasks) * 100);
      result += `- Task completion: ${pct}% this week (${completedTasks} of ${totalTasks} tasks)\n`;
    }
    if (goals && goals.length > 0) {
      result += '- Goals: ';
      result += goals.map((g: { title: string; progress_current: number; progress_target: number | null }) =>
        `${g.title} at ${g.progress_target ? Math.round((g.progress_current / g.progress_target) * 100) : g.progress_current}%`
      ).join(', ');
      result += '\n';
    }
    if (victoryCount) {
      result += `- Victories this month: ${victoryCount}\n`;
    }
    if (journalCount) {
      result += `- Journal entries this week: ${journalCount}\n`;
    }

    return result;
  } catch {
    return undefined;
  }
}

async function buildDashboardContext(
  _userId: string,
  _today: string,
  todayTasks?: CompassTask[],
  victories?: Victory[],
): Promise<string | undefined> {
  try {
    const pending = todayTasks?.filter((t) => t.status === 'pending') || [];
    const completed = todayTasks?.filter((t) => t.status === 'completed') || [];
    const totalToday = (todayTasks || []).length;

    let result = '\n\nDashboard summary (Crow\'s Nest):\n';
    result += `- Today: ${totalToday} tasks, ${completed.length} completed, ${pending.length} remaining.`;
    if (pending.length > 0) {
      result += ` Top pending: ${pending.slice(0, 3).map((t) => t.title).join(', ')}`;
    }
    result += '\n';

    if (victories && victories.length > 0) {
      result += `- Recent victories: ${victories.length} in last 30 days\n`;
    }

    return result;
  } catch {
    return undefined;
  }
}

function buildReveilleContext(
  todayTasks?: CompassTask[],
  _mastEntries?: MastEntry[],
): string | undefined {
  try {
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const pending = todayTasks?.filter((t) => t.status === 'pending') || [];

    let result = `\n\nMORNING CONTEXT (Reveille):
The user just saw their Reveille morning briefing and tapped "Talk to The Helm."
Today is ${dayOfWeek}, ${dateStr}.\n`;

    if (pending.length > 0) {
      result += `Today's tasks (${pending.length}):\n`;
      for (const t of pending.slice(0, 5)) {
        result += `- ${t.title}${t.life_area_tag ? ` [${t.life_area_tag}]` : ''}\n`;
      }
      if (pending.length > 5) {
        result += `- ...and ${pending.length - 5} more\n`;
      }
    } else {
      result += 'No tasks scheduled for today.\n';
    }

    result += `\nAI style: Be grounded and practical, not over-enthusiastic. Example openings:
- "Good morning. You've got ${pending.length} things on your plate today. Anything weighing on you before you start?"
- "Morning. Want to think through how to approach today?"`;

    return result;
  } catch {
    return undefined;
  }
}

async function buildReckoningContext(
  userId: string,
  today: string,
  todayTasks?: CompassTask[],
  victories?: Victory[],
): Promise<string | undefined> {
  try {
    const completed = todayTasks?.filter((t) => t.status === 'completed') || [];
    const pending = todayTasks?.filter((t) => t.status === 'pending') || [];
    const totalToday = (todayTasks || []).length;

    // Get tomorrow's tasks
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: tomorrowTasks } = await supabase
      .from('compass_tasks')
      .select('title, life_area_tag')
      .eq('user_id', userId)
      .eq('due_date', tomorrowStr)
      .in('status', ['pending', 'carried_forward'])
      .is('archived_at', null)
      .order('sort_order')
      .limit(5);

    // Get today's log entries
    const { data: todayLogs } = await supabase
      .from('log_entries')
      .select('text, entry_type')
      .eq('user_id', userId)
      .is('archived_at', null)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .limit(5);

    let result = `\n\nEVENING CONTEXT (Reckoning):
The user just saw their Reckoning evening review and tapped "Talk to The Helm."\n`;

    result += `Today: ${completed.length} of ${totalToday} tasks completed.`;
    if (pending.length > 0) {
      result += ` ${pending.length} incomplete: ${pending.slice(0, 3).map((t) => t.title).join(', ')}`;
      if (pending.length > 3) result += ` and ${pending.length - 3} more`;
    }
    result += '\n';

    if (victories && victories.length > 0) {
      result += `Victories today: ${victories.map((v) => v.description).join('; ')}\n`;
    }

    if (tomorrowTasks && tomorrowTasks.length > 0) {
      result += `Tomorrow's priorities: ${(tomorrowTasks as { title: string }[]).map((t) => t.title).join(', ')}\n`;
    }

    if (todayLogs && todayLogs.length > 0) {
      result += `Today's journal entries: ${todayLogs.length}\n`;
    }

    result += `\nAI style: Be reflective, not evaluative. Example openings:
- "How are you feeling about today?"
- "Looks like you got through ${completed.length} of your ${totalToday} tasks. How do you feel about what's left?"`;

    if (pending.length > 3) {
      result += `\n- If heavy day detected: "It looks like today was a lot. Want to talk about it, or just close things out and rest?"`;
    }

    return result;
  } catch {
    return undefined;
  }
}

function buildWheelContext(wheels: WheelInstance[]): string {
  if (wheels.length === 0) return '';

  let result = '\n\nACTIVE CHANGE WHEELS:\n';
  for (const w of wheels) {
    const spokeLabel = SPOKE_LABELS[w.current_spoke] || `Spoke ${w.current_spoke}`;
    result += `- "${w.hub_text}" (${w.status}, current: ${spokeLabel})`;
    if (w.life_area_tag) {
      result += ` [${w.life_area_tag}]`;
    }
    if (w.next_rim_date) {
      result += ` — next Rim: ${w.next_rim_date}`;
    }
    if (w.rim_count > 0) {
      result += `, ${w.rim_count} Rim${w.rim_count > 1 ? 's' : ''} completed`;
    }
    result += '\n';

    // Include key spoke data if available (truncated)
    if (w.spoke_1_why) {
      const truncated = w.spoke_1_why.length > 100 ? w.spoke_1_why.slice(0, 97) + '...' : w.spoke_1_why;
      result += `  Why: ${truncated}\n`;
    }
    if (w.spoke_6_becoming && w.spoke_6_becoming.length > 0) {
      const becomingText = w.spoke_6_becoming.map((a) => a.text).join(', ');
      const truncated = becomingText.length > 100 ? becomingText.slice(0, 97) + '...' : becomingText;
      result += `  Becoming: ${truncated}\n`;
    }
  }
  return result;
}

function buildLifeInventoryContext(areas: LifeInventoryArea[]): string {
  if (areas.length === 0) return '';

  const assessed = areas.filter((a) => a.current_summary || a.baseline_summary || a.vision_summary);
  if (assessed.length === 0) {
    return `\n\nLIFE INVENTORY: ${areas.length} areas defined, none assessed yet.\n`;
  }

  let result = `\n\nLIFE INVENTORY (${assessed.length} of ${areas.length} areas assessed):\n`;
  for (const a of assessed) {
    result += `- ${a.area_name}:`;
    if (a.current_summary) {
      const truncated = a.current_summary.length > 150 ? a.current_summary.slice(0, 147) + '...' : a.current_summary;
      result += ` Current: ${truncated}`;
    }
    if (a.vision_summary) {
      const truncated = a.vision_summary.length > 100 ? a.vision_summary.slice(0, 97) + '...' : a.vision_summary;
      result += ` | Vision: ${truncated}`;
    }
    result += '\n';
  }
  return result;
}

function formatAgendaItems(items: MeetingAgendaItem[]): string {
  if (items.length === 0) return '';

  // Group by meeting_type
  const byType: Record<string, MeetingAgendaItem[]> = {};
  for (const item of items) {
    if (!byType[item.meeting_type]) byType[item.meeting_type] = [];
    byType[item.meeting_type].push(item);
  }

  let result = '\n\nPENDING AGENDA ITEMS (queued between meetings):\n';
  for (const [type, typeItems] of Object.entries(byType)) {
    result += `${type.replace(/_/g, ' ')}:\n`;
    for (const item of typeItems) {
      result += `- ${item.text}`;
      if (item.notes) {
        const truncated = item.notes.length > 100 ? item.notes.slice(0, 97) + '...' : item.notes;
        result += ` (note: ${truncated})`;
      }
      result += '\n';
    }
  }
  return result;
}

function buildRiggingContext(plans: RiggingPlan[]): string {
  if (plans.length === 0) return '';

  let result = '\n\nACTIVE PLANS (Rigging):\n';
  for (const p of plans) {
    const framework = p.planning_framework ? PLANNING_FRAMEWORK_LABELS[p.planning_framework] : p.planning_framework;
    result += `- "${p.title}" (${p.status}, ${framework || 'unset'})`;
    if (p.completed_at) {
      result += ` — completed: ${p.completed_at}`;
    }
    result += '\n';
    if (p.description) {
      const truncated = p.description.length > 120 ? p.description.slice(0, 117) + '...' : p.description;
      result += `  ${truncated}\n`;
    }
  }
  return result;
}
