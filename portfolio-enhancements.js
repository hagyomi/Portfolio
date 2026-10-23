/* Local study additions: keyboard entry point and reduced-motion navigation. */
(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    // The return transition copies the detail page into the miniature home panel.
    // Restore image cards there so video playback state never becomes a thumbnail.
    function restoreVideoThumbnails() {
        document.querySelectorAll('.container-menu .portfolio-ai-videos video').forEach((video) => {
            const src = video.querySelector('source')?.getAttribute('src');
            const project = {
                '/assets/portfolio/video/coffee-ad.mp4': ['coffee-ad', 'sipon', '커피 광고'],
                '/assets/portfolio/video/pawly.mp4': ['pawly', 'pawly', 'PAWLY'],
                '/assets/portfolio/video/saekomdalkom.mp4': ['saekomdalkom', 'saekomdalkom-thumbnail', '새콤달콤'],
            }[src];
            if (!project) return;
            const [slug, poster, title] = project;
            const image = document.createElement('img');
            image.src = `/assets/portfolio/video/${poster}.png`;
            image.alt = title;
            image.decoding = 'async';
            const figure = video.closest('figure');
            if (figure) {
                const link = document.createElement('a');
                link.href = `/more/#${slug}`;
                link.setAttribute('aria-label', `${title} 영상 보기`);
                const caption = document.createElement('p');
                caption.append(title + ' ');
                const label = document.createElement('span');
                label.textContent = 'AI video ↗';
                caption.append(label);
                link.append(image, caption);
                video.pause();
                figure.replaceWith(link);
            } else {
                video.pause();
                video.replaceWith(image);
            }
        });
    }
    new MutationObserver(restoreVideoThumbnails).observe(document.body, { childList: true, subtree: true });
    restoreVideoThumbnails();
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
            prepareContent(true);
            applyMotionPreference();
        }
        busy = nextBusy;
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    reduced.addEventListener('change', applyMotionPreference);
    prepareContent();
    applyMotionPreference();
})();
