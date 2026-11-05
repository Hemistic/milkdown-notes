

import type { Ctx } from '@milkdown/ctx'
import { commandsCtx, parserCtx, serializerCtx } from '@milkdown/core'
import type { Node as ProseNode } from '@milkdown/prose/model'
import { Plugin } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { clearDiffReviewCmd, diffPluginKey, getPendingChanges, startDiffReviewFromDocCmd } from '@milkdown/plugin-diff'

export type NoteReview = {
  key: string; mode: 'review' | 'readonly'; source: string; beforeSource: string
  assetsBefore?: Record<string, string>; assetsAfter?: Record<string, string>
  entries?: Array<{ id: string; offset: number; source: string; direction: string; decision?: string; options: Array<{ value: string; label: string; source: string | null }> }>
  dataChanges?: Array<{ blockSource: string; row: string; column: string; before: string; after: string }>
}
export type NoteReviewResult = { key: string; count: number; pending: number; source: string }

function images(doc: ProseNode, assets: Record<string, string>) : ProseNode {
  const children = doc.content.content.map(node => images(node, assets))
  const attrs = ['image-block', 'image'].includes(doc.type.name) && Object.hasOwn(assets, doc.attrs.src)
    ? { ...doc.attrs, src: assets[doc.attrs.src] || doc.attrs.src } : doc.attrs
  return doc.isText ? doc : doc.type.create(attrs, children, doc.marks)
}

// A host adapter only. Crepe.Feature.AI already installs Milkdown's diff state,
// diffComponent decorations, per-change accept/reject commands and hover UI.
// We feed it parsed rich documents, exactly as its AI streaming hand-off does.
// There is no source diff or independent diff algorithm in this adapter.
export function noteReviewPlugin(ctx: Ctx, host: HTMLElement, review: NoteReview,
  decide: (id: string, value: string) => void, report: (result: NoteReviewResult) => void) {
  let started = false, initialCount = 0
  const restore = Object.fromEntries([...Object.entries(review.assetsBefore || {}), ...Object.entries(review.assetsAfter || {})].filter(([, url]) => url).map(([href, url]) => [url, href]))
  return new Plugin({
    filterTransaction: tr => !tr.docChanged || Boolean(tr.getMeta('document-review-init')) || review.mode === 'review' && Boolean(tr.getMeta(diffPluginKey)),
    props: {
      editable: () => false,
      decorations(state) {
        // These annotations select which conflicting proposal to review; all
        // red/green content and accept/reject controls come from Milkdown.
        const decorations: Decoration[] = []
        for (const entry of review.entries || []) {
          if (entry.direction !== 'conflict') continue
          const original = entry.options.find(option => option.value === 'before')?.source
          const parse = ctx.get(parserCtx), originalDoc = original ? parse(original) : null
          let position = -1
          state.doc.forEach((node, pos) => { if (position < 0 && node.textContent === originalDoc?.firstChild?.textContent) position = pos })
          if (position < 0) continue
          decorations.push(Decoration.widget(position, () => {
            const bar = document.createElement('div'); bar.className = 'mn-review-choices document-proposal-choice'; bar.contentEditable = 'false'
            const label = document.createElement('span'); label.textContent = '两边有分歧 · 对照候选：'; bar.append(label)
            for (const {value, label: title} of entry.options.filter(option => option.value !== 'before')) {
              const button = document.createElement('button'); button.type = 'button'; button.textContent = title
              button.setAttribute('aria-pressed', String((entry.decision || entry.options.find(option => option.value !== 'before')?.value) === value))
              button.onclick = () => decide(entry.id, value); bar.append(button)
            }
            return bar
          }, { key: `proposal:${entry.id}`, side: -1, stopEvent: () => true }))
        }
        for (const [index, change] of (review.dataChanges || []).entries()) {
          const expected = ctx.get(parserCtx)(change.blockSource).firstChild
          const tableKey = (node: ProseNode) => JSON.stringify([node.firstChild?.textContent, node.content.content.slice(1).map(row => row.firstChild?.textContent)])
          const candidates: ProseNode[] = []
          state.doc.forEach(node => { if (node.type.name === 'table' && expected && tableKey(node) === tableKey(expected)) candidates.push(node) })
          if (candidates.length !== 1) continue
          state.doc.forEach((table, pos) => {
            if (table !== candidates[0]) return
            let column = -1; table.firstChild?.forEach((cell, _, col) => { if (cell.textContent === change.column) column = col })
            if (column < 1) return
            table.forEach((row, rowPos, rowIndex) => {
              if (!rowIndex || row.firstChild?.textContent !== change.row) return
              row.forEach((cell, cellPos, col) => {
                if (col !== column) return
                const note = document.createElement('span'); note.className = 'document-review-data'; note.textContent = `数据记录：${change.before} → ${change.after}`
                decorations.push(Decoration.widget(pos + 1 + rowPos + 1 + cellPos + cell.nodeSize - 1, note, { key: `data:${index}` }))
              })
            })
          })
        }
        return DecorationSet.create(state.doc, decorations)
      },
    },
    view: view => {
      let disposed = false
      host.dataset.noteReview = review.mode
      const publish = () => {
        const diff = diffPluginKey.getState(view.state)
        const pending = diff ? getPendingChanges(diff).length : 0
        report({ key: review.key, count: initialCount, pending, source: initialCount ? ctx.get(serializerCtx)(images(view.state.doc, restore)) : review.source })
      }
      queueMicrotask(() => {
        if (disposed) return
        const parse = ctx.get(parserCtx)
        const before = images(parse(review.beforeSource), review.assetsBefore || {}), target = images(parse(review.source), review.assetsAfter || {})
        view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, before.content).setMeta('document-review-init', true).setMeta('addToHistory', false))
        ctx.get(commandsCtx).call(startDiffReviewFromDocCmd.key, target)
        initialCount = diffPluginKey.getState(view.state)?.changes.length || 0
        if (!initialCount) ctx.get(commandsCtx).call(clearDiffReviewCmd.key)
        started = true; host.dataset.noteDiff = 'milkdown'; publish()
      })
      return { update: (_, previous) => { if (started && (previous.doc !== view.state.doc || diffPluginKey.getState(previous) !== diffPluginKey.getState(view.state))) publish() },
        destroy: () => { disposed = true; delete host.dataset.noteReview; delete host.dataset.noteDiff } }
    },
  })
}
