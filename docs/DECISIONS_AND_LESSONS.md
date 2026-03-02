# Architecture Decisions & Lessons Learned

**Purpose:** Capture hard-won technical decisions, failed approaches, and lessons learned during StewardShip development so they carry forward into MyAIM v2 without repeating mistakes.

**Format:** Each entry includes the decision, why it was made, what was tried first (if applicable), and the lesson for future builds.

**Started:** March 2026
**Updated:** March 2026

---

## Table of Contents

1. [PDF Text Extraction](#1-pdf-text-extraction)
2. [Framework Extraction for Long Documents](#2-framework-extraction-for-long-documents)
3. [AI Extraction Prompt Design](#3-ai-extraction-prompt-design)
4. [Shared Edge Function Code](#4-shared-edge-function-code)
5. [max_tokens for AI Extraction](#5-max_tokens-for-ai-extraction)
6. [Seasonal Focus Pattern (`is_included`)](#6-seasonal-focus-pattern-is_included)

---

## 1. PDF Text Extraction

**Decision:** Use `unpdf` (PDF.js wrapper for edge runtimes) for all PDF text extraction. Keep the legacy regex-based BT/ET extractor as a fallback only.

**What we tried first:**
- **Custom regex-based PDF parser** that decompressed PDF streams via `fflate`, found BT/ET text operator blocks, and decoded parenthesized and hex strings. This was built to avoid dependency issues in Deno/Supabase Edge Functions.
- **Stream dictionary filtering** — inspecting each stream's dictionary to skip Image, Metadata, ICC, Font, and CMap streams before decompressing. This was intended to prevent junk (XMP metadata, image binary data, color profiles) from entering the extracted text.

**Why it failed:**
- The custom parser fundamentally cannot handle **CIDFont encoding** — hex glyph IDs that require a ToUnicode CMap table to map to Unicode characters. This is standard in professionally typeset PDFs (Adobe InDesign, etc.).
- The dictionary lookback (searching 500 chars before each stream for its object dictionary) **crosses PDF object boundaries**. A page content stream adjacent to a FontDescriptor object would get incorrectly skipped because the lookback grabbed the wrong object's dictionary.
- The ASCII fallback (`/[\x20-\x7E]{20,}/g`) intended to catch unstructured text also caught XMP metadata, ICC profile descriptions, and PDF structural data — all of which look like readable ASCII.
- Multiple rounds of patching (adding filters, tightening filters, adding sanitization, adding paragraph filtering) could not solve the core issue: a regex-based approach cannot parse the PDF spec.

**The fix:** `unpdf` v1.4.0 via `https://esm.sh/unpdf@1.4.0`, which wraps Mozilla's PDF.js engine. PDF.js properly handles CIDFont, ToUnicode CMaps, composite fonts, Form XObjects, and all standard PDF text formats. Imported with `configureUnPDF` for Deno compatibility.

**Fallback strategy:** If `unpdf` fails or produces fewer than 50 characters, fall back to the legacy regex extractor. Whichever method produces more text wins. Post-processing sanitization (`sanitizeExtractedText`, `filterTextParagraphs`) runs on all output regardless of method.

**Lesson for MyAIM v2:**
- **Never build a custom parser for a complex binary format.** PDF is a 1,000+ page spec. Use a real library from day one.
- **Deno compatibility is solvable.** `esm.sh` can serve most npm packages for Deno. Test the import in an Edge Function before committing to a library.
- **The fallback pattern is good practice.** Primary library + legacy fallback + post-processing sanitization = resilient pipeline.
- **Cost: $0.** PDF parsing runs locally in the Edge Function. No API calls, no per-token charges.

---

## 2. Framework Extraction for Long Documents

**Decision:** For documents over 25,000 characters, use a two-phase extraction: (1) section discovery via Haiku (cheap), then (2) per-section principle extraction via Sonnet. User sees a checklist of sections and chooses which to extract from.

**What we tried first:**
- **Single-pass extraction** with the full document text. For documents over 40K characters, the Edge Function truncated to first 30K + last 10K characters, silently dropping the middle of the book.

**Why it failed:**
- A 250-page book (~275K characters, ~69K tokens) far exceeds what can be meaningfully processed in a single AI call.
- Truncating the middle drops the richest content — core chapters where frameworks are developed.
- Even without truncation, a single Sonnet call trying to extract principles from 69K tokens produces rushed, shallow principles.

**The solution:**
- **Phase 1 — Section Discovery (Haiku):** Send the full document text to Haiku, which identifies 3-15 natural sections/chapters with titles, descriptions, and character offsets. Validated server-side to ensure full coverage with no gaps (every character belongs to a section).
- **Phase 2 — Per-Section Extraction (Sonnet):** User selects sections via checklist (all content sections checked by default, non-content like TOC/bibliography auto-unchecked). Each selected section is extracted individually, with principles accumulating progressively in the UI.
- **Text stays server-side** throughout — section boundaries are character offsets, and the Edge Function slices the text per request. No large payloads sent to the client.

**Cost:** ~$0.40 per 250-page book (Haiku discovery ~$0.06, Sonnet extraction ~$0.34 across 6-10 sections). One-time cost per book — principles are saved permanently.

**Lesson for MyAIM v2:**
- **Let users see and control what the AI processes.** The section checklist builds trust and lets users skip irrelevant content.
- **Use cheap models for structural tasks, expensive models for reasoning.** Haiku for "what are the sections?" Sonnet for "what are the principles?"
- **Progressive UI updates** (showing principles as each section completes) make long operations feel fast.
- **Always validate AI output server-side.** The section boundaries from Haiku are force-corrected to ensure full coverage — first section starts at 0, last ends at document length, each section starts where the previous ended.

---

## 3. AI Extraction Prompt Design

**Decision:** Extraction prompts must explicitly say "never cut off mid-thought" and include exceptions for multi-step processes. Default principle length is 1-3 sentences, but processes/systems can be 3-8 sentences with numbered steps.

**What we tried first:**
- "Each principle should be a concise statement (1-3 sentences max)" — a hard ceiling that compressed multi-step processes into single sentences, losing their value.

**Why it failed:**
- The "max" language made the AI treat 3 sentences as an absolute ceiling rather than a guideline.
- Process-oriented content (like "the 5 steps of straight-line coaching") got compressed into "There is a multi-step process for coaching" — useless as a framework principle.
- Combined with a `max_tokens: 2048` limit, the AI would rush through principles and truncate the last ones mid-sentence when it ran out of space.

**The fix:**
- Changed "1-3 sentences max" to "1-3 complete sentences. Never cut off mid-thought."
- Added explicit exception: "When content describes a multi-step process, a system, or a sequential method, extract it as a structured principle with numbered steps. These may be 3-8 sentences."
- Added: "Every principle must be a COMPLETE thought. If you cannot fit it in 3 sentences, use more. A complete principle is always better than a truncated one."
- Bumped `max_tokens` from 2048 to 4096 (see decision #5).

**Lesson for MyAIM v2:**
- **AI prompts need explicit negative instructions** ("never cut off mid-thought") not just positive ones ("be concise").
- **Hard ceilings on length cause truncation.** Use defaults with exceptions instead of maximums.
- **Different content types need different extraction strategies.** A pithy distinction ("Owner vs. Victim") and a sequential process ("The 5 steps of...") are both principles but need different formatting.

---

## 4. Shared Edge Function Code

**Decision:** Shared utility code lives in `supabase/functions/_shared/` and is imported by all Edge Functions that need it.

**What we had before:**
- The PDF extraction code was **copy-pasted across 4 Edge Functions** (manifest-process, extract-insights, extract-text, chat). Each copy was ~140-175 lines. Bug fixes had to be applied to all 4 files independently.

**Why it was a problem:**
- When we fixed the PDF extraction, we had to update 4 files. When the first fix was wrong, we had to re-fix 4 files. Three rounds of this = 12 file updates for what should have been 1.

**The fix:** Created `supabase/functions/_shared/pdf-utils.ts` with the shared extraction pipeline. All 4 Edge Functions import from it. One file to fix = one fix everywhere.

**Lesson for MyAIM v2:**
- **Establish the `_shared/` pattern from day one.** Any utility used by 2+ Edge Functions belongs in `_shared/`.
- **Supabase Edge Functions support shared imports** via relative paths to `_shared/`. This works in Deno.
- **Candidates for shared modules:** PDF extraction, text sanitization, OpenRouter API wrapper, authentication helpers, CORS headers, error response formatting.

---

## 5. max_tokens for AI Extraction

**Decision:** Use `max_tokens: 4096` for all extraction types (framework, mast, keel). Only pay for tokens actually generated.

**What we had before:** `max_tokens: 2048`, which caused JSON responses to truncate mid-principle when extracting many principles from rich content.

**Why 2048 was insufficient:**
- Framework extraction returns JSON with 8-15 principles, each 1-3+ sentences, plus JSON structure overhead (curly braces, quotes, `sort_order` fields).
- At 2048 tokens, principle #10-12 would get cut off mid-sentence, and the JSON regex parser would grab a partial match.
- The truncation was silent — no error, just incomplete principles.

**Cost impact:** Zero meaningful impact. You only pay for tokens actually generated. Setting `max_tokens: 4096` doesn't cost more if the response is 2000 tokens — it just allows the response to be longer if needed.

**Lesson for MyAIM v2:**
- **Set `max_tokens` generously for structured output.** JSON responses need room for structure + content.
- **Never set `max_tokens` based on "how much should this cost" — set it based on "what's the maximum reasonable response."**
- **Monitor actual token usage** rather than constraining it. If responses are consistently under 1500 tokens, you know your prompt is efficient. If they're hitting 4000, you may need to restructure.

---

## 6. Seasonal Focus Pattern (`is_included`)

**Decision:** Every list-based feature that feeds into AI context gets an `is_included BOOLEAN DEFAULT true` column. Users can check/uncheck individual entries to control what the AI pays attention to, without deleting anything.

**Why:**
- Users accumulate many principles, values, and self-knowledge entries over time
- Not everything is equally relevant in every season of life
- Deleting entries to reduce AI context means losing data permanently
- Users need the ability to say "focus on these 67 of 119 principles right now" without losing the other 52

**The pattern:**
1. **Database:** `is_included BOOLEAN NOT NULL DEFAULT true` on the table
2. **TypeScript type:** Add `is_included: boolean` to the interface
3. **UI:** Checkbox on each entry, count display ("X of Y included in AI context"), Select All / Deselect All
4. **Visual:** Excluded entries are muted (opacity 0.5) but remain visible and fully editable
5. **Context loading:** Format functions in `systemPrompt.ts` filter with `.filter(e => e.is_included !== false)` — using `!== false` for backwards compatibility with entries that predate the migration
6. **Save:** `is_included` is persisted on every save/update

**Applied to:**
- `ai_framework_principles` — individual principles within a framework
- `mast_entries` — values, declarations, faith foundations, scriptures, vision
- `keel_entries` — personality assessments, traits, strengths, growth areas

**Future candidates:**
- Goals (focus on 3 of 7 this quarter)
- Rigging Plans (prioritize certain plans)
- Crew/First Mate notes (focus on certain relationship dynamics)
- Priorities (Tier management already handles this somewhat)

**Lesson for MyAIM v2:**
- Build this pattern in from day one on every list-based feature. It's much easier to add the column at table creation than to retrofit.
- The `!== false` backwards compatibility check is important — it means you can add the column to existing tables without breaking entries that were created before the migration (where the value may be null).

---

## Template for Future Entries

```markdown
## N. [Title]

**Decision:** [What we decided]

**What we tried first:** [Previous approach, if applicable]

**Why it failed/changed:** [What went wrong or what drove the change]

**The fix:** [What we actually did]

**Lesson for MyAIM v2:**
- [Key takeaway 1]
- [Key takeaway 2]
```
