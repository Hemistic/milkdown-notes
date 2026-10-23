import {translator,type LocaleOptions} from './locale.js';
import {safeAssetURL} from './resources.js';
import {noteCodeHighlight} from './note-code.js';
import {codeMirror} from '@milkdown/crepe/feature/code-mirror';
import {languages} from '@codemirror/language-data';
import {safeNoteHtml} from './note-html.js';
import {insertNoteExtension} from './note-extensions.js';
import {CrepeBuilder} from '@milkdown/crepe/builder';
import {ai} from '@milkdown/crepe/feature/ai';
import {blockEdit} from '@milkdown/crepe/feature/block-edit';
import {listItem} from '@milkdown/crepe/feature/list-item';
import {linkTooltip} from '@milkdown/crepe/feature/link-tooltip';
import {table} from '@milkdown/crepe/feature/table';
import {cursor} from '@milkdown/crepe/feature/cursor';
import {placeholder} from '@milkdown/crepe/feature/placeholder';
import {imageBlock} from '@milkdown/crepe/feature/image-block';
import {editorViewCtx,type Editor} from '@milkdown/core';
import type {Ctx} from '@milkdown/ctx';
import {noteSlashRange,noteSlashSupport} from './note-slash.js';
import {insertedNoteNodePosition,insertSlashList,insertSlashTable,insertSlashDivider} from './note-slash-commands.js';
import {noteUiIcon as icon} from './note-ui-icons.js';
import {noteReferenceHref,noteReferencePlugin,type NoteEditingOptions} from './note-references.js';
import {noteSelectionToolbar} from './note-selection-toolbar.js';
import {TextSelection} from '@milkdown/prose/state';

