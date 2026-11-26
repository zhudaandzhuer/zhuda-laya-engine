// A DOM-only window.__SCENE__ for a page that runs 「灰燼之庭」 without a hook of its own (the
// original game, or a game built from the library): defined when #theatre leaves
// data-mode="loading" — Controls.update() right before context.runtime.start(), so the
// MutationObserver runs before the first frame and detplay holds the clock from there, the
// same moment the viewer preset sets its hook. #theatre may be in the HTML (original) or be
// added later by mountCourtPage(). state() reads what the page shows; the viewer preset's
// state() returns the same fields first (pageState()).
(() => {
  const $ = (id) => document.getElementById(id);
  const meter = (id) => Number($(id).getAttribute('aria-valuenow'));
  const state = () => {
    const result = $('result-line');
    return {
      mode: $('theatre').dataset.mode, hp: meter('hp'), stamina: meter('stamina'), foe: meter('foe-hp'),
      overlay: !$('overlay').hidden, title: $('dialog-title').textContent, result: result.hidden ? '' : result.textContent,
      strike: $('strike-button').dataset.held, hint: $('strike-button').querySelector('small').textContent, pad: $('stride-pad').dataset.direction,
    };
  };
  const observer = new MutationObserver(() => {
    const theatre = $('theatre');
    if (!theatre || !theatre.dataset.mode || theatre.dataset.mode === 'loading') return;
    observer.disconnect();
    window.__SCENE__ = { ready: true, state, set() {}, errors: () => [] };
  });
  observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-mode'] });
})();
