// Repair a desktop-sized layout viewport on touch phones without disabling zoom.
const viewport = document.querySelector('meta[name="viewport"]');
function fitPhone() {
  const phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 600;
  const width = screen.width;
  if (phone && innerWidth > width * 1.35) {
    viewport.content = 'width=' + width + ',initial-scale=1,viewport-fit=cover';
  }
}
fitPhone();
addEventListener('pageshow', fitPhone);
addEventListener('orientationchange', () => setTimeout(fitPhone, 200));