export function insertNoteMath(ctx:Ctx,block:boolean,slash=false){
 const view=ctx.get(editorViewCtx),type=view.state.schema.nodes[block?'note_math_block':'note_math_inline'],tr=view.state.tr,range=slash?noteSlashRange(view):undefined;
 // Removing the trigger and inserting math are one undoable document change.
 if(range)tr.delete(range.from,range.to);
 const latex=tr.doc.textBetween(tr.selection.from,tr.selection.to),node=type.create(null,latex?view.state.schema.text(latex):undefined);
 tr.replaceSelectionWith(node,false);
 // ProseMirror may copy a block while fitting it into a heading/list. Use the
 // replacement's document range, never object identity, to find the new node.
 const position=insertedNoteNodePosition(tr,type);
 if(position===undefined)throw Error('Math insertion anchor missing');
 if(block&&tr.doc.nodeAt(position+node.nodeSize)?.type!==view.state.schema.nodes.paragraph)tr.insert(position+node.nodeSize,view.state.schema.nodes.paragraph.create());
 tr.setSelection(TextSelection.create(tr.doc,position+1,position+1+latex.length));view.dispatch(tr);view.focus();
}
export function editableNoteEditor(host:HTMLElement,markdown:string,assets:Record<string,string>,options:NoteEditingOptions&{readOnly?:boolean}):Editor{
 const t=translator(options);
 const builder=new CrepeBuilder({root:host,defaultValue:markdown});
 const handleRoot=host;
 const slash=options.readOnly?undefined:noteSlashSupport(host);if(slash)builder.editor.use(slash.plugin);
 builder.addFeature(listItem).addFeature(table,{addRowIcon:icon('add',t("添加行")),addColIcon:icon('add',t("添加列")),deleteRowIcon:icon('remove',t("删除行")),deleteColIcon:icon('remove',t("删除列")),alignLeftIcon:icon('alignLeft',t("左对齐")),alignCenterIcon:icon('alignCenter',t("居中")),alignRightIcon:icon('alignRight',t("右对齐")),colDragHandleIcon:icon('dragColumn',t("列操作")),rowDragHandleIcon:icon('drag',t("行操作"))}).addFeature(codeMirror,{languages,extensions:[noteCodeHighlight],searchPlaceholder:t("搜索代码语言"),noResultText:t("没有匹配的语言"),copyText:t("复制代码"),renderLanguage:language=>safeNoteHtml(language||t("纯文本"))});if(!options.readOnly)builder.addFeature(cursor,{virtual:false}).addFeature(placeholder,{text:t("写下你的想法，输入 / 插入内容…")});
 builder.addFeature(imageBlock,{onUpload:async file=>{if(!options.uploadImage)throw Error(t("未配置图片上传接口"));return options.uploadImage(file);},proxyDomURL:url=>safeAssetURL(options.resolveAsset?.(url)??assets[url]??url),inlineUploadButton:t("上传图片"),blockUploadButton:t("上传图片"),blockConfirmButton:t("插入"),blockUploadPlaceholderText:t("粘贴图片地址"),inlineUploadPlaceholderText:t("粘贴图片地址"),blockCaptionPlaceholderText:t("图题")});
 if(!options.readOnly)builder.addFeature(linkTooltip,{inputPlaceholder:t("输入链接地址"),editButton:icon('edit',t("编辑链接")),removeButton:icon('remove',t("移除链接")),confirmButton:icon('confirm',t("确认链接")),linkIcon:icon('copy',t("复制链接"))});
 if(options.aiProvider)builder.addFeature(ai,{provider:options.aiProvider,aiIcon:icon('ai',t("AI 改写")),instructionPlaceholder:t("说明你希望如何改写…"),suggestionsHeaderLabel:t("AI 编辑"),sendAsPromptHeaderLabel:t("自定义要求"),sendAsPromptLabel:t("发送要求："),submitButtonLabel:t("开始改写"),listboxLabel:t("AI 改写方式"),streamingIndicator:{fallbackLabel:t("等待 AI 改写"),cancelHint:t("Esc 取消")},diff:{acceptLabel:t("接受"),rejectLabel:t("放弃")},diffActions:{retryLabel:t("重新改写"),rejectAllLabel:t("放弃全部"),acceptAllLabel:t("接受全部"),modSymbol:'Ctrl'},onError:error=>{let status=host.querySelector<HTMLElement>('.mn-note-ai-error');if(!status){status=document.createElement('small');status.className='mn-note-ai-error';status.setAttribute('role','status');host.append(status);}status.textContent=t("AI 改写失败，原文已保留：")+error.message;},buildAISuggestions:builder=>{builder.clear();for(const [id,label,prompt]of [['rewrite',t("改写"),t("改写选中文字，使表达清晰自然，保留原意、事实、引文和公式。")],['polish',t("学术润色"),t("用准确简洁的学术语言润色选中文字，不增加未经证实的事实。")],['shorten',t("精简"),t("精简选中文字，保留核心含义、证据、引文和公式。")],['expand',t("扩写"),t("补充选中文字的解释与衔接，不捏造事实、证据或来源。")],['grammar',t("修正语法"),t("修正选中文字的语法、错别字和标点，保持原意。")],['chinese',t("翻译为中文"),t("将选中文字翻译为简体中文，保留公式与引文链接。")],['english',t("翻译为英文"),t("将选中文字翻译为英文，保留公式与引文链接。")]])builder.addItem(id,{label,prompt,streamingLabel:label,icon:icon('ai',label)});}});
 if(!options.readOnly)builder.editor.use(noteSelectionToolbar(ctx=>insertNoteMath(ctx,false),!!options.aiProvider,options));
 if(!options.readOnly)builder.addFeature(blockEdit,{slashMenu:slash!.slashMenu,blockHandle:{root:handleRoot,getPlacement:()=> 'right-start',floatingUIOptions:{middleware:[]},getPosition:({active,blockDom})=>{
  // Reuse the card's existing padding, without reserving extra document width.
  if(!blockDom.dataset.noteBound){blockDom.dataset.noteBound='true';for(const type of ['pointerdown','click','dragstart','dragover','drop'])blockDom.addEventListener(type,event=>event.stopPropagation());}
  const bounds=handleRoot.getBoundingClientRect(),block=active.el.getBoundingClientRect(),height=blockDom.getBoundingClientRect().height;
  const top=Math.max(bounds.top,Math.min(block.top,bounds.bottom-height));
  return {x:bounds.left,y:top,left:bounds.left,right:bounds.left,top,bottom:top,width:0,height:0};
 }},handleAddIcon:icon('add',t("插入块")),handleDragIcon:icon('drag',t("拖动块")),textGroup:{label:t("文本"),text:{label:t("正文")},...Object.fromEntries([1,2,3,4,5,6].map(level=>['h'+level,{label:t("标题 ")+level}])),quote:{label:t("引用块")},divider:{label:t("分隔线")}},listGroup:{label:t("列表"),bulletList:{label:t("无序列表")},orderedList:{label:t("有序列表")},taskList:{label:t("任务列表")}},advancedGroup:{label:t("内容"),image:{label:t("图片")},codeBlock:{label:t("代码块")},table:{label:t("表格")}},buildMenu:groups=>{const divider=groups.getGroup('text').group.items.find(item=>item.key==='divider');if(divider)divider.onRun=insertSlashDivider;for(const item of groups.getGroup('list').group.items){const kind=item.key==='ordered-list'?'ordered':item.key==='task-list'?'task':'bullet';item.onRun=ctx=>insertSlashList(ctx,kind);}const tableItem=groups.getGroup('advanced').group.items.find(item=>item.key==='table');if(tableItem)tableItem.onRun=insertSlashTable;groups.addGroup('navigation',t("笔记结构")).addItem('toc',{label:t("目录"),icon:icon('toc',t("目录")),onRun:(ctx:Ctx)=>insertNoteExtension(ctx,'toc')}).addItem('mermaid',{label:t("Mermaid 图表"),icon:icon('diagram',t("Mermaid 图表")),onRun:(ctx:Ctx)=>insertNoteExtension(ctx,'mermaid')});groups.addGroup('formula',t("公式")).addItem('inline-formula',{label:t("行内公式"),icon:icon('math',t("行内公式")),onRun:(ctx:Ctx)=>insertNoteMath(ctx,false,true)}).addItem('block-formula',{label:t("公式块"),icon:icon('math',t("公式块")),onRun:(ctx:Ctx)=>insertNoteMath(ctx,true,true)});}});
 if(options.references)builder.editor.use(noteReferencePlugin(host,options));
 return builder.editor;
}
export function bindNoteUi(host:HTMLElement,options:NoteEditingOptions){
 const t=translator(options);
 const pointer=(event:Event)=>{if((event.target as Element).closest('.milkdown-toolbar,.milkdown-slash-menu,.milkdown-block-handle,.mn-note-references,.ProseMirror'))event.stopPropagation();};
 const error=(message:string)=>{let status=host.querySelector<HTMLElement>('.mn-note-reference-error');if(!status){status=host.ownerDocument.createElement('small');status.className='mn-note-reference-error';status.setAttribute('role','status');host.append(status);}status.textContent=message;};
 const open=(event:MouseEvent)=>{const anchor=(event.target as Element).closest<HTMLAnchorElement>('a[href]');if(!anchor)return;
  const href=anchor.getAttribute('href');if(!href||anchor.hasAttribute('data-note-wiki')||anchor.hasAttribute('data-note-heading'))return;if(!href.startsWith('#note-ref/')){if(options.onLink&&(host.dataset.readonly==='true'||event.ctrlKey||event.metaKey)){event.preventDefault();void Promise.resolve().then(()=>options.onLink!(href)).catch(reason=>error(String(reason)));}return;}event.preventDefault();
  if(!(host.dataset.readonly==='true'||event.ctrlKey||event.metaKey||anchor.closest('.link-preview')))return;event.stopImmediatePropagation();
  const reference=options.references?.().find(ref=>noteReferenceHref(ref)===href);if(!reference){error(t("引用已移除或不属于当前工作区"));return;}
  void Promise.resolve().then(()=>options.onReference?.(reference)).catch(reason=>error(t("打开引用失败：")+String(reason)));
 };
 host.addEventListener('pointerdown',pointer);host.addEventListener('click',open,true);
 const handleRoot=host;
 const hideHandle=()=>{for(const el of handleRoot.querySelectorAll<HTMLElement>(':scope>.milkdown-block-handle'))el.dataset.show='false';};
 handleRoot.addEventListener('scroll',hideHandle,true);
 const drag=(event:Event)=>event.stopPropagation();for(const type of ['dragstart','dragover','drop'])host.addEventListener(type,drag);
 return ()=>{handleRoot.removeEventListener('scroll',hideHandle,true);host.removeEventListener('pointerdown',pointer);host.removeEventListener('click',open,true);for(const type of ['dragstart','dragover','drop'])host.removeEventListener(type,drag);};
}
