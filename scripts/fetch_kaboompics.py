#!/usr/bin/env python3
"""
Fetch Kaboompics photos named in a photo request, for review only.

    python scripts/fetch_kaboompics.py docs/brand/photo-requests/HC-03.json

Runs in GitHub Actions (Kaboompics isn't reachable from Claude's cloud container).
For each seed (a photo page or a photoshoot page), collects the photo pages, and for each
photo saves: the page's main image (og:image, or the largest image URL for that photo id),
its title, creator and the license wording found on the page. Output goes to
design/photography/kaboompics/<request>/ with a manifest and a numbered contact sheet.

Nothing here clears a photo for publication. Rules: docs/brand/PHOTO-DISCOVERY.md.
"""
import html, json, pathlib, re, sys, urllib.parse, urllib.request
from datetime import date
from io import BytesIO

from PIL import Image, ImageDraw

HEADERS = {'User-Agent': 'Mozilla/5.0 (OMC photo review; contact via repository)'}
ROOT = pathlib.Path(__file__).resolve().parent.parent


def get(url, binary=False):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else data.decode('utf-8', errors='replace')


def photo_links(page_html):
    # Absolute or relative, quoted with " or ', in href or any data attribute (gallery pages vary).
    links = re.findall(r'((?:https?://(?:www\.)?kaboompics\.com)?/photo/(\d+)/[^"\'#?\s<>]+)', page_html)
    out = {}
    for full, pid in links:
        out.setdefault(pid, urllib.parse.urljoin('https://kaboompics.com', full))
    return out


def meta(page_html, prop):
    m = re.search(r'<meta[^>]+(?:property|name)="%s"[^>]+content="([^"]*)"' % re.escape(prop), page_html)
    if not m:
        m = re.search(r'<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="%s"' % re.escape(prop), page_html)
    return html.unescape(m.group(1)) if m else None


def license_text(page_html):
    text = re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>', ' ', page_html)
    text = html.unescape(re.sub(r'<[^>]+>', ' ', text))
    text = re.sub(r'\s+', ' ', text)
    hits = []
    for kw in ('commercial', 'Editorial', 'editorial', 'License', 'license'):
        for m in re.finditer(kw, text):
            snippet = text[max(0, m.start() - 120): m.end() + 120].strip()
            if snippet not in hits:
                hits.append(snippet)
    return hits[:6], text


def full_size(req, out):
    """Download the original file for each chosen photo id, via the photo page's own download link
    (the hash offered as both medium and original), scaled to at most 2400 px on the long edge."""
    manifest = []
    for pid in req['full_size']:
        url = f'https://kaboompics.com/photo/{pid}/photo'
        rec = {'kaboompics_id': pid, 'source_url': url, 'checked': str(date.today())}
        try:
            page = get(url)
            rec['title'] = meta(page, 'og:title') or ''
            rec['license_snippets'], text = license_text(page)
            rec['editorial_only_mentioned'] = bool(re.search(r'editorial use only|for editorial use', text, re.I))
            sizes = re.findall(r'FULL SIZE \((\d+) x (\d+) px\)', text)
            rec['full_size_on_page'] = sizes[0] if sizes else None
            hashes = re.findall(r'/download/([0-9a-f]{32})/(medium|original)', page)
            main = [h for h, kind in hashes if kind == 'medium' and (h, 'original') in hashes]
            h = main[0] if main else None
            rec['download_url'] = f'https://kaboompics.com/download/{h}/original' if h else None
            im = Image.open(BytesIO(get(rec['download_url'], binary=True)))
            im.load()
            rec['original_size'] = im.size
            im = im.convert('RGB')
            im.thumbnail((2400, 2400), Image.LANCZOS)
            fn = f'{pid}-2400.jpg'
            im.save(out / fn, quality=92)
            rec['file'], rec['width'], rec['height'], rec['status'] = fn, im.size[0], im.size[1], 'downloaded'
        except Exception as e:
            rec['status'] = f'failed: {e}'
        manifest.append(rec)
        print(pid, rec['status'], rec.get('original_size'))
    (out / 'manifest.json').write_text(json.dumps({'research_only': True, 'publishing_clearance': False, 'photos': manifest}, indent=2))


