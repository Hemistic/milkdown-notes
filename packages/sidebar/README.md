# @local/milkdown-sidebar

Reusable browser sidebar with Milkdown editing, AI diff review, files, themes, menus and the original 30px Artifact footer. Private package, not published.

Build the workspace first. Install both local packages (`packages/editor` and `packages/sidebar`) in the host project.

```ts
import {mountSidebar, createHttpFiles} from '@local/milkdown-sidebar';
import '@local/milkdown-sidebar/style.css';

const sidebar = await mountSidebar(element, {
  files: createHttpFiles('/api'),
  aiProvider: (context, signal) => yourHost.streamMarkdown(context, signal),
});
await sidebar.flush();
await sidebar.destroy();
```

Use an empty element with an explicit height. AI is optional. Implement `NoteFiles` for custom storage/IPC. Browser and native hosts share the same API; this package does not manage credentials or invoke models by itself.

Full contracts, lifecycle, PDF handoff and HTTP schema: [sidebar integration](../../docs/sidebar-integration.md). Runnable example: `/example/sidebar.html`. Types ship in `dist`; CSS includes the editor styles. Preserve the complete `dist` directories when using native browser modules. The default HTML exporter reads `style.css` beside the module; supply `exportStylesheets` when your bundler relocates it.

React is bundled only in this sidebar package to retain the original footer; the editor package is framework independent. Third-party and font notices ship in `dist/licenses`.
