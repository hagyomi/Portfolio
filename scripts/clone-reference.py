"""Create a local, same-origin study copy of the public ATLASON site."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
from urllib.request import Request, urlopen
import hashlib
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://atlason.com'
ASSETS = ROOT / 'assets'
ASSETS.mkdir(exist_ok=True)
PAGES = {}
FILES = {}
ERRORS = []
if (ROOT / 'reference-manifest.json').exists():
    FILES.update(json.loads((ROOT / 'reference-manifest.json').read_text(encoding='utf-8'))['assets'])

def fetch(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=45) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise

def local_asset(url):
    url = html.unescape(urljoin(ORIGIN, url))
    path = urlsplit(url).path
    if path.startswith('/dist/') or path.startswith('/favicon/'):
        return path
    ext = Path(path).suffix.lower()
    if ext not in ('.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg', '.gif', '.mp4', '.woff', '.woff2', '.ico'):
        ext = '.bin'
    return '/assets/' + hashlib.sha256(url.encode()).hexdigest()[:20] + ext

def queue_asset(url):
    url = html.unescape(urljoin(ORIGIN, url))
    if urlsplit(url).netloc != 'atlason.com':
        return url
    FILES[url] = local_asset(url)
    return FILES[url]

def process_page(path, source):
    # Avoid editor warnings about Unicode line/paragraph separators in source text.
    source = source.replace('\u2028', '\n').replace('\u2029', '\n')
    # Keep the load event while avoiding entity-encoded JavaScript diagnostics.
    source = re.sub(r'onload="[^"]*vite-script-loaded[^"]*"',
                    'onload="document.dispatchEvent(new CustomEvent(\'vite-script-loaded\', { detail: { path: \'src/js/app.ts\' } }));"', source)
    # Tailwind accidentally scanned process-manager labels as CSS properties.
    source = re.sub(r'\.[^{}]*\{\s*program:\s*[^{}]+\}', '', source)
    source = re.sub(r'vertical-align:\s*middle;\s*(?=display:\s*block)', '', source)
    # Remove third-party analytics and service metadata; retain application code.
    source = re.sub(r'<script\b[^>]*>.*?</script>', lambda m: m[0] if '/dist/' in m[0].split('>')[0] else '', source, flags=re.S)
    source = re.sub(r'<link[^>]*(?:rel="manifest"|rel="canonical")[^>]*>', '', source)
    # A single local responsive image avoids downloading every srcset size.
    def image_tag(m):
        tag = m[0]
        src = re.search(r'\bsrc="([^"]*)"', tag)
        srcset = re.search(r'\bsrcset="([^"]*)"', tag)
        candidate = src[1] if src else ''
        if not candidate or urlsplit(candidate).path in ('', '/'):
            candidate = srcset[1].split(',')[0].strip().rsplit(' ', 1)[0] if srcset and srcset[1] else ''
        tag = re.sub(r'\s(?:srcset|sizes)="[^"]*"', '', tag)
        if candidate:
            local = queue_asset(candidate)
            tag = re.sub(r'\bsrc="[^"]*"', 'src="' + local + '"', tag) if src else tag[:-1] + ' src="' + local + '">'
        return tag
    source = re.sub(r'<img\b[^>]*>', image_tag, source)
    # Download media, stylesheet and application entries.
    def resource(m):
        prefix, url = m[1], m[2]
        absolute = urljoin(ORIGIN, html.unescape(url))
        p = urlsplit(absolute).path
        if urlsplit(absolute).netloc == 'atlason.com' and (p.startswith(('/dist/', '/media/', '/media_optimised/', '/favicon/'))):
            return prefix + queue_asset(absolute) + '"'
        return m[0]
    source = re.sub(r'((?:src|href|poster|data-src)=")([^"]+)"', resource, source)
    # Fonts are declared in inline styles as well as in the stylesheet.
    source = re.sub(r'url\(([^)]+)\)', lambda m: 'url(' + queue_asset(m[1].strip('\"\'')) + ')' if '/dist/' in m[1] else m[0], source)
    source = source.replace('https://atlason.com', '')
    source = source.replace('</head>', '<link rel="stylesheet" href="/portfolio-tokens.css"><link rel="stylesheet" href="/portfolio-reference.css"><script defer src="/portfolio-enhancements.js"></script></head>')
    # Show provenance without overlaying the reference composition.
    source = source.replace('</body>', '<!-- Local reference study. Original design, content and imagery: ATLASON. -->\n</body>')
    target = ROOT / path.lstrip('/') / 'index.html'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(source, encoding='utf-8')

pending = {'/', '/atlason', '/works', '/works/archive', '/more'}
while pending and len(PAGES) < 80:
    batch = sorted(pending - PAGES.keys())
    pending.clear()
    with ThreadPoolExecutor(max_workers=8) as pool:
        jobs = {pool.submit(fetch, ORIGIN + path): path for path in batch}
        for job in as_completed(jobs):
            path = jobs[job]
            try:
                source = job.result().decode('utf-8')
                PAGES[path] = True
                for tag in re.findall(r'<b-pagination\b[^>]*>', source):
                    base = re.search(r'url="([^"]+)"', tag)
                    next_page = re.search(r'next="([^"]+)"', tag)
                    if base and next_page:
                        pending.add(urlsplit(urljoin(ORIGIN, base[1])).path.rstrip('/') + '/p' + next_page[1])
                for href in re.findall(r'href="([^"]+)"', source):
                    parsed = urlsplit(urljoin(ORIGIN, html.unescape(href)))
                    if parsed.netloc == 'atlason.com' and not parsed.query and parsed.path.startswith(('/works', '/more', '/atlason')) and not Path(parsed.path).suffix:
                        pending.add(unquote(parsed.path).rstrip('/') or '/')
                process_page(path, source)
            except Exception as exc:
                ERRORS.append({'page': path, 'error': str(exc)})
    pending -= PAGES.keys()
    print(f'Pages: {len(PAGES)}; assets queued: {len(FILES)}', flush=True)

done = {url for url, path in FILES.items() if (ROOT / path.lstrip('/')).exists()}
while set(FILES) - done:
    batch = sorted(set(FILES) - done)
    with ThreadPoolExecutor(max_workers=8) as pool:
        jobs = {pool.submit(fetch, url): url for url in batch}
        for job in as_completed(jobs):
            url = jobs[job]
            done.add(url)
            try:
                data = job.result()
                target = ROOT / FILES[url].lstrip('/')
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.suffix in ('.js', '.css'):
                    source = data.decode('utf-8')
                    if target.suffix == '.js':
                        for module in re.findall(r'[\"\']((?:\./)?[\w-]+\.(?:js|css))[\"\']', source):
                            queue_asset(urljoin(url, module))
                        # Local copy must not register a remote site's service worker.
                        source = re.sub(r'navigator\.serviceWorker\.register\([^;]+?\)\}', 'Promise.resolve()}', source)
                    else:
                        source = re.sub(r'url\(([^)]+)\)', lambda m: 'url(' + queue_asset(urljoin(url, m[1].strip('\"\''))) + ')' if not m[1].startswith('data:') else m[0], source)
                    data = source.encode('utf-8')
                target.write_bytes(data)
            except Exception as exc:
                ERRORS.append({'asset': url, 'error': str(exc)})
    print(f'Assets processed: {len(done)} / {len(FILES)}', flush=True)

(ROOT / 'reference-manifest.json').write_text(json.dumps({'source': ORIGIN, 'pages': sorted(PAGES), 'assets': FILES, 'errors': ERRORS}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Complete: {len(PAGES)} pages, {len(done)} assets, {len(ERRORS)} errors.', flush=True)
