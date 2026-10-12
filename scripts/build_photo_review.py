#!/usr/bin/env python3
"""Build a visual review sheet from vetted candidate SOURCE PAGES.

Downloads source image files from Pexels' canonical image CDN path.
This is a review artifact only; nothing is deployed or licensed beyond source terms.
"""
import io, json, os, pathlib, urllib.request
from PIL import Image, ImageDraw, ImageFont
ROOT=pathlib.Path(__file__).resolve().parents[1]
items=json.loads((ROOT/"docs/brand/photo-candidates.json").read_text())["photos"]
out=ROOT/"photo-library-review";out.mkdir(exist_ok=True)
tiles=[]
for idx,p in enumerate(items,1):
    num=p["id"].split("-")[-1]
    url=f"https://images.pexels.com/photos/{num}/pexels-photo-{num}.jpeg?auto=compress&cs=tinysrgb&w=900"
    try:
        request=urllib.request.Request(url,headers={"User-Agent":"OrganizedMomCollectivePhotoResearch/1.0"})
        with urllib.request.urlopen(request,timeout=25) as response:
            data=response.read()
        im=Image.open(io.BytesIO(data)).convert("RGB")
        im.save(out/f"{p['id']}.jpg",quality=90)
        tile=Image.new("RGB",(400,355),"white")
        preview=im.copy();preview.thumbnail((380,270))
        tile.paste(preview,((400-preview.width)//2,5+(270-preview.height)//2))
        d=ImageDraw.Draw(tile)
        d.text((10,285),f"{idx:02d}. {p['title'][:46]}",fill="black")
        d.text((10,310),f"{p['photographer']} | {p['id']}",fill="#555555")
        tiles.append(tile)
        print(f"OK {p['id']}")
    except Exception as error:
        print(f"FAILED {p['id']}: {error}")
if not tiles: raise SystemExit("No photos downloaded; inspect outbound network access")
cols=3;rows=(len(tiles)+cols-1)//cols
sheet=Image.new("RGB",(cols*400,rows*355),"#eeeeee")
for i,t in enumerate(tiles):sheet.paste(t,((i%cols)*400,(i//cols)*355))
sheet.save(out/"contact-sheet.jpg",quality=88)
(out/"README.txt").write_text("PREVIEW ONLY. Not cleared for publishing. Confirm provenance and releases before use.\n")
print(f"Contact sheet saved, {len(tiles)} candidates.")
