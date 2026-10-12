#!/usr/bin/env python3
"""Check review artifacts without ever permitting deployment."""
import json
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
out=root/"photo-library-review"
data=json.loads((out/"photo-manifest.preview.json").read_text())
assert data["status"]=="internal_review_only" and data["deployable"] is False
assert len(data["photos"])==14
assert len({p["id"] for p in data["photos"]})==14
statuses={}
for sheet in ("liked-faces-contact-sheet.jpg","kaboompics-style-reference.jpg"):
    status=json.loads((out/(sheet+".status.json")).read_text())
    statuses.update({p["id"]:p["status"] for p in status})
    with Image.open(out/sheet) as img: img.verify()
for p in data["photos"]:
    assert p["usage_approval"] is False
    assert p["public_asset_path"] is None
    expected=2 if statuses[p["id"]]=="downloaded" else 0
    inspection=out/(p["id"].lower()+"-inspection.json")
    source=out/"downloaded-source-review-only"/(p["id"].lower()+"-source.bin")
    if expected:
        assert source.is_file() and source.stat().st_size>1000,p["id"]
        metadata=json.loads(inspection.read_text())
        assert metadata["id"]==p["id"]
        assert metadata["source_width"]>0 and metadata["source_height"]>0
        assert metadata["publishing_clearance"] is False
        with Image.open(source) as original:
            original.verify()
    else:
        assert not source.exists() and not inspection.exists()

    assert len(p["preview_files"])==expected,(p["id"],p["preview_files"])
    for rel in p["preview_files"]:
        path=out/rel
        assert path.resolve().is_relative_to(out.resolve())
        with Image.open(path) as img:
            assert img.format=="WEBP"
            assert img.width<=1440
print("Validated 14 manifest entries and their WebP research previews; no public use approved.")
