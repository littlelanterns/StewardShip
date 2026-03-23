#!/usr/bin/env node

/**
 * Push extractions from source user to all other users' cloned books.
 *
 * For each book with completed extractions on the source account:
 *   1. Find cloned manifest_items on other users (via source_manifest_item_id)
 *   2. Copy missing extraction data: summaries, declarations, ai_frameworks + principles, action_steps, questions
 *   3. Set extraction_status = 'completed' on the target book
 *
 * Usage: node scripts/push-extractions.mjs
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
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SOURCE_USER_ID = '082b18e3-f2c4-4411-a5b6-8435e3b36e56';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Stats
let stats = {
  booksProcessed: 0,
  booksSkipped: 0,
  summariesCopied: 0,
  declarationsCopied: 0,
  frameworksCopied: 0,
  principlesCopied: 0,
  actionStepsCopied: 0,
  questionsCopied: 0,
  errors: 0,
};

/**
 * Get all extracted books for the source user
 */
async function getSourceBooks() {
  const { data, error } = await supabase
    .from('manifest_items')
    .select('id, title, extraction_status, genres')
    .eq('user_id', SOURCE_USER_ID)
    .eq('extraction_status', 'completed');

  if (error) throw new Error(`Failed to fetch source books: ${error.message}`);
  return data || [];
}

/**
 * Get all other users
 */
async function getTargetUsers() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error(`Failed to list users: ${error.message}`);
  return (data?.users || [])
    .map(u => u.id)
    .filter(id => id !== SOURCE_USER_ID);
}

/**
 * Find the cloned book on a target user's account
 */
async function findClone(sourceBookId, targetUserId) {
  const { data, error } = await supabase
    .from('manifest_items')
    .select('id, extraction_status')
    .eq('user_id', targetUserId)
    .eq('source_manifest_item_id', sourceBookId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`  Error finding clone: ${error.message}`);
    return null;
  }
  return data;
}

/**
 * Copy summaries from source book to target
 */
