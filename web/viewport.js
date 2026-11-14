const viewport = document.querySelector('meta[name="viewport"]');

function phoneWidth() {
  if (!navigator.maxTouchPoints || Math.min(screen.width, screen.height) > 600) return null;
  // outerWidth can retain the real phone width when desktop mode expands screen.width.
  const widths = [screen.width, window.outerWidth].filter(value => value >= 240 && value <= 1400);
  return widths.length ? Math.min(...widths) : null;
}

function fitPhone() {
  const width = phoneWidth();
  if (!width) return;
  // Set this before content layout, even if the initial innerWidth looks correct.
  viewport.content = 'width=' + width + ',initial-scale=1,viewport-fit=cover';
}
fitPhone();
addEventListener('pageshow', fitPhone);
addEventListener('orientationchange', () => setTimeout(fitPhone, 200));

addEventListener('DOMContentLoaded', () => {
  const output = document.querySelector('#display-measurements');
  const info = document.querySelector('#display-info');
  function measure() {
    const play = document.querySelector('#play');
    if (!output || !play) return;
    const rect = play.getBoundingClientRect();
    output.textContent = [
      'Screen ' + screen.width + ' × ' + screen.height,
      'Window ' + window.outerWidth + ' × ' + window.outerHeight,
      'Page width ' + document.documentElement.clientWidth,
      'Text ' + getComputedStyle(document.body).fontSize,
      'Play button ' + Math.round(rect.width) + ' × ' + Math.round(rect.height),
      'Visual scale ' + (window.visualViewport?.scale ?? 1).toFixed(2)
    ].join('\n');
  }
  info?.addEventListener('toggle', measure);
});
