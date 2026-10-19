(() => {
  const button = document.querySelector('.viewer-close');
  let closing = false;

  function closeViewer() {
    if (closing) return;
    closing = true;
    // Tabs opened by project links can close normally. Direct visits return to Works.
    window.close();
    window.setTimeout(() => {
      if (!window.closed) window.location.replace('/works/');
    }, 150);
  }

  button?.addEventListener('click', closeViewer);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeViewer();
    }
  });
})();
