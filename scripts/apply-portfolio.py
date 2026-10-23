"""Apply the five supplied Figma projects to the existing ATLASON-based shell."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
import re
import json

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / 'scripts' / 'reference-templates'
TEMPLATES.mkdir(exist_ok=True)
FIGMA = 'https://www.figma.com/design/GBZ2x5EOxyd5KHQS6s4Yn3/'
PROJECTS = [
    dict(slug='kombucha', title='TEAZEN Kombucha', ko='티젠 콤부차', node='14:110', category='Promotion', ratio=1,
         summary='취향을 고르고, 혜택을 발견하는 콤부차 프로모션.',
         description='골라담기, 취향 테스트, 랜덤 쿠폰과 보틀 증정 혜택을 하나의 흐름으로 구성한 이벤트 디자인입니다. 오렌지 포인트 컬러와 제품 이미지를 중심으로 혜택의 위계를 정리했습니다.',
         focus='혜택의 위계 · 제품 중심 비주얼 · 참여 흐름', gallery=[(3,'제품 구성'),(4,'취향 테스트'),(6,'랜덤 쿠폰 비주얼'),(5,'보틀 증정 구성')]),
    dict(slug='laka', title='laka', ko='라카', node='14:415', category='Detail Page', ratio=2,
         summary='컬러와 윤기를 섬세하게 전하는 뷰티 상세 디자인.',
         description='Popping Balloon Tint의 컬러, 텍스처와 제품 특성을 순서대로 소개합니다. 모델 컷과 제품 클로즈업, 컬러 차트를 교차 배치해 브랜드의 분위기와 제품 정보를 함께 전달했습니다.',
         focus='컬러 스토리 · 텍스처 · 제품 정보', gallery=[(2,'모델 이미지 01'),(3,'모델 이미지 02'),(4,'Volume & Moisture'),(5,'Clear & Bloom')]),
    dict(slug='kamill', title='Kamill', ko='카밀', node='14:915', category='Detail Page', ratio=3,
         summary='자연에서 시작되는 핸드케어의 시각적 이야기.',
         description='캐모마일과 식물성 원료의 이미지를 바탕으로 카밀의 핸드케어 제품을 소개합니다. 차분한 뉴트럴 톤과 넓은 여백으로 브랜드 이야기, 제품군, 선물 구성을 연결했습니다.',
         focus='자연의 색 · 브랜드 스토리 · 제품 탐색', gallery=[(2,'브랜드 비주얼'),(3,'제품 이야기'),(4,'제품 라인업')]),
    dict(slug='tous', title='TOUS les JOURS', ko='뚜레쥬르', node='20:1811', category='Web Design', ratio=1, website='https://hagyomi.github.io/Touslesjours/',
         summary='갓 구운 빵처럼 따뜻한 일상을 담은 베이커리 웹 디자인.',
         description='메뉴, 계절 선물, Daily Picks, 이벤트, 브랜드 스토리와 매장 안내로 이어지는 웹 화면입니다. 빵과 커피의 사진, 여유 있는 타이포그래피로 일상의 따뜻한 순간을 표현했습니다.',
         focus='메뉴 탐색 · 시즌 콘텐츠 · 브랜드 경험', gallery=[(1,'Hero 이미지 레이어 01'),(2,'Hero 이미지 레이어 02'),(3,'Hero 이미지 레이어 03')]),
    dict(slug='kvelo', title='K VELO', ko='케이벨로', node='20:2871', category='Web Design', ratio=2, website='https://hagyomi.github.io/k-velo/',
         summary='자전거와 여행, 새로운 경험으로 이어지는 웹 디자인.',
         description='라이딩 여행과 자전거 행사를 탐색하고 라이더의 이야기를 만나는 화면입니다. 넓은 라이딩 사진과 경쾌한 포인트 컬러를 사용해 여행 콘텐츠의 활기와 탐색 흐름을 담았습니다.',
         focus='여행 탐색 · 행사 정보 · 라이더 이야기', gallery=[(2,'라이딩 여행 01'),(3,'라이딩 여행 02'),(4,'라이딩 여행 03')]),
]
WORK_PROJECTS = [p for p in PROJECTS if p['category'] != 'Web Design']
WEBSITE_PROJECTS = [p for p in PROJECTS if p['category'] == 'Web Design']

class Node:
    def __init__(self, tag, attrs, start, inner):
        self.tag, self.attrs, self.start, self.inner = tag, dict(attrs), start, inner
        self.end_inner = self.end = inner
    def has(self, name): return name in self.attrs.get('class','').split()

class Document(HTMLParser):
    VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source, self.nodes, self.stack = source, [], []
        self.offsets=[0]
        for match in re.finditer('\n',source): self.offsets.append(match.end())
        self.feed(source)
    def pos(self):
        line,col=self.getpos();return self.offsets[line-1]+col
    def handle_starttag(self, tag, attrs):
        start=self.pos();node=Node(tag,attrs,start,start+len(self.get_starttag_text()))
        self.nodes.append(node)
        if tag not in self.VOID:self.stack.append(node)
    def handle_startendtag(self, tag, attrs):
        start=self.pos();self.nodes.append(Node(tag,attrs,start,start+len(self.get_starttag_text())))
    def handle_endtag(self, tag):
        if self.stack and self.stack[-1].tag==tag:
            node=self.stack.pop();node.end_inner=self.pos();node.end=self.source.index('>',node.end_inner)+1

def transform(source, predicate, value, inner=True):
    nodes=[n for n in Document(source).nodes if predicate(n)]
    for node in reversed(nodes):
        replacement=value(node) if callable(value) else value
        start,end=(node.inner,node.end_inner) if inner else (node.start,node.end)
        source=source[:start]+replacement+source[end:]
    return source

def template(name, path):
    saved=TEMPLATES/(name+'.html')
    if not saved.exists():saved.write_bytes((ROOT/path).read_bytes())
    return saved.read_text(encoding='utf-8')

def img(slug, number, alt, cls='', eager=False):
    return f'<img src="/assets/portfolio/{slug}-{number}.png" alt="{escape(alt)}" class="{cls}" loading="{"eager" if eager else "lazy"}" decoding="async">'

def cover(p, eager=False):
    slug=p['slug']
    if slug=='kombucha':
        return f'<div class="portfolio-cover portfolio-cover-kombucha">{img(slug,1,"", "portfolio-cover-background",eager)}{img(slug,2,"티젠 콤부차 5종 패키지", "portfolio-cover-product",eager)}</div>'
    return img(slug,4 if slug=='tous' else 1,p['ko']+' 프로젝트 대표 이미지','portfolio-cover',eager)

def cards(projects=None):
    if projects is None: projects=WORK_PROJECTS
    return '<b-masonry><b-pagination><div data-el="masonry" class="row md:row2 masonry-row">'+''.join(
        f'<a href="/works/{p["slug"]}/" target="_blank" rel="noopener noreferrer" data-barba-prevent="all" aria-label="{escape(p["ko"])} 전체 작업 보기 (새 탭)" class="w-1/2 grid-item block space-y-2 pagination-item" data-project="{p["slug"]}"><div class="relative work-ratio-{p["ratio"]}"><div class="image-wrap inset-image">{cover(p,True)}</div></div><div class="md:pt-2 font-medium md:text-lg pb-[20%] leading-100 work-list-item">{escape(p["title"])}<span class="portfolio-card-meta">{escape(p["category"])}</span></div></a>' for p in projects
    )+'</div></b-pagination></b-masonry>'

def info():
    return '<div class="portfolio-info row"><div class="w-1/2"><p>Selected Work</p><p>Web · Detail · Promotion</p></div><div class="w-1/2"><a href="/works/">3 Works ↗</a><br><a href="/atlason/">2 WebSites ↗</a><br><a href="'+FIGMA+'" target="_blank" rel="noopener noreferrer">Figma ↗</a></div></div>'

def event_sections(projects=None):
    return cards(projects)+'<section class="portfolio-photoshop-section" aria-labelledby="photoshop-title"><h2 id="photoshop-title">Event Page - Photoshop</h2></section>'

def website_cards():
    return '<div class="portfolio-website-list">'+''.join(
        f'<a href="{p.get("website", "/works/" + p["slug"] + "/")}" class="portfolio-website-card" data-website="{p["slug"]}" target="_blank" rel="noopener noreferrer" data-barba-prevent="all" aria-label="{escape(p["ko"])} 웹사이트 전체 작업 보기 (새 탭)"><div class="portfolio-website-thumbnail"><img src="/assets/portfolio/full/{p["slug"]}.png" alt="{escape(p["ko"])} 웹사이트 디자인" loading="eager" decoding="async"></div><div class="portfolio-website-caption">{escape(p["title"])}<span aria-hidden="true">↗</span></div></a>' for p in WEBSITE_PROJECTS
    )+'</div>'

def footer():
    return '<div class="h-full flex flex-col justify-between"><div class="whitespace-pre-line font-medium font-disp leading-90 text-[7vw] md:text-[7.33vw] max-lg:pb-10 max-lg:pt-16">Selected ideas.\nConsidered details.\nDigital experiences.</div>'+info()+'<p class="portfolio-footnote">Personal design portfolio · 브랜드별 개인 디자인 작업</p></div>'

def clean(source, title):
    source=source.replace('\u2028','\n').replace('\u2029','\n')
    source=re.sub(r'onload="[^"]*vite-script-loaded[^"]*"', 'onload="document.dispatchEvent(new CustomEvent(\'vite-script-loaded\', { detail: { path: \'src/js/app.ts\' } }));"',source)
    source=re.sub(r'\.[^{}]*\{\s*program:\s*[^{}]+\}', '',source)
    source=re.sub(r'vertical-align:\s*middle;\s*(?=display:\s*block)', '',source)
    source=re.sub(r'<title>.*?</title>','<title>'+escape(title)+' · Design Portfolio</title>',source,flags=re.S)
    source=re.sub(r'<meta\b[^>]*(?:name="description"|property="og:description"|name="twitter:description")[^>]*>', '<meta name="description" content="콤부차, laka, 카밀, 뚜레쥬르, 케이벨로. 웹과 제품의 이야기를 담은 5개의 디자인 작업.">',source)
    source=re.sub(r'<meta\b[^>]*(?:property="og:image"|name="twitter:image")[^>]*>','',source)
    source=re.sub(r'(?:maximum-scale=1\.0,?\s*|user-scalable=no,?\s*)','',source)
    source=source.replace('shrink-to-fit=no, ','shrink-to-fit=no')
    source=source.replace('lang="en-US"','lang="ko"')
    source=transform(source,lambda n:n.has('main-header') and source[n.inner:n.end_inner].strip()=='More','AI video')
    source=transform(source,lambda n:n.has('main-header') and source[n.inner:n.end_inner].strip()=='Works','<span class="portfolio-event-title">Event Page - Figma</span>')
    source=re.sub(r'<meta\b[^>]*(?:property="og:title"|name="twitter:title")[^>]*>', '<meta property="og:title" content="'+escape(title)+' · Design Portfolio">',source)
    source=transform(source,lambda n:n.tag=='footer',footer())
    if '/portfolio-content.css' not in source:source=source.replace('</head>','<link rel="stylesheet" href="/portfolio-content.css?v=20261015-6">\n</head>')
    source=source.replace('src="/portfolio-enhancements.js"', 'src="/portfolio-enhancements.js?v=20261022-1"')
    source=re.sub(r'<!-- Local reference study.*?-->','<!-- Personal portfolio content from the supplied Figma projects; layout reference: ATLASON. -->',source,flags=re.S)
    return source

home=template('home','index.html')
works=template('works','works/index.html')
about=template('profile','atlason/index.html')
more=template('more','more/index.html')
detail=template('detail','works/akur-table-collection/index.html')
archive=template('archive','works/archive/index.html')

# Keep the original home panels, their classes, nesting and GSAP selectors intact.
for key,source in [('home',home),('profile',about)]:
    webpage='<div class="p-section atlason-logo"><span class="portfolio-wordmark">WebSite</span></div>'+website_cards()+'<div class="atlason-contacts" aria-hidden="true"></div>'
    source=transform(source,lambda n:n.has('atlason-top'),webpage)
    source=transform(source,lambda n:n.attrs.get('data-page')=='atlason' and n.tag=='a','<a href="/atlason/" class="absolute z-10 inset-0 block the-menu-link" data-page="atlason" aria-label="WebSite — 뚜레쥬르와 케이벨로 보기"></a>',inner=False)
    if key=='home':home=source
    else:about=source

# Home background variants: retain the number of slots so existing random cookies remain valid.
home=transform(home,lambda n:n.attrs.get('data-el')=='cover-images','<img src="/assets/portfolio/background.png" alt="" class="portfolio-background" width="1888" height="1338" loading="eager" decoding="async">')
home=transform(home,lambda n:n.has('menu-logo'),'Portfolio')
home=transform(home,lambda n:n.has('work-list'),event_sections())
works=transform(works,lambda n:n.has('work-list'),event_sections())

# The existing /atlason route lists both website projects.
doc=Document(about);top=next(n for n in doc.nodes if n.has('atlason-top'));container=next(n for n in doc.nodes if n.attrs.get('data-barba')=='container')
ancestors=[n for n in doc.nodes if container.inner<=n.start<top.start and n.end>top.end]
closing=''.join('</'+n.tag+'>' for n in reversed(ancestors))
about=about[:top.end]+closing+about[container.end_inner:]

# Replace the editorial preview and its full page content without changing gallery layout.
for key,source in [('home',home),('more',more)]:
    source=transform(source,lambda n:n.has('page-top-gallery'),'<div class="portfolio-about-visual">'+img('kamill',3,'카밀의 자연을 담은 제품 비주얼','',True)+'</div>')
    source=source.replace('Everything we imagine can be&nbsp;made.','From brand stories<br>to screen details.').replace('Everything we imagine can be made.','From brand stories<br>to screen details.')
    for old,new in [('On Furniture Design','브랜드의 시각 언어'),('On Product Design','콘텐츠의 흐름'),('On Packaging Design','화면의 디테일')]:source=source.replace(old,new)
    if key=='home':home=source
    else:more=source

more=transform(more,lambda n:n.has('page-subtitle'),'From brand stories\nto screen details.')
notes=[
    '<div class="portfolio-intro"><h2>From brand stories<br>to screen details.</h2><p>서로 다른 브랜드의 개성과 콘텐츠를 관찰하고, 이미지와 정보의 흐름으로 풀어낸 다섯 가지 작업입니다.</p></div>',
    '<div class="portfolio-about-wide">'+img('laka',4,'laka 제품 텍스처와 컬러 비주얼')+'</div>',
    '<div class="portfolio-note-grid"><div><h2>Brand</h2><p>브랜드의 색과 이미지, 타이포그래피를 살펴봅니다.</p></div><div><h2>Content</h2><p>읽는 순서와 정보의 위계를 정리합니다.</p></div><div><h2>Detail</h2><p>크롭, 간격, 반복되는 컴포넌트의 규칙을 조율합니다.</p></div></div>',
    '<div class="portfolio-intro"><h2>다섯 브랜드,<br>다섯 가지 시선.</h2><a href="/works/">전체 작업 보기 ↗</a></div>'
]
note_index=iter(reversed(notes))
more=transform(more,lambda n:n.has('blocks'),lambda n: next(note_index))

def write(route, source, title):
    target=ROOT/route/'index.html' if route else ROOT/'index.html'
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(clean(source,title),encoding='utf-8')

def clear_banner_content(source, preview=False):
    doc = Document(source)
    area = next(n for n in doc.nodes if
                (preview and n.has('menu-page-wrap') and n.attrs.get('data-page') == 'page')
                or (not preview and n.has('page-scroll')))
    header = next(n for n in doc.nodes if n.tag == 'b-header' and area.inner <= n.start < area.end_inner)
    header_area = next(n for n in doc.nodes if n.tag == 'b-cursor-area' and
                       area.inner <= n.start < header.start and n.end >= header.end)
    cards = []
    for slug, title in [('coffee-ad', '커피 광고'), ('pawly', 'PAWLY'), ('saekomdalkom', '새콤달콤')]:
        src = '/assets/portfolio/video/' + slug + '.mp4'
        video = '<video playsinline preload="metadata" ' + ('muted tabindex="-1" aria-hidden="true"' if preview else 'controls aria-label="' + title + ' 영상"') + '><source src="' + src + '" type="video/mp4">영상을 재생하려면 <a href="' + src + '">' + title + ' 다운로드</a></video>'
        if preview:
            poster = 'sipon' if slug == 'coffee-ad' else slug
            video = '<img src="/assets/portfolio/video/' + poster + '.png" alt="' + title + '" decoding="async">'
        cards.append(('<a href="/more/#' + slug + '" aria-label="' + title + ' 영상 보기">' + video + '<p>' + title + ' <span>AI video ↗</span></p></a>') if preview else ('<figure id="' + slug + '">' + video + '<figcaption>' + title + ' <span>AI video</span></figcaption></figure>'))
    content = ''.join(cards)
    return source[:header_area.end] + '\n<section class="portfolio-ai-videos" aria-label="AI video 작업">' + content + '</section>\n' + source[area.end_inner:]

home = clear_banner_content(home, preview=True)
more = clear_banner_content(more)

write('',home,'Portfolio')
write('works',works,'Event Page - Figma')
write('atlason',about,'WebSite — 뚜레쥬르 · 케이벨로')
write('more',more,'AI video')

# Category pages use the same existing works shell and its tabs.
for category,route in [(None,'works/archive'),('Web Design','works/furniture/archive'),('Promotion','works/packaging/archive'),('Detail Page','works/products/archive')]:
    if category=='Web Design':
        write(route,about,'WebSite')
        continue
    selected=[p for p in WORK_PROJECTS if category is None or p['category']==category]
    category_source=transform(works,lambda n:n.has('work-list'),event_sections(selected))
    category_source=transform(category_source,lambda n:n.has('work-cats'),'<nav class="portfolio-filters" aria-label="작업 분야"><a href="/works/">Featured</a><a href="/works/archive/">All</a><a href="/works/products/archive/">Detail Page</a><a href="/works/packaging/archive/">Promotion</a><a href="/atlason/">WebSite ↗</a></nav>')
    write(route,category_source,category or 'All Projects')

dimensions={'kombucha':(1070,3318),'laka':(1200,14048),'kamill':(1200,29446),'tous':(1920,10268),'kvelo':(1920,6035)}
for p in PROJECTS:
    width,height=dimensions[p['slug']]
    p['fullImage']='/assets/portfolio/full/'+p['slug']+'.png'
    p['imageWidth'],p['imageHeight']=width,height
    viewer=f'''<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(p['title'])} — 전체 작업 · Design Portfolio</title>
  <meta name="description" content="{escape(p['summary'])} 전체 디자인 이미지.">
  <link rel="stylesheet" href="/portfolio-tokens.css">
  <link rel="stylesheet" href="/portfolio-viewer.css">
  <script defer src="/portfolio-viewer.js"></script>
</head>
<body class="project-viewer"{ ' style="--viewer-close-x: -230px"' if p['slug'] in ('laka', 'kamill') else ''}>
  <button type="button" class="viewer-close" aria-label="{escape(p['ko'])} 작업 닫기" title="닫기 (Esc)"><span aria-hidden="true"></span></button>
  <main class="viewer-main" style="--viewer-image-width: {width}px">
    <h1 class="viewer-sr-only">{escape(p['ko'])} 전체 작업</h1>
    <img class="viewer-image" src="{p['fullImage']}" alt="{escape(p['ko'])} 디자인 전체 화면. {escape(p['summary'])}" width="{width}" height="{height}" loading="eager" decoding="async">
  </main>
</body>
</html>
'''
    target=ROOT/'works'/p['slug']/'index.html'
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(viewer,encoding='utf-8')

# The three existing editorial links retain their routes and transition namespace.
for slug,title,body in [
    ('furniture-design','브랜드의 시각 언어','브랜드마다 다른 색과 이미지, 타이포그래피의 조합을 살펴봅니다. laka의 컬러와 윤기, 카밀의 차분한 자연, 뚜레쥬르의 따뜻한 일상을 각각의 화면에 담았습니다.'),
    ('product-design','콘텐츠의 흐름','콤부차의 혜택과 참여 과정, 케이벨로의 여행과 행사 정보처럼 콘텐츠의 목적을 먼저 구분합니다. 제목, 이미지, 보조 정보의 위계를 정리해 다음 내용을 자연스럽게 탐색하도록 구성했습니다.'),
    ('packaging-design','화면의 디테일','제품 이미지의 크롭과 여백, 설명의 길이, 반복되는 카드의 규칙을 조율했습니다. 다섯 작업에서 서로 다른 브랜드의 분위기를 유지하면서도 읽기 쉬운 구성을 고민했습니다.')]:
    editorial=transform(detail,lambda n:n.attrs.get('data-barba')=='container','<div class="page-scroll"><a href="/more/" class="portfolio-close">Close ↗</a><article class="portfolio-intro"><p>Design Notes</p><h1>'+title+'</h1><p>'+body+'</p><a href="/works/">관련 작업 보기 ↗</a></article><footer class="px-section h-[100svh] pt-12">'+footer()+'</footer></div>')
    write('more/'+slug,editorial,title)

(ROOT/'portfolio-projects.json').write_text(json.dumps(PROJECTS,ensure_ascii=False,indent=2),encoding='utf-8')
print('Applied 5 Figma projects. Home structure, GSAP/Barba namespaces and original tokens retained.')
