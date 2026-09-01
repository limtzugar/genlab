#!/usr/bin/env python3
"""Run a pipeline via /api/invent and capture all SSE events."""
import sys, json, urllib.request, urllib.error
sys.stdout = open(sys.stdout.fileno(), "w", buffering=1)

PROMPT = sys.argv[1] if len(sys.argv) > 1 else "prosty licznik kliknięć na stronie www, offline-first"
TIMEOUT = 300

req = urllib.request.Request(
    "http://localhost:3000/api/invent",
    data=json.dumps({"prompt": PROMPT, "mode": "invent"}).encode(),
    headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
    method="POST",
)

print(f"=== Running pipeline: {PROMPT} ===\n---")
event_counts = {}
hw_count = 0
schematic_prompt_shown = False
schematic_image_shown = False

try:
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        buffer = ""
        while True:
            chunk = resp.read(4096)
            if not chunk:
                break
            buffer += chunk.decode("utf-8", errors="replace")
            while "\n\n" in buffer:
                block, buffer = buffer.split("\n\n", 1)
                lines = block.split("\n")
                event = "message"
                data = ""
                for ln in lines:
                    if ln.startswith("event: "):
                        event = ln[7:]
                    elif ln.startswith("data: "):
                        data += ln[6:]
                if not data or event == "ping" or event == "message" and not data.startswith("{"):
                    continue
                event_counts[event] = event_counts.get(event, 0) + 1
                try:
                    payload = json.loads(data)
                except Exception:
                    payload = data
                # Print summary line per event
                if event == "stage":
                    print(f"[stage] {payload.get('stage')}: {payload.get('label')}")
                elif event == "gene":
                    print(f"[gene] {payload.get('techName')} (AHI {payload.get('ahiScore')})")
                elif event == "hardware":
                    if isinstance(payload, dict) and payload.get("skipped"):
                        print(f"[hardware] SKIPPED: {payload.get('reason')}")
                    else:
                        hw_count += 1
                        rec = "★" if payload.get("recommended") else " "
                        print(f"[hardware] {hw_count}. {rec} {payload.get('name')} [{payload.get('category')}] - {payload.get('role', '')[:60]}")
                elif event == "schematic-prompt":
                    schematic_prompt_shown = True
                    print(f"[schematic-prompt] kind={payload.get('kind')} size={payload.get('size')} prompt_len={len(payload.get('promptText',''))}")
                elif event == "schematic-image":
                    if isinstance(payload, dict) and payload.get("skipped"):
                        print(f"[schematic-image] SKIPPED: {payload.get('reason')}")
                    else:
                        schematic_image_shown = True
                        url = payload.get("imageDataUrl", "")
                        b64_len = len(url)
                        print(f"[schematic-image] kind={payload.get('kind')} size={payload.get('size')} model={payload.get('modelUsed')} b64_len={b64_len}")
                elif event == "fusion":
                    print(f"[fusion] {payload.get('name')} (AHI {payload.get('ahi',{}).get('score')})")
                elif event == "analysis":
                    print(f"[analysis] summary: {payload.get('summary','')[:80]}")
                elif event == "done":
                    print(f"\n[done] session={payload.get('sessionId')}")
                    break
                elif event == "error":
                    print(f"\n[ERROR] {payload.get('message','')[:200]} (class={payload.get('classification')})")
                    break
                else:
                    print(f"[{event}] {str(payload)[:80]}")
except Exception as e:
    print(f"\n[NETWORK ERROR] {e}")

print("\n=== EVENT COUNTS ===")
for k, v in sorted(event_counts.items()):
    print(f"  {k}: {v}")
print(f"\nHardware proposals: {hw_count}")
print(f"Schematic prompt built: {schematic_prompt_shown}")
print(f"Schematic image generated: {schematic_image_shown}")
