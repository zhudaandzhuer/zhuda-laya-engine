/** Shared boot-page branding. Runs before the SDK; never advances gameplay time. */
export const brandSplashCss = `      html.zhuda-splash-active, html.zhuda-splash-active body {
        overflow: hidden;
      }
      #zhudaLogoSplash {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: grid;
        place-items: center;
        padding: max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left));
        box-sizing: border-box;
        background: radial-gradient(circle at 50% 42%, #17263c 0%, #0b1220 52%, #060a12 100%);
        opacity: 1;
        pointer-events: auto;
        animation: zhuda-splash-exit 420ms ease 1760ms forwards;
      }
      #zhudaLogoSplash .zhuda-splash-shell {
        display: grid;
        justify-items: center;
        width: min(88vw, 760px);
        max-height: min(62svh, 420px);
        gap: clamp(14px, 2.6svh, 28px);
        text-align: center;
      }
      #zhudaLogoSplash img {
        display: block;
        width: min(88vw, 760px);
        max-width: 100%;
        max-height: min(42svh, 300px);
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 0 24px rgba(56, 189, 248, .24));
        transform-origin: center;
        animation: zhuda-splash-logo-in 1100ms cubic-bezier(.18, .86, .24, 1) both;
      }
      #zhudaLogoSplash .zhuda-splash-caption {
        margin: 0;
        color: #9bb4c9;
        font: 600 clamp(10px, 1.8vw, 15px)/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        letter-spacing: clamp(2px, .8vw, 7px);
        animation: zhuda-splash-caption-in 680ms ease 520ms both;
      }
      #zhudaLogoSplash .zhuda-splash-progress {
        width: min(46vw, 260px);
        height: 2px;
        overflow: hidden;
        border-radius: 99px;
        background: rgba(142, 168, 191, .22);
        animation: zhuda-splash-caption-in 680ms ease 650ms both;
      }
      #zhudaLogoSplash .zhuda-splash-progress::after {
        content: "";
        display: block;
        width: 100%;
        height: 100%;
        transform-origin: left;
        background: linear-gradient(90deg, #8b5cf6, #38bdf8, #4ade80);
        animation: zhuda-splash-progress 1500ms cubic-bezier(.32, .1, .2, 1) 220ms both;
      }
      #zhudaLogoSplash.is-complete { pointer-events: none; }
      /* The engine's own splash: a tribute to LayaAir, in the plain grey, black and white of its boot screen. */
      #zhudaLogoSplash.zhuda-splash-tribute { background: #8a8a8a; }
      #zhudaLogoSplash.zhuda-splash-tribute .zhuda-splash-shell { gap: clamp(22px, 5svh, 56px); }
      #zhudaLogoSplash.zhuda-splash-tribute img {
        width: min(60vw, 300px);
        max-height: min(40svh, 300px);
        filter: none;
        animation-name: zhuda-splash-caption-in;
      }
      #zhudaLogoSplash.zhuda-splash-tribute .zhuda-splash-caption {
        color: #fff;
        font: 400 clamp(15px, 4.4vw, 22px)/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        letter-spacing: 0;
        text-shadow: 0 2px 3px rgba(0, 0, 0, .45);
      }
      #zhudaLogoSplash.zhuda-splash-tribute .zhuda-splash-progress {
        width: min(60vw, 300px);
        height: 6px;
        background: rgba(255, 255, 255, .28);
      }
      #zhudaLogoSplash.zhuda-splash-tribute .zhuda-splash-progress::after { background: #fff; }
      @keyframes zhuda-splash-logo-in {
        0% { opacity: 0; transform: translateY(14px) scale(.88); filter: blur(10px) drop-shadow(0 0 0 transparent); }
        55% { opacity: 1; transform: translateY(0) scale(1.035); filter: blur(0) drop-shadow(0 0 34px rgba(56, 189, 248, .42)); }
        100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0) drop-shadow(0 0 24px rgba(56, 189, 248, .24)); }
      }
      @keyframes zhuda-splash-caption-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes zhuda-splash-progress {
        from { transform: scaleX(0); }
        to { transform: scaleX(1); }
      }
      @keyframes zhuda-splash-exit {
        from { opacity: 1; visibility: visible; }
        to { opacity: 0; visibility: hidden; }
      }
      @media (orientation: landscape) and (max-height: 560px) {
        #zhudaLogoSplash .zhuda-splash-shell { max-height: 82svh; gap: 10px; }
        #zhudaLogoSplash img { max-height: 34svh; }
      }
      @media (prefers-reduced-motion: reduce) {
        #zhudaLogoSplash, #zhudaLogoSplash img, #zhudaLogoSplash .zhuda-splash-caption,
        #zhudaLogoSplash .zhuda-splash-progress, #zhudaLogoSplash .zhuda-splash-progress::after {
          animation-duration: 1ms;
          animation-delay: 0ms;
        }
      }
`;

/**
 * The splash every build shows unless its branding says otherwise: the LayaAir
 * mark and a line of thanks to the engine this one is built on. One place names
 * the picture and the words, so the default can be replaced by editing this
 * record and the file it points at; a project replaces it for itself with
 * \`branding.mode: 'custom'\`, or switches it off with \`'none'\`.
 */
export const ZHUDA_ENGINE_SPLASH = Object.freeze({
  mark: 'assets/branding/layaair-tribute-mark.svg',
  title: 'Powered by LayaAir Engine',
  caption: 'Powered by LayaAir Engine',
});

