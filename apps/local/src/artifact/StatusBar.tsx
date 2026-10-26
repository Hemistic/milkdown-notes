import { useEffect, useRef, useState, type FC } from 'react';
import type { NotesEditorMode, NotesTheme } from './types';

export type MarkdownExportFormat = 'markdown' | 'html' | 'pdf';

export interface StatusBarProps {
	words: number;
	chars: number;
	lines: number;
	status?: string;
	locale: 'en' | 'zh';
	spellcheckEnabled: boolean;
	onToggleSpellcheck: () => void;
	editorControls?: boolean;
	outlineOpen?: boolean;
	theme?: NotesTheme;
	editorMode?: NotesEditorMode;
	sourceRevealEnabled?: boolean;
	onToggleOutline?: () => void;
	onToggleTheme?: () => void;
	onSelectEditorMode?: (mode: NotesEditorMode) => void;
	onToggleSourceReveal?: () => void;
	showFileMenu?: boolean;
	showOpenInArtInFact?: boolean;
	onOpenInArtInFact?: () => void;
	onImportSnapshot?: () => void;
	onRenameDocument?: () => void;
	onExportDocument?: (format: MarkdownExportFormat) => void;
	/** @deprecated Kept for older snapshot hosts while the generic action is adopted. */
	onExportSnapshot?: (format: MarkdownExportFormat) => void;
}

