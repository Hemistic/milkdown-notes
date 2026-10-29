/** Keep floating controls inside the visible editor, including embedded sidebars. */
export function bindResponsiveEditor(host: HTMLElement) {
  let frame = 0;
  const update = () => {
    frame = 0;
    const rect = host.getBoundingClientRect();
    const left = Math.max(0, rect.left),
      right = Math.min(document.documentElement.clientWidth, rect.right);
    host.style.setProperty('--mn-host-width', `${Math.max(0, right - left)}px`);
    host.style.setProperty('--mn-panel-left', `${(left + right) / 2}px`);
    const inset =
      Number.parseFloat(getComputedStyle(host).getPropertyValue('--mn-viewport-bottom')) || 0;
    host.style.setProperty(
      '--mn-panel-bottom',
      `${Math.max(12, inset + 8, innerHeight - Math.min(innerHeight, rect.bottom) + 8)}px`,
    );
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(host);
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);
  update();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('scroll', schedule, true);
    for (const key of ['--mn-host-width', '--mn-panel-left', '--mn-panel-bottom'])
      host.style.removeProperty(key);
  };
}
