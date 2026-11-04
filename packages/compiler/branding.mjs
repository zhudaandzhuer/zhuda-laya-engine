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

export function brandSplashMarkup(source) {
  return `    <div id="zhudaLogoSplash" role="status" aria-live="polite" aria-label="豬大 LayaAir">
      <div class="zhuda-splash-shell">
        <img src="${source}" alt="豬大 × LayaAir" decoding="async" />
        <p class="zhuda-splash-caption">AI-FRIENDLY GAME ENGINE</p>
        <div class="zhuda-splash-progress" aria-hidden="true"></div>
      </div>
    </div>
    <script>
      (() => {
        const splash = document.getElementById('zhudaLogoSplash');
        if (!splash) return;
        document.documentElement.classList.add('zhuda-splash-active');
        const state = { started: true, durationMs: 2180, completed: false };
        window.__ZHUDA_SPLASH__ = state;
        const release = () => {
          if (state.completed) return;
          state.completed = true;
          splash.classList.add('is-complete');
          document.documentElement.classList.remove('zhuda-splash-active');
          window.setTimeout(() => splash.remove(), 460);
        };
        window.setTimeout(release, 2180);
      })();
    </script>
`;
}

/** Official brand is embedded so consumer asset allowlists cannot remove it. */
export function injectBrandSplash(html, svg) {
  if (/\bid\s*=\s*["']zhudaLogoSplash["']/i.test(html))
    throw Error('Reserved #zhudaLogoSplash in consumer HTML; remove the custom splash and let the public compiler provide the official brand.');
  const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const styles = `<style data-zhuda-brand>\n${brandSplashCss}</style>`;
  const result = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, styles + '</head>') : styles + html;
  return /<body\b[^>]*>/i.test(result)
    ? result.replace(/<body\b[^>]*>/i, tag => tag + brandSplashMarkup(source))
    : brandSplashMarkup(source) + result;
}
