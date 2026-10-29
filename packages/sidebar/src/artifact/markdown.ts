export function countWords(markdown: string): { words: number; chars: number; lines: number } {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_~`\-|=]/g, ' ')
    .trim();

  return {
    words:
      (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g)?.length ?? 0) +
      (text.match(/[^\s\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g)?.length ?? 0),
    chars: markdown.length,
    lines: markdown === '' ? 0 : markdown.split('\n').length,
  };
}