/** Strict shared policy: visual branding is independent of attribution notices. */
export function normalizeBranding(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('branding must be an object');
  const mode = value.mode ?? 'engine';
  if (!['engine', 'custom', 'none'].includes(mode))
    throw Error('branding.mode must be engine, custom or none');
  const allowed = mode === 'custom' ? ['mode', 'brandId', 'logo', 'title', 'caption'] : ['mode'];
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) throw Error(`Unsupported branding.${key} for ${mode}`);
  if (mode !== 'custom') return Object.freeze({ mode });
  if (typeof value.brandId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value.brandId))
    throw Error('branding.brandId must be a stable identifier');
  if (typeof value.logo !== 'string' || !value.logo.trim() || value.logo.length > 3_000_000)
    throw Error('branding.logo is required (max 3 MB encoded)');
  for (const key of ['title', 'caption'])
    if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > 160))
      throw Error(`branding.${key} must be text up to 160 characters`);
  return Object.freeze({
    mode,
    brandId: value.brandId,
    logo: value.logo,
    title: value.title ?? value.brandId,
    caption: value.caption ?? '',
  });
}
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
export function validateBrandLogo(source) {
  if (
    typeof source !== 'string' ||
    // eslint-disable-next-line no-control-regex -- reject control characters in logo URLs
    /[\u0000-\u0020\u007f\\]/.test(source) ||
    (!/^https:\/\//i.test(source) &&
      !/^data:image\/(png|jpeg|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(source) &&
      (/^[a-z][a-z0-9+.-]*:/i.test(source) ||
        source.startsWith('//') ||
        source.split('/').includes('..')))
  )
    throw Error('branding.logo must be a relative image, HTTPS URL or base64 image data URL');
  return source;
}
/** Boot UI only: this timeout never advances the simulation clock. */
export function runBrandSplash(mode) {
  const splash = document.getElementById('zhudaLogoSplash');
  const state = {
    started: true,
    durationMs: mode === 'none' ? 0 : 2180,
    completed: mode === 'none',
    mode,
  };
  window.__ZHUDA_SPLASH__ = state;
  if (mode === 'none' || !splash) return;
  document.documentElement.classList.add('zhuda-splash-active');
  const release = () => {
    if (state.completed) return;
    state.completed = true;
    splash.classList.add('is-complete');
    document.documentElement.classList.remove('zhuda-splash-active');
    window.setTimeout(() => splash.remove(), 460);
  };
  window.setTimeout(release, state.durationMs);
}
export function brandSplashMarkup(source, options) {
  const config = normalizeBranding(options);
  const logo = config.mode === 'custom' ? config.logo : source;
  const title = config.mode === 'custom' ? config.title : ZHUDA_ENGINE_SPLASH.title;
  const caption = config.mode === 'custom' ? config.caption : ZHUDA_ENGINE_SPLASH.caption;
  const tribute = config.mode === 'custom' ? '' : ' class="zhuda-splash-tribute"';
  const markup =
    config.mode === 'none'
      ? ''
      : `<div id="zhudaLogoSplash"${tribute} role="status" aria-live="polite" aria-label="${escapeHtml(title)}">
    <div class="zhuda-splash-shell">
      <img src="${escapeHtml(validateBrandLogo(logo))}" alt="${escapeHtml(title)}" decoding="async" />
      <p class="zhuda-splash-caption">${escapeHtml(caption)}</p>
      <div class="zhuda-splash-progress" aria-hidden="true"></div>
    </div>
  </div>`;
  return (
    markup + `<script>(${runBrandSplash.toString()})(${JSON.stringify(config.mode)});</script>`
  );
}
export function mountBrandSplash(source, options) {
  const config = normalizeBranding(options);
  // Validate before modifying the document, including before DOMContentLoaded.
  if (config.mode === 'custom') validateBrandLogo(config.logo);
  const mount = () => {
    if (document.getElementById('zhudaLogoSplash'))
      throw Error('Reserved #zhudaLogoSplash; browser SDK supplies branding');
    if (config.mode !== 'none') {
      const style = document.createElement('style');
      style.dataset.zhudaBrand = '';
      style.textContent = brandSplashCss;
      document.head.append(style);
      const holder = document.createElement('div');
      holder.innerHTML = brandSplashMarkup(source, config).replace(
        /<script>[\s\S]*<\/script>$/,
        '',
      );
      document.body.prepend(holder.firstElementChild);
    }
    runBrandSplash(config.mode);
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}

/** Official brand is embedded so consumer asset allowlists cannot remove it. */
export function injectBrandSplash(html, svg, options) {
  const config = normalizeBranding(options);
  if (/\bid\s*=\s*["']zhudaLogoSplash["']/i.test(html))
    throw Error(
      'Reserved #zhudaLogoSplash in consumer HTML; remove the custom splash and use branding config on the public compiler.',
    );
  // Fragment templates are valid consumer inputs. Keep a real document header
  // before the large embedded SVG, or charset detection can fall back to a
  // legacy encoding and make Unicode runtime scripts fail to parse.
  if (!/<body\b[^>]*>/i.test(html)) {
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
    const content = html
      .replace(/<!doctype\b[^>]*>/gi, '')
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<\/?html\b[^>]*>/gi, '');
    html = `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${content}</body></html>`;
  }
  if (!/<head\b[^>]*>/i.test(html))
    html = html.replace(/<body\b[^>]*>/i, (tag) => '<head><meta charset="utf-8"></head>' + tag);
  const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const styles =
    config.mode === 'none' ? '' : `<style data-zhuda-brand>\n${brandSplashCss}</style>`;
  const result = /<\/head>/i.test(html)
    ? html.replace(/<\/head>/i, styles + '</head>')
    : styles + html;
  return /<body\b[^>]*>/i.test(result)
    ? result.replace(/<body\b[^>]*>/i, (tag) => tag + brandSplashMarkup(source, config))
    : brandSplashMarkup(source, config) + result;
}
