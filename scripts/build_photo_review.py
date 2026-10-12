#!/usr/bin/env python3
"""Create side-by-side research contact sheets. Never deploy or mark rights cleared."""
import io, json, pathlib, re, html, urllib.request, urllib.parse
from html.parser import HTMLParser
from PIL import Image, ImageDraw, ImageOps

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "photo-library-review"
OUT.mkdir(exist_ok=True)
EXPORTS = OUT / 'optimized-preview-only'
EXPORTS.mkdir(exist_ok=True)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; OMCResearch/1.0)"}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=25) as response:
        return response.read()

def image_for(url, source):
    if source == "Pexels":
        match = re.search(r"-(\d+)/?$", url)
        if not match: raise ValueError("Missing Pexels photo id")
        n = match.group(1)
        return get(f"https://images.pexels.com/photos/{n}/pexels-photo-{n}.jpeg?w=1000")
    page = get(url).decode("utf-8", errors="replace")
    # Unsplash's OG preview may be gated; prefer the direct images.unsplash.com
    # photography CDN URL embedded in its public page.
    if source == "Unsplash":
        candidates = re.findall(r'https?://images[.]unsplash[.]com/[^"\s<>]+', html.unescape(page))
        for candidate in candidates:
            clean = html.unescape(candidate).replace("\\\\u0026", "&")
            if "\\\\u" in clean:
                continue
            try:
                return get(clean.split("&amp;")[0])
            except Exception:
                continue
        raise RuntimeError("Unsplash image CDN unavailable; source page remains valid")
    class OGImageParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.image = None
        def handle_starttag(self, tag, attrs):
            values = dict(attrs)
            if tag == "meta" and values.get("property") in ("og:image", "og:image:url"):
                self.image = values.get("content")
    parser = OGImageParser()
    parser.feed(page)
    if not parser.image: raise RuntimeError("Cannot find og:image on source page")
    imgurl = urllib.parse.urljoin(url, html.unescape(parser.image))
    if urllib.parse.urlparse(imgurl).scheme != "https":
        raise ValueError("Unexpected image URL scheme")
    return get(imgurl)

def make_tile(photo, i):
    raw=image_for(photo["url"],photo["source"])
    im=Image.open(io.BytesIO(raw)).convert("RGB")
    # Internal previews only; never publish or commit as site assets.
    for width in (800, 1440):
        preview = im.copy()
        preview.thumbnail((width, 2000), Image.Resampling.LANCZOS)
        preview.save(EXPORTS / (photo["id"].lower() + "-" + str(width) + ".webp"),
                     "WEBP", quality=82, method=6)

    frame=Image.new("RGB",(430,370),"#f8f7f3")
    cropped=ImageOps.contain(im,(410,288))
    frame.paste(cropped,((430-cropped.width)//2,8+(288-cropped.height)//2))
    d=ImageDraw.Draw(frame)
    d.text((12,305),f'{photo["id"]} | {photo["title"][:46]}',fill="#303030")
    d.text((12,330),f'{photo["creator"][:40]} | {photo.get("visual_review","reference")}',fill="#666666")
    return frame

def render(photos,name):
    tiles=[]
    results=[]
    for i,p in enumerate(photos):
        try:
            tiles.append(make_tile(p,i))
            print("OK",p["id"])
            results.append({"id":p["id"],"status":"downloaded"})
        except Exception as e:
            print("FAILED",p["id"],str(e))
            results.append({"id":p["id"],"status":"failed","error":str(e)})
            blank=Image.new("RGB",(430,370),"#fff3ef")
            d=ImageDraw.Draw(blank)
            d.text((12,40),p["id"]+" - preview unavailable",fill="#553333")
            d.text((12,70),str(e)[:55],fill="#553333")
            tiles.append(blank)
    if not tiles:return (0,0)
    cols=3;rows=(len(tiles)+cols-1)//cols
    sheet=Image.new("RGB",(cols*430,rows*370),"white")
    for i,tile in enumerate(tiles):sheet.paste(tile,((i%cols)*430,(i//cols)*370))
    sheet.save(OUT/name,quality=90)
    (OUT/(name+".status.json")).write_text(json.dumps(results,indent=2))
    return sum(x["status"]=="downloaded" for x in results),len(results)

faces=json.loads((ROOT/"docs/brand/faces-approval-batch-02.json").read_text())["photos"]
favorites=[p for p in faces if p.get("visual_review")=="liked_by_owner"]
faces_ok, faces_total = render(favorites,"liked-faces-contact-sheet.jpg")
kab=[
("K01","Everyday cleaning basket","https://kaboompics.com/photo/32281/everyday-domestic-bliss-a-woman-s-journey-through-home-cleaning-and-comfort"),
("K02","Home care basket","https://kaboompics.com/photo/32280/close-up-of-arranging-a-home-care-basket-on-a-sofa"),
("K03","Floral notebook & coffee","https://kaboompics.com/photo/18171/floral-notebook-coffee-and-laptop-for-creative-work-from-home"),
("K05","Cereal containers","https://kaboompics.com/photo/6669/containers-of-cereals-in-kitchen-cupboard"),
("K06","Bread groceries","https://kaboompics.com/photo/28538/fresh-bread-on-the-kitchen-counter-ciabatta-baguette")
]
kab_ok, kab_total = render([{"id":i,"title":title,"creator":"Karolina Grabowska","source":"Kaboompics","url":url} for i,title,url in kab],"kaboompics-style-reference.jpg")
(OUT/"README.txt").write_text("VISUAL RESEARCH ONLY. No downloaded image is legally cleared for publication.\n")
print(f"Successful previews: {faces_ok}/{faces_total} faces; {kab_ok}/{kab_total} Kaboompics")
if kab_ok != kab_total or faces_ok < 6:
    raise SystemExit("Required comparison photos missing; inspect artifact status reports.")
if faces_ok != faces_total:
    print(f"PARTIAL REVIEW: {faces_total-faces_ok} selected faces not downloaded (Unsplash HTTP 401). Not publishing cleared; see status reports.")

# Output manifest is a review artifact, never a production asset registry.
catalog = [{"id":i,"title":title,"creator":"Karolina Grabowska",
            "source":"Kaboompics","url":url,"visual_review":"house_style_reference"}
           for i,title,url in kab] + favorites
manifest = []
for p in catalog:
    preview_files = []
    for width in (800,1440):
        name = p["id"].lower() + "-" + str(width) + ".webp"
        if (EXPORTS/name).exists():
            preview_files.append("optimized-preview-only/" + name)
    manifest.append({"id":p["id"],"title":p["title"],"source":p["source"],
                     "creator":p["creator"],"source_url":p["url"],
                     "owner_visual_status":p["visual_review"],
                     "preview_files":preview_files,
                     "license_review":"pending_per_image",
                     "model_release_review":"pending",
                     "usage_approval":False,"public_asset_path":None,
                     "notes":"Internal evaluation only; no implied customer endorsement"})
(OUT/"photo-manifest.preview.json").write_text(json.dumps({
    "status":"internal_review_only","deployable":False,
    "version":"pilot-2026-10","photos":manifest},indent=2)+"\n")