export const StatusBar: FC<StatusBarProps> = ({
	words,
	chars,
	lines,
	status,
	locale,
	spellcheckEnabled,
	onToggleSpellcheck,
	editorControls = false,
	outlineOpen = false,
	theme = 'light',
	editorMode = 'normal',
	sourceRevealEnabled = false,
	onToggleOutline,
	onToggleTheme,
	onSelectEditorMode,
	onToggleSourceReveal,
	showFileMenu = false,
	showOpenInArtInFact = false,
	onOpenInArtInFact,
	onImportSnapshot,
	onRenameDocument,
	onExportDocument,
	onExportSnapshot,
}) => {
	const [statsView, setStatsView] = useState<'words' | 'chars' | 'lines'>('words');
	const [snapshotMenuOpen, setSnapshotMenuOpen] = useState(false);
	const snapshotMenuRef = useRef<HTMLDivElement>(null);
	const exportDocument = onExportDocument || onExportSnapshot;
	const stats = locale === 'zh'
		? `${words} 词 · ${chars} 字符 · ${lines} 行`
		: `${words} words · ${chars} chars · ${lines} lines`;
	const compactStats = locale === 'zh'
		? {
			words: `${words} 词`,
			chars: `${chars} 字符`,
			lines: `${lines} 行`,
		}
		: {
			words: `${words} words`,
			chars: `${chars} chars`,
			lines: `${lines} lines`,
		};
	const nextStatsView = statsView === 'words' ? 'chars' : statsView === 'chars' ? 'lines' : 'words';
	const spellcheckLabel = locale === 'zh'
		? `拼写检查：${spellcheckEnabled ? '开' : '关'}`
		: `Spellcheck: ${spellcheckEnabled ? 'on' : 'off'}`;
	const copy = locale === 'zh'
		? {
			openInArtInFact: '在 ArtInFact 中打开',
			renameDocument: '重命名 Markdown...',
			outline: outlineOpen ? '关闭大纲' : '打开大纲',
			light: '切换为白天主题',
			dark: '切换为黑夜主题',
			modes: '编辑模式',
			sourceRevealOn: '关闭三击显示源码',
			sourceRevealOff: '开启三击显示源码',
			fileMenu: 'Markdown 文件菜单',
			openMarkdown: '打开 Markdown...',
			exportMarkdown: '导出通用 Markdown...',
			exportHtml: '导出 HTML...',
			exportPdf: '导出 PDF...',
			normal: '正常模式',
			focus: '专注模式',
			typewriter: '打字机模式',
		}
		: {
			openInArtInFact: 'Open in ArtInFact',
			renameDocument: 'Rename Markdown...',
			outline: outlineOpen ? 'Hide outline' : 'Show outline',
			light: 'Use light theme',
			dark: 'Use dark theme',
			modes: 'Editor mode',
			sourceRevealOn: 'Disable triple-click source reveal',
			sourceRevealOff: 'Enable triple-click source reveal',
			fileMenu: 'Markdown file menu',
			openMarkdown: 'Open Markdown...',
			exportMarkdown: 'Export portable Markdown...',
			exportHtml: 'Export HTML...',
			exportPdf: 'Export PDF...',
			normal: 'Normal mode',
			focus: 'Focus mode',
			typewriter: 'Typewriter mode',
	};
	const themeLabel = theme === 'dark' ? copy.light : copy.dark;
	const sourceRevealLabel = sourceRevealEnabled ? copy.sourceRevealOn : copy.sourceRevealOff;

	useEffect(() => {
		if (!snapshotMenuOpen) return;
		const onPointerDown = (event: PointerEvent) => {
			if (event.target instanceof Node && !snapshotMenuRef.current?.contains(event.target)) {
				setSnapshotMenuOpen(false);
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setSnapshotMenuOpen(false);
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [snapshotMenuOpen]);

	useEffect(() => {
		if (!showFileMenu) setSnapshotMenuOpen(false);
	}, [showFileMenu]);

	return (
		<footer className="statusbar">
			<div className="status-left">
				{showOpenInArtInFact ? (
					<>
						<button
							type="button"
							className="snapshot-open-full-footer"
							aria-label={copy.openInArtInFact}
							title={copy.openInArtInFact}
							onClick={onOpenInArtInFact}
						>
							<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M9 2.5h4.5V7M13.5 2.5 7 9m5.5.5v3a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3" /></svg>
							<span>{copy.openInArtInFact}</span>
						</button>
						<div className="snapshot-file-menu" ref={snapshotMenuRef}>
							<button
								type="button"
								className={`status-icon-button snapshot-file-menu-trigger${snapshotMenuOpen ? ' is-active' : ''}`}
								data-testid="snapshot-file-menu-trigger"
								aria-label={copy.fileMenu}
								aria-haspopup="menu"
								aria-expanded={snapshotMenuOpen}
								title={copy.fileMenu}
								onClick={() => setSnapshotMenuOpen((open) => !open)}
							>
								<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M3 3.5h10M3 8h10M3 12.5h10" /><circle cx="2" cy="3.5" r=".45" /><circle cx="2" cy="8" r=".45" /><circle cx="2" cy="12.5" r=".45" /></svg>
							</button>
							{snapshotMenuOpen ? (
								<div className="snapshot-file-menu-popover" role="menu" aria-label={copy.fileMenu}>
									<button type="button" role="menuitem" onClick={() => { setSnapshotMenuOpen(false); onRenameDocument?.(); }}>
										<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="m10.8 2.3 2.9 2.9M3 13l2.8-.6 7.3-7.3a1.4 1.4 0 0 0-2-2L3.8 10.4zM8.8 4.5l2.7 2.7" /></svg>
										<span>{copy.renameDocument}</span>
									</button>
									<button type="button" role="menuitem" onClick={() => { setSnapshotMenuOpen(false); onImportSnapshot?.(); }}>
										<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M3 2.5h6l3 3v8H3z" /><path d="M9 2.5v3h3M8 7v5M5.8 9.2 8 7l2.2 2.2" /></svg>
										<span>{copy.openMarkdown}</span>
									</button>
									<button type="button" role="menuitem" onClick={() => { setSnapshotMenuOpen(false); exportDocument?.('markdown'); }}>
										<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M3 2.5h6l3 3v8H3z" /><path d="M9 2.5v3h3M8 12V7M5.8 9.8 8 12l2.2-2.2" /></svg>
										<span>{copy.exportMarkdown}</span>
									</button>
									<button type="button" role="menuitem" onClick={() => { setSnapshotMenuOpen(false); exportDocument?.('html'); }}>
										<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M3 2.5h6l3 3v8H3z" /><path d="M9 2.5v3h3M4.6 9h6.8M4.6 11.2h4.5" /></svg>
										<span>{copy.exportHtml}</span>
									</button>
									<button type="button" role="menuitem" onClick={() => { setSnapshotMenuOpen(false); exportDocument?.('pdf'); }}>
										<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M3 2.5h6l3 3v8H3z" /><path d="M9 2.5v3h3M4.8 11.5V8h2.4a1.1 1.1 0 0 1 0 2.2H4.8M9 11.5V8h1.5a1.4 1.4 0 0 1 0 2.8H9" /></svg>
										<span>{copy.exportPdf}</span>
									</button>
								</div>
							) : null}
						</div>
					</>
				) : null}
				{showFileMenu && !showOpenInArtInFact ? (
					<div className="snapshot-file-menu" ref={snapshotMenuRef}>
						<button
							type="button"
							className={`status-icon-button snapshot-file-menu-trigger${snapshotMenuOpen ? ' is-active' : ''}`}
							data-testid="markdown-file-menu-trigger"
							aria-label={copy.fileMenu}
							aria-haspopup="menu"
							aria-expanded={snapshotMenuOpen}
							title={copy.fileMenu}
							onClick={() => setSnapshotMenuOpen((open) => !open)}
						>
							<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M3 3.5h10M3 8h10M3 12.5h10" /><circle cx="2" cy="3.5" r=".45" /><circle cx="2" cy="8" r=".45" /><circle cx="2" cy="12.5" r=".45" /></svg>
						</button>
						{snapshotMenuOpen ? (
							<div className="snapshot-file-menu-popover" role="menu" aria-label={copy.fileMenu}>
								<button type="button" role="menuitem" onClick={() => { setSnapshotMenuOpen(false); onRenameDocument?.(); }}>
									<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="m10.8 2.3 2.9 2.9M3 13l2.8-.6 7.3-7.3a1.4 1.4 0 0 0-2-2L3.8 10.4zM8.8 4.5l2.7 2.7" /></svg>
									<span>{copy.renameDocument}</span>
								</button>
								{onImportSnapshot ? (									<button type="button" role="menuitem" onClick={() => { setSnapshotMenuOpen(false); onImportSnapshot?.(); }}>
										<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M3 2.5h6l3 3v8H3z" /><path d="M9 2.5v3h3M8 7v5M5.8 9.2 8 7l2.2 2.2" /></svg>
										<span>{copy.openMarkdown}</span>
									</button>) : null}
								<button type="button" role="menuitem" onClick={() => { setSnapshotMenuOpen(false); exportDocument?.('markdown'); }}>
									<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M3 2.5h6l3 3v8H3z" /><path d="M9 2.5v3h3M8 12V7M5.8 9.8 8 12l2.2-2.2" /></svg>
									<span>{copy.exportMarkdown}</span>
								</button>
								<button type="button" role="menuitem" onClick={() => { setSnapshotMenuOpen(false); exportDocument?.('html'); }}>
									<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M3 2.5h6l3 3v8H3z" /><path d="M9 2.5v3h3M4.6 9h6.8M4.6 11.2h4.5" /></svg>
									<span>{copy.exportHtml}</span>
								</button>
								<button type="button" role="menuitem" onClick={() => { setSnapshotMenuOpen(false); exportDocument?.('pdf'); }}>
									<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M3 2.5h6l3 3v8H3z" /><path d="M9 2.5v3h3M4.8 11.5V8h2.4a1.1 1.1 0 0 1 0 2.2H4.8M9 11.5V8h1.5a1.4 1.4 0 0 1 0 2.8H9" /></svg>
									<span>{copy.exportPdf}</span>
								</button>
							</div>
						) : null}
					</div>
				) : null}
				<span className="status-msg">{status ?? ''}</span>
			</div>
			<div className="status-actions">
				{editorControls ? (
					<>
						<button
							type="button"
							className={`status-icon-button${outlineOpen ? ' is-active' : ''}`}
							data-testid="outline-toggle"
							aria-pressed={outlineOpen}
							aria-label={copy.outline}
							title={copy.outline}
							onClick={onToggleOutline}
						>
							<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
								<path d="M3 3.5h10M3 8h10M3 12.5h6" />
								<path d="M1.75 3.5h.5M1.75 8h.5M1.75 12.5h.5" />
							</svg>
						</button>
						<button
							type="button"
							className="status-icon-button"
							data-testid="theme-toggle"
							aria-label={themeLabel}
							title={themeLabel}
							onClick={onToggleTheme}
						>
							{theme === 'dark' ? (
								<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.88.88M11.72 11.72l.88.88M12.6 3.4l-.88.88M4.28 11.72l-.88.88" /></svg>
							) : (
								<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M12.85 10.18A5.25 5.25 0 0 1 5.82 3.15a5.25 5.25 0 1 0 7.03 7.03Z" /></svg>
							)}
						</button>
						<div className="editor-mode-switch" role="group" aria-label={copy.modes}>
							<button
								type="button"
								className={editorMode === 'normal' ? 'is-active' : ''}
								aria-pressed={editorMode === 'normal'}
								aria-label={copy.normal}
								title={copy.normal}
								onClick={() => onSelectEditorMode?.('normal')}
							>
								<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><rect x="3" y="2.75" width="10" height="10.5" rx="1" /><path d="M5.25 5.5h5.5M5.25 8h5.5M5.25 10.5h3.5" /></svg>
							</button>
							<button
								type="button"
								className={editorMode === 'focus' ? 'is-active' : ''}
								aria-pressed={editorMode === 'focus'}
								aria-label={copy.focus}
								title={copy.focus}
								onClick={() => onSelectEditorMode?.('focus')}
							>
								<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M6 3H3v3M10 3h3v3M3 10v3h3M13 10v3h-3" /></svg>
							</button>
							<button
								type="button"
								className={editorMode === 'typewriter' ? 'is-active' : ''}
								aria-pressed={editorMode === 'typewriter'}
								aria-label={copy.typewriter}
								title={copy.typewriter}
								onClick={() => onSelectEditorMode?.('typewriter')}
							>
								<span className="editor-mode-typewriter" aria-hidden="true">T</span>
							</button>
						</div>
						<button
							type="button"
							className={`status-icon-button source-reveal-toggle${sourceRevealEnabled ? ' is-active' : ''}`}
							data-testid="source-reveal-toggle"
							aria-pressed={sourceRevealEnabled}
							aria-label={sourceRevealLabel}
							title={sourceRevealLabel}
							onClick={onToggleSourceReveal}
						>
							<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="m6 3-3.5 5L6 13M10 3l3.5 5-3.5 5" /><path d="M9 2.5 7 13.5" /></svg>
						</button>
					</>
				) : null}
				<button
					type="button"
					className={`spellcheck-toggle${spellcheckEnabled ? ' is-enabled' : ''}`}
					role="switch"
					aria-checked={spellcheckEnabled}
					aria-label={spellcheckLabel}
					title={spellcheckLabel}
					onClick={onToggleSpellcheck}
				>
					<span className="spellcheck-symbol" aria-hidden="true">ABC</span>
					<span className="spellcheck-track" aria-hidden="true"><span /></span>
				</button>
				<button
					type="button"
					className="status-stats"
					title={stats}
					aria-label={stats}
					onClick={() => setStatsView(nextStatsView)}
				>
					{compactStats[statsView]}
				</button>
			</div>
		</footer>
	);
};
