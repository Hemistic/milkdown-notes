# @local/milkdown-notes

Private, framework-independent browser Markdown editor extracted from Artinfact 0.13.41. Not an official Milkdown product. Build from the workspace with `npm ci && npm run build` before local installation.

```ts
import {mountEditor} from '@local/milkdown-notes';
import '@local/milkdown-notes/style.css';
const editor = await mountEditor(element, {markdown: '# Hello', onChange: save});
editor.setMarkdown('# Updated');
const markdown = editor.getMarkdown();
await editor.destroy();
```

Copy the entire dist directory for direct browser ESM use, including chunks, fonts and licenses. The bundle already contains the pinned Milkdown 7.22.3 compatibility adapters. Do not import internal source files without those build adapters.

Optional options: locale, messages, theme, readOnly, references, backlinks, onReference, onWikiLink, onLink, resolveAsset, uploadImage, aiProvider. No AI or storage service is required for basic editing. `renderMarkdown` creates a managed read-only instance of the same renderer.

See the repository README and docs/integration.md for the complete contract and limits. Project distribution licensing is not yet specified; third-party notices are in dist/licenses. This package is private and has not been published.