async function copySummaries(sourceBookId, targetBookId, sourceUserId, targetUserId) {
  // Check if target already has summaries
  const { count: existingCount } = await supabase
    .from('manifest_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('manifest_item_id', targetBookId)
    .eq('user_id', targetUserId)
    .eq('is_deleted', false);

  if (existingCount > 0) return 0;

  // Fetch source summaries (exclude embedding to avoid timeout)
  const { data: sourceSummaries, error } = await supabase
    .from('manifest_summaries')
    .select('text, content_type, section_title, section_index, sort_order, tags, audience, is_key_point, is_from_go_deeper')
    .eq('manifest_item_id', sourceBookId)
    .eq('user_id', sourceUserId)
    .eq('is_deleted', false);

  if (error || !sourceSummaries?.length) return 0;

  const rows = sourceSummaries.map(s => ({
    ...s,
    user_id: targetUserId,
    manifest_item_id: targetBookId,
    is_hearted: false,
    is_deleted: false,
  }));

  const { error: insertError } = await supabase
    .from('manifest_summaries')
    .insert(rows);

  if (insertError) {
    console.error(`    Summaries insert error: ${insertError.message}`);
    stats.errors++;
    return 0;
  }
  return rows.length;
}

/**
 * Copy declarations from source book to target
 */
async function copyDeclarations(sourceBookId, targetBookId, sourceUserId, targetUserId) {
  const { count: existingCount } = await supabase
    .from('manifest_declarations')
    .select('id', { count: 'exact', head: true })
    .eq('manifest_item_id', targetBookId)
    .eq('user_id', targetUserId)
    .eq('is_deleted', false);

  if (existingCount > 0) return 0;

  const { data: sourceDeclarations, error } = await supabase
    .from('manifest_declarations')
    .select('declaration_text, declaration_style, value_name, section_title, section_index, sort_order, tags, audience, is_key_point, is_from_go_deeper')
    .eq('manifest_item_id', sourceBookId)
    .eq('user_id', sourceUserId)
    .eq('is_deleted', false);

  if (error || !sourceDeclarations?.length) return 0;

  const rows = sourceDeclarations.map(d => ({
    ...d,
    user_id: targetUserId,
    manifest_item_id: targetBookId,
    is_hearted: false,
    is_deleted: false,
    sent_to_mast: false,
    mast_entry_id: null,
  }));

  const { error: insertError } = await supabase
    .from('manifest_declarations')
    .insert(rows);

  if (insertError) {
    console.error(`    Declarations insert error: ${insertError.message}`);
    stats.errors++;
    return 0;
  }
  return rows.length;
}

/**
 * Copy frameworks + principles from source book to target
 */
async function copyFrameworks(sourceBookId, targetBookId, sourceUserId, targetUserId) {
  // Check if target already has a framework for this book
  const { data: existingFramework } = await supabase
    .from('ai_frameworks')
    .select('id')
    .eq('manifest_item_id', targetBookId)
    .eq('user_id', targetUserId)
    .limit(1)
    .maybeSingle();

  // Get source framework
  const { data: sourceFramework, error: fwError } = await supabase
    .from('ai_frameworks')
    .select('id, name, tags, is_active')
    .eq('manifest_item_id', sourceBookId)
    .eq('user_id', sourceUserId)
    .limit(1)
    .maybeSingle();

  if (fwError || !sourceFramework) return { frameworks: 0, principles: 0 };

  let targetFrameworkId;

  if (existingFramework) {
    // Framework exists — check if it has principles
    const { count: principleCount } = await supabase
      .from('ai_framework_principles')
      .select('id', { count: 'exact', head: true })
      .eq('framework_id', existingFramework.id)
      .eq('user_id', targetUserId)
      .eq('is_deleted', false);

    if (principleCount > 0) return { frameworks: 0, principles: 0 };
    targetFrameworkId = existingFramework.id;
  } else {
    // Create framework
    const { data: newFw, error: createError } = await supabase
      .from('ai_frameworks')
      .insert({
        name: sourceFramework.name,
        manifest_item_id: targetBookId,
        user_id: targetUserId,
        tags: sourceFramework.tags,
        is_active: sourceFramework.is_active,
      })
      .select('id')
      .single();

    if (createError) {
      console.error(`    Framework create error: ${createError.message}`);
      stats.errors++;
      return { frameworks: 0, principles: 0 };
    }
    targetFrameworkId = newFw.id;
  }

  // Fetch source principles
  const { data: sourcePrinciples, error: pError } = await supabase
    .from('ai_framework_principles')
    .select('text, section_title, sort_order, is_key_point, is_from_go_deeper, is_included, is_user_added')
    .eq('framework_id', sourceFramework.id)
    .eq('user_id', sourceUserId)
    .eq('is_deleted', false);

  if (pError || !sourcePrinciples?.length) return { frameworks: existingFramework ? 0 : 1, principles: 0 };

  const rows = sourcePrinciples.map(p => ({
    ...p,
    user_id: targetUserId,
    framework_id: targetFrameworkId,
    is_hearted: false,
    is_deleted: false,
  }));

  // Insert in batches of 500 (Supabase limit)
  let totalInserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error: insertError } = await supabase
      .from('ai_framework_principles')
      .insert(batch);

    if (insertError) {
      console.error(`    Principles insert error (batch ${Math.floor(i/100)+1}): ${insertError.message}`);
      stats.errors++;
    } else {
      totalInserted += batch.length;
    }
  }

  return { frameworks: existingFramework ? 0 : 1, principles: totalInserted };
}

/**
 * Copy action steps from source book to target
 */
async function copyActionSteps(sourceBookId, targetBookId, sourceUserId, targetUserId) {
  const { count: existingCount } = await supabase
    .from('manifest_action_steps')
    .select('id', { count: 'exact', head: true })
    .eq('manifest_item_id', targetBookId)
    .eq('user_id', targetUserId)
    .eq('is_deleted', false);

  if (existingCount > 0) return 0;

  const { data: sourceSteps, error } = await supabase
    .from('manifest_action_steps')
    .select('text, content_type, section_title, section_index, sort_order, tags, audience, is_key_point, is_from_go_deeper')
    .eq('manifest_item_id', sourceBookId)
    .eq('user_id', sourceUserId)
    .eq('is_deleted', false);

  if (error || !sourceSteps?.length) return 0;

  const rows = sourceSteps.map(s => ({
    ...s,
    user_id: targetUserId,
    manifest_item_id: targetBookId,
    is_hearted: false,
    is_deleted: false,
    sent_to_compass: false,
    compass_task_id: null,
  }));

  // Insert in batches
  let totalInserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error: insertError } = await supabase
      .from('manifest_action_steps')
      .insert(batch);

    if (insertError) {
      console.error(`    Action steps insert error (batch ${Math.floor(i/100)+1}): ${insertError.message}`);
      stats.errors++;
    } else {
      totalInserted += batch.length;
    }
  }
  return totalInserted;
}

/**
 * Copy questions from source book to target
 */
