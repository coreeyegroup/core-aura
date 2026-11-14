const viewport = document.querySelector('meta[name="viewport"]');
let preferredDisplay = 'auto';
try { preferredDisplay = localStorage.getItem('core-aura.display') || 'auto'; } catch {}

function phoneLike() {
  return navigator.maxTouchPoints > 0 || /Android|iPhone|iPad/i.test(navigator.userAgent || '');
}
function targetWidth() {
  if (preferredDisplay === 'phone') return 360;
  if (!phoneLike()) return null;
  const candidates = [screen.width, window.outerWidth].filter(width => width >= 240 && width <= 600);
  if (candidates.length) return Math.min(...candidates);
  // Some installed browsers expose desktop dimensions for both screen and window.
  if (window.innerHeight > window.innerWidth && window.innerWidth > 600) return 360;
  return null;
}
function fitDisplay() {
  const target = targetWidth();
  if (!target) {
    document.documentElement.style.zoom = '';
    document.documentElement.classList.remove('phone-display');
    return;
  }
  document.documentElement.classList.add('phone-display');
  viewport.content = 'width=' + target + ',initial-scale=1,viewport-fit=cover';
  // If the host ignores the viewport request, compensate inside the document.
  // Read innerWidth afresh on resize so an honored request resets this to one.
  document.documentElement.style.zoom = String(Math.max(1, window.innerWidth / target));
}
fitDisplay();
addEventListener('pageshow', fitDisplay);
addEventListener('resize', fitDisplay);
addEventListener('orientationchange', () => setTimeout(fitDisplay, 200));
addEventListener('DOMContentLoaded', () => {
  fitDisplay();
  const toggle = document.querySelector('#phone-display');
  if (toggle) {
    toggle.onclick = () => {
      preferredDisplay = preferredDisplay === 'phone' ? 'auto' : 'phone';
      try { localStorage.setItem('core-aura.display', preferredDisplay); } catch {}
      fitDisplay();
      toggle.setAttribute('aria-pressed', String(preferredDisplay === 'phone'));
    };
    toggle.setAttribute('aria-pressed', String(preferredDisplay === 'phone'));
  }
  const output = document.querySelector('#display-measurements');
  function measure() {
    const rect = document.querySelector('#play')?.getBoundingClientRect();
    if (!output || !rect) return;
    output.textContent = [
      'Screen ' + screen.width + ' × ' + screen.height,
      'Window ' + window.outerWidth + ' × ' + window.outerHeight,
      'Page width ' + document.documentElement.clientWidth,
      'Touch points ' + navigator.maxTouchPoints,
      'Text ' + getComputedStyle(document.body).fontSize,
      'Display factor ' + getComputedStyle(document.documentElement).zoom,
      'Play button ' + Math.round(rect.width) + ' × ' + Math.round(rect.height),
      'Visual scale ' + (window.visualViewport?.scale ?? 1).toFixed(2)
    ].join('\n');
  }
  document.querySelector('#display-info')?.addEventListener('toggle', measure);
});
