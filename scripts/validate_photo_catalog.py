#!/usr/bin/env python3
"""Static safety checks for OMC lifestyle library; no network or image downloads."""
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
d=json.loads((root/"docs/brand/lifestyle-photo-library.json").read_text())
assets=d["assets"]
ids={a["id"] for a in assets}
assert len(ids)==len(assets)
liked={"F03","F04","F05","F07","F08","F09","F10","F11","F12"}
rejected={"F01","F02","F06"}
published=0
for asset in assets:
    assert asset["source_url"].startswith("https://")
    assert asset["creator"] and asset["source"]
    if asset["publishing_clearance"]:
        # Cleared only with a recorded review and the exported files on disk. Without a
        # per-photo owner sign-off, only Kaboompics (standing owner approval, 2026-10-12) qualifies.
        rec=asset["clearance_record"]
        assert rec["approval"] and rec["date"] and rec["license"] and rec["approved_placements"],asset["id"]
        assert asset["source"]=="Kaboompics" or "owner" in rec.get("approved_by",""),asset["id"]
        path=asset["public_path"]
        assert path and path.startswith("public/"),asset["id"]
        stem,rest=path.split("{")
        widths,suffix=rest.split("}")
        for w in widths.split(","):
            assert (root/f"{stem}{w}{suffix}").exists(),(asset["id"],w)
        assert asset["id"] not in rejected,asset["id"]
        published+=1
    else:
        assert asset["public_path"] is None,asset["id"]
    if asset["id"] in liked:
        assert asset["owner_visual_status"]=="liked_by_owner"
    if asset["id"] in rejected:
        assert asset["owner_visual_status"]=="rejected_by_owner"
        assert not asset["usage_candidates"]
        assert not asset["publishing_clearance"]
assert {"K01","K02","K03","K05","K06"}.issubset(ids)
print(f"Static catalog safety checks passed: {len(assets)} entries; 9 liked, 3 rejected; {published} published.")
