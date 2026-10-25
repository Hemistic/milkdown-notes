export interface OutlineItem {
	id: string;
	level: number;
	text: string;
	line: number;
}

export function extractOutline(markdown: string): OutlineItem[] {
	const lines = markdown.split('\n');
	const items: OutlineItem[] = [];
	let inCodeBlock = false;

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (line.trimStart().startsWith('```')) {
			inCodeBlock = !inCodeBlock;
			continue;
		}
		if (inCodeBlock) continue;

		const match = /^(#{1,6})\s+(.+)$/.exec(line);
		if (!match) continue;

		const level = match[1].length;
		const text = match[2].replace(/#+\s*$/, '').trim();
		items.push({
			id: `heading-${index}-${level}`,
			level,
			text,
			line: index + 1,
		});
	}

	return items;
}

export function countWords(markdown: string): { words: number; chars: number; lines: number } {
	const text = markdown
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]+`/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/[#>*_~`\-|=]/g, ' ')
		.trim();

	const chars = markdown.length;
	const lines = markdown === '' ? 0 : markdown.split('\n').length;
	const cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? [];
	const latin = text
		.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ')
		.split(/\s+/)
		.filter(Boolean);

	return {
		words: cjk.length + latin.length,
		chars,
		lines,
	};
}