async function copyQuestions(sourceBookId, targetBookId, sourceUserId, targetUserId) {
  const { count: existingCount } = await supabase
    .from('manifest_questions')
    .select('id', { count: 'exact', head: true })
    .eq('manifest_item_id', targetBookId)
    .eq('user_id', targetUserId)
    .eq('is_deleted', false);

  if (existingCount > 0) return 0;

  const { data: sourceQuestions, error } = await supabase
    .from('manifest_questions')
    .select('text, content_type, section_title, section_index, sort_order, tags, audience, is_key_point, is_from_go_deeper')
    .eq('manifest_item_id', sourceBookId)
    .eq('user_id', sourceUserId)
    .eq('is_deleted', false);

  if (error || !sourceQuestions?.length) return 0;

  const rows = sourceQuestions.map(q => ({
    ...q,
    user_id: targetUserId,
    manifest_item_id: targetBookId,
    is_hearted: false,
    is_deleted: false,
    sent_to_prompts: false,
    journal_prompt_id: null,
  }));

  // Insert in batches
  let totalInserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error: insertError } = await supabase
      .from('manifest_questions')
      .insert(batch);

    if (insertError) {
      console.error(`    Questions insert error (batch ${Math.floor(i/100)+1}): ${insertError.message}`);
      stats.errors++;
    } else {
      totalInserted += batch.length;
    }
  }
  return totalInserted;
}

/**
 * Process one book for one target user
 */
async function processBookForUser(sourceBook, targetUserId) {
  const clone = await findClone(sourceBook.id, targetUserId);
  if (!clone) return false; // No clone exists for this user

  // Copy all extraction types
  const summaries = await copySummaries(sourceBook.id, clone.id, SOURCE_USER_ID, targetUserId);
  const declarations = await copyDeclarations(sourceBook.id, clone.id, SOURCE_USER_ID, targetUserId);
  const { frameworks, principles } = await copyFrameworks(sourceBook.id, clone.id, SOURCE_USER_ID, targetUserId);
  const actionSteps = await copyActionSteps(sourceBook.id, clone.id, SOURCE_USER_ID, targetUserId);
  const questions = await copyQuestions(sourceBook.id, clone.id, SOURCE_USER_ID, targetUserId);

  const anyCopied = summaries + declarations + frameworks + principles + actionSteps + questions > 0;

  // Update extraction_status if we copied anything
  if (anyCopied && clone.extraction_status !== 'completed') {
    await supabase
      .from('manifest_items')
      .update({ extraction_status: 'completed', genres: sourceBook.genres })
      .eq('id', clone.id);
  }

  stats.summariesCopied += summaries;
  stats.declarationsCopied += declarations;
  stats.frameworksCopied += frameworks;
  stats.principlesCopied += principles;
  stats.actionStepsCopied += actionSteps;
  stats.questionsCopied += questions;

  return anyCopied;
}

async function main() {
  console.log('Starting extraction push...');
  console.log(`Source user: ${SOURCE_USER_ID}`);

  const sourceBooks = await getSourceBooks();
  console.log(`Found ${sourceBooks.length} extracted books`);

  const targetUsers = await getTargetUsers();
  console.log(`Found ${targetUsers.length} target users: ${targetUsers.join(', ')}`);
  console.log('');

  const startTime = Date.now();

  for (let i = 0; i < sourceBooks.length; i++) {
    const book = sourceBooks[i];
    let copiedForAny = false;

    for (const targetUserId of targetUsers) {
      const copied = await processBookForUser(book, targetUserId);
      if (copied) copiedForAny = true;
    }

    if (copiedForAny) {
      stats.booksProcessed++;
    } else {
      stats.booksSkipped++;
    }

    // Progress every 10 books
    if ((i + 1) % 10 === 0 || i === sourceBooks.length - 1) {
      console.log(`[${i + 1}/${sourceBooks.length}] "${book.title?.slice(0, 40)}" | Copied: ${stats.summariesCopied}S ${stats.declarationsCopied}D ${stats.principlesCopied}P ${stats.actionStepsCopied}A ${stats.questionsCopied}Q | Errors: ${stats.errors}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n========================================');
  console.log('EXTRACTION PUSH COMPLETE');
  console.log('========================================');
  console.log(`Books with new extractions: ${stats.booksProcessed}`);
  console.log(`Books skipped (already done or no clone): ${stats.booksSkipped}`);
  console.log(`Summaries copied:     ${stats.summariesCopied.toLocaleString()}`);
  console.log(`Declarations copied:  ${stats.declarationsCopied.toLocaleString()}`);
  console.log(`Frameworks created:   ${stats.frameworksCopied.toLocaleString()}`);
  console.log(`Principles copied:    ${stats.principlesCopied.toLocaleString()}`);
  console.log(`Action steps copied:  ${stats.actionStepsCopied.toLocaleString()}`);
  console.log(`Questions copied:     ${stats.questionsCopied.toLocaleString()}`);
  console.log(`Errors:               ${stats.errors}`);
  console.log(`Elapsed time:         ${elapsed}s`);
  console.log('========================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
