"""Build the AI video index and one detail page per film."""
from pathlib import Path
from html import escape
import re

ROOT = Path(__file__).resolve().parents[1]
FILMS = [
    ('coffee-ad', 'SIPON — 커피 광고', 'sipon'),
    ('pawly', 'PAWLY', 'pawly'),
    ('saekomdalkom', '새콤달콤', 'saekomdalkom-thumbnail'),
]


def build():
    template = (ROOT / 'more/index.html').read_text(encoding='utf-8')
    start = template.index('<section class="portfolio-ai-videos"')
    end = template.rindex('</section>') + len('</section>')

    def page(content, title):
        source = template[:start] + '<section class="portfolio-ai-videos" aria-label="AI video 작업">' + content + '</section>' + template[end:]
        source = re.sub(r'<title>.*?</title>', '<title>' + escape(title) + ' · Design Portfolio</title>', source)
        return source

    cards = []
    for slug, title, poster in FILMS:
        href = f'/more/{slug}/'
        image = f'/assets/portfolio/video/{poster}.png'
        video = f'/assets/portfolio/video/{slug}.mp4'
        cards.append(f'<a href="{href}" aria-label="{escape(title)} 영상 보기"><img src="{image}" alt="{escape(title)}" loading="lazy" decoding="async"><p>{escape(title)} <span>AI video ↗</span></p></a>')
        cards[-1] = re.sub(r'<p>.*?</p>', '', cards[-1])
        content = f'<nav class="portfolio-film-nav" aria-label="AI video 탐색"><a href="/more/">← AI video 목록</a></nav><figure id="{slug}"><video playsinline preload="metadata" controls poster="{image}" aria-label="{escape(title)} 영상"><source src="{video}" type="video/mp4">영상을 재생하려면 <a href="{video}">{escape(title)} 다운로드</a></video><figcaption>{escape(title)} <span>AI video</span></figcaption></figure>'
        if slug == 'coffee-ad':
            content = re.sub(r'<figcaption>.*?</figcaption>', '', content)
            content += (ROOT / 'scripts/content/sipon.html').read_text(encoding='utf-8')
        elif slug == 'pawly':
            content = re.sub(r'<figcaption>.*?</figcaption>', '', content)
            content += (ROOT / 'scripts/content/pawly.html').read_text(encoding='utf-8')
        elif slug == 'saekomdalkom':
            content = re.sub(r'<figcaption>.*?</figcaption>', '', content)
            content += (ROOT / 'scripts/content/saekomdalkom.html').read_text(encoding='utf-8')
        content += '<nav class="portfolio-film-nav" aria-label="다른 AI video">' + ''.join(f'<a href="/more/{other}/">{escape(label)} ↗</a>' for other, label, _ in FILMS if other != slug) + '</nav>'
        target = ROOT / 'more' / slug / 'index.html'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(page(content, title), encoding='utf-8')

    (ROOT / 'more/index.html').write_text(page(''.join(cards), 'AI video'), encoding='utf-8')
    home = ROOT / 'index.html'
    source = home.read_text(encoding='utf-8')
    for slug, _, _ in FILMS:
        source = source.replace(f'/more/#{slug}', f'/more/{slug}/')
    source = re.sub(r'<p>[^<]* <span>AI video ↗</span></p>', '', source)
    home.write_text(source, encoding='utf-8')
    print('Built AI video index and 3 individual film pages.')


if __name__ == '__main__':
    build()
