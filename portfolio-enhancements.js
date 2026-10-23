/* Local study additions: keyboard entry point and reduced-motion navigation. */
(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    function updateVideoTitle() {
        document.body.classList.toggle('ai-video-scrolled', window.scrollY > 20);
    }
    window.addEventListener('scroll', updateVideoTitle, { passive: true });
    updateVideoTitle();
    // The return transition copies the detail page into the miniature home panel.
    // Restore the entire collection: an individual detail contains only one film.
    function restoreVideoThumbnails() {
        const projects = [
            ['coffee-ad', 'sipon', 'SIPON — 커피 광고'],
            ['pawly', 'pawly', 'PAWLY'],
            ['saekomdalkom', 'saekomdalkom-thumbnail', '새콤달콤'],
        ];
        document.querySelectorAll('.container-menu .portfolio-ai-videos').forEach((section) => {
            const complete = section.children.length === projects.length && projects.every(([slug, poster], index) => {
                const link = section.children[index];
                return link.tagName === 'A' && link.getAttribute('href') === `/more/${slug}/` &&
                    link.children.length === 1 && link.firstElementChild?.getAttribute('src') === `/assets/portfolio/video/${poster}.png`;
            });
            if (complete) return;
            section.querySelectorAll('video').forEach(video => video.pause());
            const links = projects.map(([slug, poster, title]) => {
                const link = document.createElement('a');
                link.href = `/more/${slug}/`;
                link.setAttribute('aria-label', `${title} 영상 보기`);
                const image = document.createElement('img');
                image.src = `/assets/portfolio/video/${poster}.png`;
                image.alt = title;
                image.decoding = 'async';
                link.append(image);
                return link;
            });
            section.replaceChildren(...links);
        });
    }
    new MutationObserver(restoreVideoThumbnails).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    restoreVideoThumbnails();
    // Animate from the clicked image's actual screen position.
    let openingFilm = false;
    document.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reduced.matches) return;
        const link = event.target.closest('.container-menu .portfolio-ai-videos > a');
        if (!link) return;
        const image = link.querySelector('img');
        if (!image) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (openingFilm) return;
        openingFilm = true;
        const rect = image.getBoundingClientRect();
        const overlay = image.cloneNode();
        overlay.className = 'portfolio-film-zoom';
        overlay.setAttribute('aria-hidden', 'true');
        Object.assign(overlay.style, {
            left: `${rect.left}px`, top: `${rect.top}px`,
            width: `${rect.width}px`, height: `${rect.height}px`,
        });
        document.body.append(overlay);
        const animation = overlay.animate([
            { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` },
            { left: '0px', top: '0px', width: `${window.innerWidth}px`, height: `${window.innerHeight}px` },
        ], { duration: 600, easing: 'cubic-bezier(.54,.15,.15,1)', fill: 'forwards' });
        animation.finished.then(() => window.location.assign(link.href));
    }, true);
    window.addEventListener('pageshow', () => {
        openingFilm = false;
        document.querySelectorAll('.portfolio-film-zoom').forEach(element => element.remove());
    });
    // The reference home uses a panel-wide overlay link over miniature pages.
    // Route a click over a project card to that card's new tab before Barba handles it.
    document.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const panel = event.target.closest('.container-menu .menu-works-list, .container-menu .menu-atlason');
        if (!panel) return;
        const card = [...panel.querySelectorAll('a[data-project], a[data-website]')].find((link) => {
            const rect = link.getBoundingClientRect();
            return event.clientX >= rect.left && event.clientX <= rect.right &&
                event.clientY >= rect.top && event.clientY <= rect.bottom;
        });
        if (!card) return;
        // Native project links already have target=_blank; preserve their default behavior.
        if (event.target.closest('a[data-project], a[data-website]') === card) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.open(card.href, '_blank', 'noopener,noreferrer');
    }, true);
    const skip = document.createElement('a');
    skip.className = 'portfolio-skip-link';
    skip.href = '#portfolio-content';
    skip.textContent = 'Skip to content';
    document.body.prepend(skip);

    function prepareContent(focus = false) {
        const containers = document.querySelectorAll('[data-barba="container"]');
        const content = containers[containers.length - 1];
        if (!content) return;
        document.querySelectorAll('#portfolio-content').forEach((el) => el.removeAttribute('id'));
        content.id = 'portfolio-content';
        content.tabIndex = -1;
        if (focus) content.focus({ preventScroll: true });
    }
    skip.addEventListener('click', (event) => {
        event.preventDefault();
        prepareContent(true);
    });

    function applyMotionPreference() {
        document.querySelectorAll('video').forEach((video) => {
            if (reduced.matches) {
                video.pause();
                video.removeAttribute('autoplay');
                video.controls = true;
            }
        });
    }
    // Full navigation bypasses GSAP's spatial transitions for reduced motion.
    document.addEventListener(
        'click',
        (event) => {
            if (
                !reduced.matches ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            )
                return;
            const link = event.target.closest('a[href]');
            if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
            const url = new URL(link.href, location.href);
            if (url.origin !== location.origin || url.hash || !/^https?:$/.test(url.protocol))
                return;
            event.preventDefault();
            event.stopImmediatePropagation();
            location.assign(url.href);
        },
        true
    );

    let busy = document.body.classList.contains('is-busy');
    new MutationObserver(() => {
        const nextBusy = document.body.classList.contains('is-busy');
        if (busy && !nextBusy) {
            restoreVideoThumbnails();
            updateVideoTitle();
            prepareContent(true);
            applyMotionPreference();
        }
        busy = nextBusy;
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    reduced.addEventListener('change', applyMotionPreference);
    prepareContent();
    applyMotionPreference();
})();
