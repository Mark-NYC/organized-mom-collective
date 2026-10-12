#!/usr/bin/env python3
"""Static safety checks for OMC lifestyle library; no network or image downloads."""
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
d=json.loads((root/"docs/brand/lifestyle-photo-library.json").read_text())
assets=d["assets"]
assert len(assets)==17, "Expected 5 Kaboompics + 12 faces (including 3 rejected)"
ids={a["id"] for a in assets}
assert len(ids)==len(assets)
liked={"F03","F04","F05","F07","F08","F09","F10","F11","F12"}
rejected={"F01","F02","F06"}
for asset in assets:
    assert asset["publishing_clearance"] is False,asset["id"]
    assert asset["public_path"] is None,asset["id"]
    assert asset["source_url"].startswith("https://")
    assert asset["creator"] and asset["source"]
    if asset["id"] in liked:
        assert asset["owner_visual_status"]=="liked_by_owner"
    if asset["id"] in rejected:
        assert asset["owner_visual_status"]=="rejected_by_owner"
        assert not asset["usage_candidates"]
assert {"K01","K02","K03","K05","K06"}.issubset(ids)
print("Static catalog safety checks passed: 17 entries; 9 liked, 3 rejected; 0 published.")
