import {mountEditor,type NoteEditor,type NoteReference} from '@local/milkdown-notes';
import {createFooter} from './artifact/footer.js';
import {countWords} from './artifact/markdown.js';
import {bindEditorModes} from './artifact/editor-modes.js';
import type {NotesEditorMode} from './artifact/types.js';
import type {MarkdownExportFormat} from './artifact/StatusBar.js';
import {download,safeName,exportHtml,printHtml} from './artifact/export.js';
import {welcome} from './welcome.js';
import {setupMenu,setIcon} from './menu.js';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const menu=setupMenu();
const footer=createFooter($('statusbar-root'));
const modes=bindEditorModes($('editor-pane'),$('editor'));
let preference:any={};try{preference=JSON.parse(localStorage.getItem('milkdown.notes.editorPreferences')||'{}')??{};}catch{}
let editorMode:NotesEditorMode=['focus','typewriter'].includes(preference.mode)?preference.mode:'normal',outlineOpen=preference.outline===true,spellcheck=preference.spellcheck===true,sourceReveal=preference.source===true,statusText='正在加载…';
let editor:NoteEditor|undefined,id='',notes:{id:string;title:string}[]=[],readOnly=false,theme:'light'|'dark'=preference.theme==='dark'?'dark':'light',locale:'zh-CN'|'en'='zh-CN',switching=false;
let pending:Promise<void>=Promise.resolve(),timer:ReturnType<typeof setTimeout>|undefined,dirty=false,revision=0;
const status=(text:string)=>{ statusText=text;$('status').textContent=text;renderFooter();const failed=text.startsWith('操作失败');$('menu-toggle').dataset.error=String(failed);$('menu-toggle').title=failed?text:'笔记菜单';};
async function api(url:string,init?:RequestInit){const res=await fetch(url,init);const value=await res.json();if(!res.ok)throw Error(value.error??res.statusText);return value;}
const report=(error:unknown)=>{status('操作失败：'+String(error));console.error(error);};
function queueSave(noteId:string,markdown:string){const ticket=revision;status('正在保存…');const job=pending.then(()=>api('/api/notes/'+noteId,{method:'PUT',body:markdown}));pending=job.then(()=>{},()=>{});return job.then(()=>{if(id===noteId&&revision===ticket){dirty=false;status('已保存到本机');}return refresh();});}
async function flush(){clearTimeout(timer);if(editor&&dirty)await queueSave(id,editor.getMarkdown());await pending;}
async function refresh(){notes=await api('/api/notes');const nav=$('notes');nav.replaceChildren();for(const note of notes){const button=document.createElement('button');button.className='menu-item';const icon=document.createElement('span');icon.dataset.icon='file';setIcon(icon,'file');const label=document.createElement('span');label.className='item-label';label.textContent=note.title;button.append(icon,label);button.title=note.title;button.setAttribute('aria-current',String(note.id===id));button.onclick=()=>{menu.close();void open(note.id).catch(report);};nav.append(button);}}
const refs=():NoteReference[]=>notes.map(n=>({id:n.id,label:n.title,kind:'note'}));
async function mount(markdown:string){
  await editor?.destroy();editor=undefined;renderFooter();
  editor=await mountEditor($('editor'),{markdown,readOnly,theme,locale,spellcheck,sourceReveal,references:refs,
    onReference:ref=>open(ref.id),onWikiLink:async target=>{const found=notes.filter(n=>n.id===target||n.title===target);if(found.length!==1)throw Error(found.length?'同名笔记需要使用 ID':'笔记不存在：'+target);await open(found[0].id);},
    uploadImage:async file=>(await api('/api/images',{method:'POST',headers:{'Content-Type':file.type},body:file})).url,
    onChange:()=>{if(readOnly)return;dirty=true;revision++;status('待保存…');clearTimeout(timer);timer=setTimeout(()=>void flush().catch(report),350);},
  });
  updateOutline();modes.refresh();renderFooter();
}
async function open(next:string){if(switching)return;switching=true;try{await flush();const note=await api('/api/notes/'+next);id=next;dirty=false;await mount(note.markdown);await refresh();status(readOnly?'阅读模式':'已保存到本机');}finally{switching=false;}}
async function create(markdown='# 新笔记\n\n',title?:string){await flush();const next=crypto.randomUUID();await api('/api/notes/'+next,{method:'PUT',body:markdown});if(title)await api('/api/notes/'+next,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})});await open(next);editor?.focus();}
$('new').onclick=()=>{menu.close();void create().catch(report);};
$('undo').onclick=()=>{menu.close();editor?.undo();};$('redo').onclick=()=>{menu.close();editor?.redo();};
$('preview').onclick=()=>{menu.close();void(async()=>{if(!editor)return;await flush();const markdown=editor.getMarkdown();readOnly=!readOnly;$('preview').querySelector('.item-label')!.textContent=readOnly?'返回编辑':'阅读模式';setIcon($('preview').querySelector('[data-icon]')!,readOnly?'edit':'read');$<HTMLButtonElement>('undo').disabled=readOnly;$<HTMLButtonElement>('redo').disabled=readOnly;await mount(markdown);status(readOnly?'阅读模式':'已保存到本机');})().catch(report);};
function syncTheme(){document.documentElement.dataset.theme=theme;document.body.dataset.theme=theme;editor?.setTheme(theme);$('theme-light').setAttribute('aria-pressed',String(theme==='light'));$('theme-dark').setAttribute('aria-pressed',String(theme==='dark'));}
function selectTheme(next:'light'|'dark'){theme=next;syncTheme();savePreferences();renderFooter();}
function toggleTheme(){selectTheme(theme==='light'?'dark':'light');}
$('theme-light').onclick=()=>selectTheme('light');$('theme-dark').onclick=()=>selectTheme('dark');
for(const [button,next] of [['locale-zh','zh-CN'],['locale-en','en']] as const){$(button).onclick=()=>void(async()=>{if(!editor)return;await flush();locale=next;await mount(editor.getMarkdown());$('locale-zh').setAttribute('aria-pressed',String(locale==='zh-CN'));$('locale-en').setAttribute('aria-pressed',String(locale==='en'));})().catch(report);}
$('import').onclick=()=>{menu.close();$<HTMLInputElement>('file').click();};
$<HTMLInputElement>('file').onchange=()=>void(async()=>{const file=$<HTMLInputElement>('file').files?.[0];if(file)await create(await file.text(),safeName(file.name.replace(/\.markdown$/i,'')));$<HTMLInputElement>('file').value='';})().catch(report);
$('export').onclick=()=>{menu.close();void exportDocument('markdown').catch(report);};
function savePreferences(){try{localStorage.setItem('milkdown.notes.editorPreferences',JSON.stringify({theme,mode:editorMode,outline:outlineOpen,spellcheck,source:sourceReveal}));}catch{}}
function updateOutline(){
  $('outline').hidden=!outlineOpen;const list=$('outline').querySelector('.outline-list')!;const headings=$('editor').querySelectorAll<HTMLElement>('.ProseMirror h1,.ProseMirror h2,.ProseMirror h3,.ProseMirror h4,.ProseMirror h5,.ProseMirror h6');
  list.replaceChildren();for(const heading of headings){const button=document.createElement('button');button.className='outline-item outline-level-'+heading.tagName.slice(1);button.textContent=heading.textContent||'…';button.title=button.textContent;button.onclick=()=>heading.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});list.append(button);}
  if(!headings.length){const empty=document.createElement('div');empty.className='outline-empty';empty.textContent=locale==='en'?'No headings yet':'还没有标题';list.append(empty);}
  $('outline').querySelector('.outline-panel-title')!.textContent=locale==='en'?'Outline':'大纲';
}
function renderFooter(){
  const markdown=editor?.getMarkdown()??'';
  footer.render({...countWords(markdown),status:statusText,locale:locale==='en'?'en':'zh',spellcheckEnabled:spellcheck,editorControls:!!editor,outlineOpen,theme,editorMode,sourceRevealEnabled:sourceReveal,showFileMenu:!!editor,
    onToggleSpellcheck(){spellcheck=!spellcheck;editor?.setSpellcheck(spellcheck);savePreferences();renderFooter();},
    onToggleOutline(){outlineOpen=!outlineOpen;updateOutline();savePreferences();renderFooter();},
    onToggleTheme:toggleTheme,
    onSelectEditorMode(mode){editorMode=mode;if(mode==='focus')outlineOpen=false;updateOutline();modes.set(mode);savePreferences();renderFooter();},
    onToggleSourceReveal(){sourceReveal=!sourceReveal;editor?.setSourceReveal(sourceReveal);savePreferences();renderFooter();},
    onImportSnapshot:()=>$<HTMLInputElement>('file').click(),onRenameDocument:renameDocument,onExportDocument:format=>void exportDocument(format).catch(report),
  });
}
function renameDocument(){const dialog=$<HTMLDialogElement>('rename-dialog'),input=$<HTMLInputElement>('rename-name');input.value=notes.find(note=>note.id===id)?.title??'note';input.setCustomValidity('');dialog.returnValue='';dialog.showModal();input.select();}
$<HTMLInputElement>('rename-name').oninput=()=>{const input=$<HTMLInputElement>('rename-name');input.setCustomValidity(/[<>:"/\\|?*\x00-\x1f]/.test(input.value)||!input.value.trim()?'请输入有效的文件名':'');};
$('rename-dialog').addEventListener('close',()=>{if($<HTMLDialogElement>('rename-dialog').returnValue!=='save')return;const noteId=id,title=$<HTMLInputElement>('rename-name').value.trim().replace(/\.md$/i,'');void(async()=>{await flush();await api('/api/notes/'+noteId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})});await refresh();status('已重命名');})().catch(report);});
async function exportDocument(format:MarkdownExportFormat){
  if(!editor)return;await flush();await editor.settled();const title=notes.find(note=>note.id===id)?.title??'note';
  if(format==='markdown'){download(editor.getMarkdown(),'text/markdown;charset=utf-8',safeName(title)+'.md');return;}
  const html=await exportHtml($('editor'),title);
  if(format==='html')download(html,'text/html;charset=utf-8',safeName(title)+'.html');
  else{await printHtml(html);status('已请求打印，请选择另存为 PDF');}
}
let outlineFrame=0;new MutationObserver(()=>{if(!outlineFrame)outlineFrame=requestAnimationFrame(()=>{outlineFrame=0;if(outlineOpen)updateOutline();});}).observe($('editor'),{subtree:true,childList:true,characterData:true});
syncTheme();modes.set(editorMode);updateOutline();renderFooter();
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty)void flush().catch(report);});
await (async()=>{await refresh();if(!notes.length){await api('/api/notes/guide',{method:'PUT',body:'# 集成指南\n\n此应用使用与集成示例相同的编辑器模块。\n\n返回 [[welcome|欢迎笔记]]。'});await api('/api/notes/welcome',{method:'PUT',body:welcome});await refresh();}await open(notes.find(n=>n.id==='welcome')?.id??notes[0].id);})().catch(report);
