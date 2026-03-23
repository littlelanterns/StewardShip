# Database Write Script Template

Use this Python script pattern to write extraction results to Supabase. Save as `/tmp/extraction_work/write_to_db.py` at the start of each session.

```python
"""Write extraction results to Supabase database."""
import urllib.request
import json
import sys

SB_URL = "https://dkcyaklyqxhkhcnpdtwf.supabase.co"
SB_KEY = ""  # Read from .env.local SUPABASE_SERVICE_ROLE_KEY
USER_ID = ""  # Look up from auth admin API
HEADERS = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Content-Type": "application/json"}

def api_post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{SB_URL}/rest/v1/{path}", headers={**HEADERS, "Prefer": "return=representation"},
                                 method="POST", data=body)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"    POST ERROR on {path}: {e.code} - {err_body[:300]}")
        raise

def api_patch(path, data):
    req = urllib.request.Request(f"{SB_URL}/rest/v1/{path}", headers=HEADERS,
                                 method="PATCH", data=json.dumps(data).encode())
    with urllib.request.urlopen(req) as resp:
        return resp.status

def write_book(book_id, results_path, book_title):
    with open(results_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    sections = data.get('sections', [])
    if not sections:
        print(f"ERROR: No sections in {results_path}")
        return False

    api_patch(f"manifest_items?id=eq.{book_id}", {"extraction_status": "extracting"})

    # Create ai_frameworks parent (no description column)
    fw_result = api_post("ai_frameworks", {
        "user_id": USER_ID,
        "manifest_item_id": book_id,
        "name": book_title,
        "is_active": True,
        "tags": ["extracted"]
    })
    framework_id = fw_result[0]["id"] if isinstance(fw_result, list) else fw_result["id"]
    print(f"  Framework created: {framework_id}")

    gs = {"sum": 0, "fw": 0, "dec": 0, "act": 0, "q": 0}
    totals = {"sum": 0, "fw": 0, "dec": 0, "act": 0, "q": 0}

    for si, section in enumerate(sections):
        st = section.get("section_title", "Unknown Section")

        # Summaries
        items = section.get("summaries", [])
        if items:
            rows = [{
                "user_id": USER_ID, "manifest_item_id": book_id,
                "text": it.get("text") or it.get("content", ""), "section_title": st, "section_index": si,
                "content_type": it.get("content_type") or it.get("type", "key_concept"),
                "sort_order": gs["sum"] + i, "is_from_go_deeper": False
            } for i, it in enumerate(items)]
            api_post("manifest_summaries", rows)
            gs["sum"] += len(rows); totals["sum"] += len(rows)

        # Framework Principles
        items = section.get("frameworks", [])
        if items:
            rows = [{
                "framework_id": framework_id, "user_id": USER_ID,
                "text": it.get("text") or it.get("content", ""), "section_title": st,
                "sort_order": gs["fw"] + i, "is_from_go_deeper": False
            } for i, it in enumerate(items)]
            api_post("ai_framework_principles", rows)
            gs["fw"] += len(rows); totals["fw"] += len(rows)

        # Declarations (handle field name variants)
        items = section.get("declarations", [])
        if items:
            rows = [{
                "user_id": USER_ID, "manifest_item_id": book_id,
                "declaration_text": it.get("declaration_text") or it.get("text") or it.get("content", ""),
                "declaration_style": it.get("declaration_style") or it.get("style", "choosing_committing"),
                "value_name": it.get("value_name"),
                "section_title": st, "section_index": si,
                "sort_order": gs["dec"] + i, "is_from_go_deeper": False
            } for i, it in enumerate(items)]
            api_post("manifest_declarations", rows)
            gs["dec"] += len(rows); totals["dec"] += len(rows)

        # Action Steps (normalize content_type)
        valid_act = {"exercise","practice","habit","conversation_starter","project","daily_action","weekly_practice"}
        items = section.get("action_steps", [])
        if items:
            rows = [{
                "user_id": USER_ID, "manifest_item_id": book_id,
                "text": it.get("text") or it.get("content") or it.get("action_text", ""),
                "section_title": st, "section_index": si,
                "content_type": (it.get("content_type") or it.get("type", "practice")) if (it.get("content_type") or it.get("type", "practice")) in valid_act else "practice",
                "sort_order": gs["act"] + i, "is_from_go_deeper": False
            } for i, it in enumerate(items)]
            api_post("manifest_action_steps", rows)
            gs["act"] += len(rows); totals["act"] += len(rows)

        # Questions (normalize content_type)
        valid_q = {"reflection","implementation","recognition","self_examination","discussion","scenario"}
        items = section.get("questions", [])
        if items:
            rows = [{
                "user_id": USER_ID, "manifest_item_id": book_id,
                "text": it.get("text") or it.get("content") or it.get("question_text", ""),
                "section_title": st, "section_index": si,
                "content_type": (it.get("content_type") or it.get("type", "reflection")) if (it.get("content_type") or it.get("type", "reflection")) in valid_q else "reflection",
                "sort_order": gs["q"] + i, "is_from_go_deeper": False
            } for i, it in enumerate(items)]
            api_post("manifest_questions", rows)
            gs["q"] += len(rows); totals["q"] += len(rows)

    total = sum(totals.values())
    print(f"  Written: fw={totals['fw']}, sum={totals['sum']}, dec={totals['dec']}, act={totals['act']}, q={totals['q']}")
    print(f"  TOTAL: {total}")

    api_patch(f"manifest_items?id=eq.{book_id}", {"extraction_status": "completed"})
    print(f"  [COMPLETED] \"{book_title}\" - {total} items")
    return True

if __name__ == "__main__":
    book_id = sys.argv[1]
    results_path = sys.argv[2]
    book_title = sys.argv[3]
    print(f"Writing: {book_title}")
    write_book(book_id, results_path, book_title)
```

## Fetch Script Template

```python
# Save as /tmp/extraction_work/fetch_text.py
import urllib.request
import json
import sys

SB_URL = "https://dkcyaklyqxhkhcnpdtwf.supabase.co"
SB_KEY = ""  # Read from .env.local
HEADERS = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"}

book_id = sys.argv[1]
output_path = sys.argv[2]

req = urllib.request.Request(
    f"{SB_URL}/rest/v1/manifest_items?select=text_content,title,genres&id=eq.{book_id}",
    headers=HEADERS
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read())

if data and data[0].get("text_content"):
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(data[0]["text_content"])
    print(f"Saved {len(data[0]['text_content'])} chars to {output_path}")
else:
    print(f"ERROR: No text_content for {book_id}")
    sys.exit(1)
```
