#!/usr/bin/env node
/**
 * Clone missing ai_frameworks + ai_framework_principles to family members.
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

async function main() {
  console.log('=== Clone Frameworks + Principles ===\n');

  // Get tenis's frameworks
  const tenisFrameworks = await fetchAll(
    supabase.from('ai_frameworks')
      .select('id, name, manifest_item_id, tags, is_active')
      .eq('user_id', TENIS)
      .is('archived_at', null)
      .order('id')
  );
  console.log(`Tenis frameworks: ${tenisFrameworks.length}`);

  const { data: { users } } = await supabase.auth.admin.listUsers();
  const family = users.filter(u => u.id !== TENIS);

  for (const member of family) {
    console.log(`\n─── ${member.email} ───`);

    // Get source→clone book mapping
    const clones = await fetchAll(
      supabase.from('manifest_items')
        .select('id, source_manifest_item_id')
        .eq('user_id', member.id)
        .is('archived_at', null)
        .not('source_manifest_item_id', 'is', null)
        .order('id')
    );
    const sourceToClone = Object.fromEntries(clones.map(c => [c.source_manifest_item_id, c.id]));

    // Get member's existing frameworks
    const memberFrameworks = await fetchAll(
      supabase.from('ai_frameworks')
        .select('id, name, manifest_item_id')
        .eq('user_id', member.id)
        .is('archived_at', null)
        .order('id')
    );
    // Map: manifest_item_id+name → framework id (to detect existing)
    const memberFwMap = new Set(memberFrameworks.map(f => f.manifest_item_id + '|' + f.name));

    let fwCreated = 0;
    let principlesCreated = 0;

    for (const tenisFw of tenisFrameworks) {
      const cloneItemId = sourceToClone[tenisFw.manifest_item_id];
      if (!cloneItemId) continue; // no cloned book for this framework

      // Check if member already has this framework
      if (memberFwMap.has(cloneItemId + '|' + tenisFw.name)) continue;

      // Create framework
      const { data: newFw, error: fwErr } = await supabase.from('ai_frameworks')
        .insert({
          user_id: member.id,
          manifest_item_id: cloneItemId,
          name: tenisFw.name,
          tags: tenisFw.tags,
          is_active: tenisFw.is_active,
        })
        .select('id')
        .single();

      if (fwErr) { console.error(`  fw error:`, fwErr.message); continue; }
      fwCreated++;

      // Clone principles
      const principles = await fetchAll(
        supabase.from('ai_framework_principles')
          .select('text, sort_order, is_user_added, is_included, section_title, is_from_go_deeper, is_key_point')
          .eq('user_id', TENIS)
          .eq('framework_id', tenisFw.id)
          .is('archived_at', null)
          .or('is_deleted.eq.false,is_deleted.is.null')
          .order('sort_order')
      );

      if (principles.length > 0) {
        // Insert in batches
        for (let i = 0; i < principles.length; i += 50) {
          const batch = principles.slice(i, i + 50).map(p => ({
            ...p,
            user_id: member.id,
            framework_id: newFw.id,
          }));
          const { data, error } = await supabase.from('ai_framework_principles').insert(batch).select('id');
          if (error) console.error(`  principles error:`, error.message);
          else principlesCreated += data.length;
        }
      }
    }

    console.log(`  Created ${fwCreated} frameworks, ${principlesCreated} principles`);
  }

  // Verify
  console.log('\n=== Final Framework Counts ===');
  for (const u of [{ id: TENIS, email: 'tenis' }, ...family]) {
    const { count: fwc } = await supabase.from('ai_frameworks').select('id', { count: 'exact', head: true }).eq('user_id', u.id).is('archived_at', null);
    const { count: fpc } = await supabase.from('ai_framework_principles').select('id', { count: 'exact', head: true }).eq('user_id', u.id);
    console.log(`  ${u.email}: ${fwc} frameworks, ${fpc} principles`);
  }
}

main().catch(console.error);