def main():
    req_path = pathlib.Path(sys.argv[1])
    req = json.loads(req_path.read_text())
    name = req_path.stem
    out = ROOT / 'design' / 'photography' / 'kaboompics' / name
    out.mkdir(parents=True, exist_ok=True)
    if req.get('full_size'):
        return full_size(req, out)
    photos = {}
    for seed in req['seeds']:
        try:
            page = get(seed)
        except Exception as e:
            print('seed failed', seed, e)
            continue
        m = re.search(r'/photo/(\d+)/', seed)
        if m:
            photos.setdefault(m.group(1), seed)
        found = photo_links(page)
        print('seed', seed, len(found), 'photo links')
        if not found and not m:
            # Keep the page so the next request can use the format it actually has.
            (out / f'seed-{len(list(out.glob("seed-*.html"))) + 1}.html').write_text(page[:400_000])
        for pid, url in found.items():
            photos.setdefault(pid, url)
    lo, hi = req.get('id_range', [0, -1])
    for pid in range(lo, hi + 1):
        photos.setdefault(str(pid), f'https://kaboompics.com/photo/{pid}/photo')
    ids = list(photos)[: req.get('max_photos', 40)]
    manifest = []
    thumbs = []
    for pid in ids:
        url = photos[pid]
        rec = {'kaboompics_id': pid, 'source_url': url, 'checked': str(date.today())}
        try:
            page = get(url)
            rec['title'] = meta(page, 'og:title') or ''
            rec['description'] = meta(page, 'og:description') or meta(page, 'description') or ''
            creator = re.search(r'(Karolina Grabowska|Karolina Kaboompics)', page)
            rec['creator_found_on_page'] = creator.group(1) if creator else None
            rec['license_snippets'], text = license_text(page)
            rec['editorial_only_mentioned'] = bool(re.search(r'editorial use only|for editorial use', text, re.I))
            cands = re.findall(r'https://[^"\'\s<>]+?%s[^"\'\s<>]*?\.(?:jpe?g|webp|png)' % pid, page)
            og = meta(page, 'og:image')
            rec['image_candidates'] = sorted(set(cands))[:12]
            downloads = sorted(set(urllib.parse.urljoin(url, html.unescape(h)) for h in re.findall(r'href="([^"]*download[^"]*)"', page, re.I)))
            rec['download_links'] = downloads[:10]
            img_url = urllib.parse.urljoin(url, og) if og else (cands[0] if cands else None)
            rec['image_url'] = img_url
            raw = get(img_url, binary=True)
            im = Image.open(BytesIO(raw))
            im.load()
            rec['width'], rec['height'] = im.size
            fn = f'{pid}.jpg'
            im.convert('RGB').save(out / fn, quality=92)
            rec['file'] = fn
            rec['status'] = 'downloaded'
            t = im.convert('RGB')
            t.thumbnail((360, 360))
            thumbs.append((pid, t))
        except Exception as e:
            rec['status'] = f'failed: {e}'
        manifest.append(rec)
        print(pid, rec.get('status'), rec.get('width'), rec.get('title', '')[:60])
    (out / 'manifest.json').write_text(json.dumps({'request': str(req_path), 'research_only': True, 'publishing_clearance': False, 'photos': manifest}, indent=2))
    if thumbs:
        cols = 5
        rows = (len(thumbs) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * 370, rows * 390), 'white')
        d = ImageDraw.Draw(sheet)
        for i, (pid, t) in enumerate(thumbs):
            x, y = (i % cols) * 370 + 5, (i // cols) * 390 + 25
            sheet.paste(t, (x, y))
            d.text((x, y - 18), pid, fill='black')
        sheet.save(out / 'contact-sheet.jpg', quality=85)


if __name__ == '__main__':
    main()
