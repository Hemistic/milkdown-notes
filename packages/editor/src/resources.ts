/** Resolve host resources first, then reject executable URL schemes. */
export function safeAssetURL(value: string): string {
  const url = value.trim();
  if (/^(https?:|blob:)/i.test(url) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(url)) return url;
  if (!/^[a-z][\w+.-]*:/i.test(url) && !url.startsWith('//') && !/[\u0000-\u001f]/.test(url)) return url;
  return '';
}
