#!/usr/bin/env node
/**
 * Clone missing extractions from tenisewertman to all family members.
 * Each family member gets their own copies (independent hearting, notes, etc.)
 * Extraction records point to the family member's cloned manifest_item_id.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TENIS = '082b18e3-f2c4-4411-a5b6-8435e3b36e56';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing required env vars in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchAll(query) {
  const all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await query.range(offset, offset + 999);
    if (error) { console.error('fetch error:', error.message); return all; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

async function insertBatched(table, rows, batchSize = 50) {
  let total = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await supabase.from(table).insert(batch).select('id');
    if (error) {
      console.error(`  Insert error (${table}):`, error.message);
      // Try smaller batches on error
      for (const row of batch) {
        const { error: e2 } = await supabase.from(table).insert(row);
        if (e2) console.error(`    Single insert error:`, e2.message);
        else total++;
      }
    } else {
      total += data.length;
    }
  }
  return total;
}

async function main() {
  console.log('=== Clone Extractions to Family Members ===\n');

  // Get family members
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const family = users.filter(u => u.id !== TENIS);
  console.log(`Family members: ${family.map(u => u.email).join(', ')}\n`);

  for (const member of family) {
    console.log(`\n─── ${member.email} ───`);

    // Build source→clone mapping for this member's manifest items
    const clones = await fetchAll(
      supabase.from('manifest_items')
        .select('id, source_manifest_item_id')
        .eq('user_id', member.id)
        .is('archived_at', null)
        .not('source_manifest_item_id', 'is', null)
        .order('id')
    );
    const sourceToClone = Object.fromEntries(clones.map(c => [c.source_manifest_item_id, c.id]));
    console.log(`  ${clones.length} cloned books with source mapping`);

    // Get manifest_item_ids that have extractions for this member already
    const memberSumItems = await fetchAll(
      supabase.from('manifest_summaries')
        .select('manifest_item_id')
        .eq('user_id', member.id)
        .order('manifest_item_id')
    );
    const memberExtractedItems = new Set(memberSumItems.map(r => r.manifest_item_id));

    // Find tenis items that have extractions but member doesn't have for the corresponding clone
    const tenisExtractedItemIds = await fetchAll(
      supabase.from('manifest_summaries')
        .select('manifest_item_id')
        .eq('user_id', TENIS)
        .order('manifest_item_id')
    );
    const tenisUniqueItems = [...new Set(tenisExtractedItemIds.map(r => r.manifest_item_id))];

    const missingSourceItems = tenisUniqueItems.filter(tenisItemId => {
      const cloneId = sourceToClone[tenisItemId];
      return cloneId && !memberExtractedItems.has(cloneId);
    });

    if (missingSourceItems.length === 0) {
      console.log('  All extractions up to date!');
      continue;
    }
    console.log(`  ${missingSourceItems.length} books need extractions cloned`);

    // Clone each extraction table for missing items
    for (const tenisItemId of missingSourceItems) {
      const cloneItemId = sourceToClone[tenisItemId];

      // 1. Summaries
      const summaries = await fetchAll(
        supabase.from('manifest_summaries')
          .select('section_title, section_index, content_type, text, sort_order, is_from_go_deeper, is_key_point, audience, tags')
          .eq('user_id', TENIS)
          .eq('manifest_item_id', tenisItemId)
          .eq('is_deleted', false)
          .order('sort_order')
      );
      if (summaries.length > 0) {
        const rows = summaries.map(s => ({ ...s, user_id: member.id, manifest_item_id: cloneItemId }));
        const n = await insertBatched('manifest_summaries', rows);
        process.stdout.write(`S:${n} `);
      }

      // 2. Declarations
      const declarations = await fetchAll(
        supabase.from('manifest_declarations')
          .select('section_title, section_index, value_name, declaration_text, declaration_style, sort_order, is_from_go_deeper, is_key_point, audience, tags')
          .eq('user_id', TENIS)
          .eq('manifest_item_id', tenisItemId)
          .eq('is_deleted', false)
          .order('sort_order')
      );
      if (declarations.length > 0) {
        const rows = declarations.map(d => ({ ...d, user_id: member.id, manifest_item_id: cloneItemId }));
        const n = await insertBatched('manifest_declarations', rows);
        process.stdout.write(`D:${n} `);
      }

      // 3. Action Steps
      const actionSteps = await fetchAll(
        supabase.from('manifest_action_steps')
          .select('section_title, section_index, content_type, text, sort_order, is_from_go_deeper, is_key_point, audience, tags')
          .eq('user_id', TENIS)
          .eq('manifest_item_id', tenisItemId)
          .eq('is_deleted', false)
          .order('sort_order')
      );
      if (actionSteps.length > 0) {
        const rows = actionSteps.map(a => ({ ...a, user_id: member.id, manifest_item_id: cloneItemId }));
        const n = await insertBatched('manifest_action_steps', rows);
        process.stdout.write(`A:${n} `);
      }

      // 4. Questions
      const questions = await fetchAll(
        supabase.from('manifest_questions')
          .select('section_title, section_index, content_type, text, sort_order, is_from_go_deeper, is_key_point, audience, tags')
          .eq('user_id', TENIS)
          .eq('manifest_item_id', tenisItemId)
          .eq('is_deleted', false)
          .order('sort_order')
      );
      if (questions.length > 0) {
        const rows = questions.map(q => ({ ...q, user_id: member.id, manifest_item_id: cloneItemId }));
        const n = await insertBatched('manifest_questions', rows);
        process.stdout.write(`Q:${n} `);
      }

      // 5. Frameworks (ai_frameworks + ai_framework_principles)
      const frameworks = await fetchAll(
        supabase.from('ai_frameworks')
          .select('name, description, source, manifest_item_id, tags, is_active')
          .eq('user_id', TENIS)
          .eq('manifest_item_id', tenisItemId)
          .is('archived_at', null)
          .order('id')
      );
      for (const fw of frameworks) {
        // Create framework for member
        const { data: newFw, error: fwErr } = await supabase.from('ai_frameworks')
          .insert({ ...fw, user_id: member.id, manifest_item_id: cloneItemId })
          .select('id')
          .single();
        if (fwErr) { console.error(`  Framework error:`, fwErr.message); continue; }

        // Get original framework id to fetch principles
        const { data: origFw } = await supabase.from('ai_frameworks')
          .select('id')
          .eq('user_id', TENIS)
          .eq('manifest_item_id', tenisItemId)
          .eq('name', fw.name)
          .is('archived_at', null)
          .limit(1)
          .single();
        if (!origFw) continue;

        // Clone principles
        const principles = await fetchAll(
          supabase.from('ai_framework_principles')
            .select('text, sort_order, is_user_added, is_included, section_title, is_from_go_deeper, is_key_point')
            .eq('user_id', TENIS)
            .eq('framework_id', origFw.id)
            .is('archived_at', null)
            .or('is_deleted.eq.false,is_deleted.is.null')
            .order('sort_order')
        );
        if (principles.length > 0) {
          const rows = principles.map(p => ({ ...p, user_id: member.id, framework_id: newFw.id }));
          const n = await insertBatched('ai_framework_principles', rows);
          process.stdout.write(`F:${n} `);
        }
      }

      process.stdout.write('\n');
    }
  }

  // Final verification
  console.log('\n=== Final Counts ===');
  const tables = ['manifest_summaries', 'manifest_declarations', 'manifest_action_steps', 'manifest_questions', 'ai_framework_principles'];

  // Tenis
  process.stdout.write('tenis: ');
  for (const t of tables) {
    const { count } = await supabase.from(t).select('id', { count: 'exact', head: true }).eq('user_id', TENIS);
    process.stdout.write(`${t.replace('manifest_','').replace('ai_framework_','')}=${count} `);
  }
  console.log();

  const { data: { users: allUsers } } = await supabase.auth.admin.listUsers();
  for (const u of allUsers.filter(u => u.id !== TENIS)) {
    process.stdout.write(u.email.split('@')[0] + ': ');
    for (const t of tables) {
      const { count } = await supabase.from(t).select('id', { count: 'exact', head: true }).eq('user_id', u.id);
      process.stdout.write(`${t.replace('manifest_','').replace('ai_framework_','')}=${count} `);
    }
    console.log();
  }
}

main().catch(console.error);
