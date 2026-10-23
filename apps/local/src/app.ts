import {mountEditor,type NoteEditor,type NoteReference} from '@local/milkdown-notes';
import {welcome} from './welcome.js';
import {setupMenu,setIcon} from './menu.js';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const menu=setupMenu();
let editor:NoteEditor|undefined,id='',notes:{id:string;title:string}[]=[],readOnly=false,theme:'light'|'dark'='light',locale:'zh-CN'|'en'='zh-CN',switching=false;
let pending:Promise<void>=Promise.resolve(),timer:ReturnType<typeof setTimeout>|undefined,dirty=false,revision=0;
const status=(text:string)=>{ $('status').textContent=text;const failed=text.startsWith('操作失败');$('menu-toggle').dataset.error=String(failed);$('menu-toggle').title=failed?text:'笔记菜单';};
async function api(url:string,init?:RequestInit){const res=await fetch(url,init);const value=await res.json();if(!res.ok)throw Error(value.error??res.statusText);return value;}
const report=(error:unknown)=>{status('操作失败：'+String(error));console.error(error);};
function queueSave(noteId:string,markdown:string){const ticket=revision;status('正在保存…');const job=pending.then(()=>api('/api/notes/'+noteId,{method:'PUT',body:markdown}));pending=job.then(()=>{},()=>{});return job.then(()=>{if(id===noteId&&revision===ticket){dirty=false;status('已保存到本机');}return refresh();});}
async function flush(){clearTimeout(timer);if(editor&&dirty)await queueSave(id,editor.getMarkdown());await pending;}
async function refresh(){notes=await api('/api/notes');const nav=$('notes');nav.replaceChildren();for(const note of notes){const button=document.createElement('button');button.className='menu-item';const icon=document.createElement('span');icon.dataset.icon='file';setIcon(icon,'file');const label=document.createElement('span');label.className='item-label';label.textContent=note.title;button.append(icon,label);button.title=note.title;button.setAttribute('aria-current',String(note.id===id));button.onclick=()=>{menu.close();void open(note.id).catch(report);};nav.append(button);}}
const refs=():NoteReference[]=>notes.map(n=>({id:n.id,label:n.title,kind:'note'}));
async function mount(markdown:string){
  await editor?.destroy();editor=undefined;
  editor=await mountEditor($('editor'),{markdown,readOnly,theme,locale,references:refs,
    onReference:ref=>open(ref.id),onWikiLink:async target=>{const found=notes.filter(n=>n.id===target||n.title===target);if(found.length!==1)throw Error(found.length?'同名笔记需要使用 ID':'笔记不存在：'+target);await open(found[0].id);},
    uploadImage:async file=>(await api('/api/images',{method:'POST',headers:{'Content-Type':file.type},body:file})).url,
    onChange:()=>{if(readOnly)return;dirty=true;revision++;status('待保存…');clearTimeout(timer);timer=setTimeout(()=>void flush().catch(report),350);},
  });
}
async function open(next:string){if(switching)return;switching=true;try{await flush();const note=await api('/api/notes/'+next);id=next;dirty=false;await mount(note.markdown);await refresh();status(readOnly?'阅读模式':'已保存到本机');}finally{switching=false;}}
async function create(markdown='# 新笔记\n\n'){await flush();const next=crypto.randomUUID();await api('/api/notes/'+next,{method:'PUT',body:markdown});await open(next);editor?.focus();}
$('new').onclick=()=>{menu.close();void create().catch(report);};
$('undo').onclick=()=>{menu.close();editor?.undo();};$('redo').onclick=()=>{menu.close();editor?.redo();};
$('preview').onclick=()=>{menu.close();void(async()=>{if(!editor)return;await flush();const markdown=editor.getMarkdown();readOnly=!readOnly;$('preview').querySelector('.item-label')!.textContent=readOnly?'返回编辑':'阅读模式';setIcon($('preview').querySelector('[data-icon]')!,readOnly?'edit':'read');$<HTMLButtonElement>('undo').disabled=readOnly;$<HTMLButtonElement>('redo').disabled=readOnly;await mount(markdown);status(readOnly?'阅读模式':'已保存到本机');})().catch(report);};
$('theme').onclick=()=>{theme=theme==='light'?'dark':'light';document.body.dataset.theme=theme;editor?.setTheme(theme);$('theme').querySelector('.item-label')!.textContent=theme==='dark'?'浅色外观':'深色外观';setIcon($('theme').querySelector('[data-icon]')!,theme==='dark'?'sun':'moon');};
for(const [button,next] of [['locale-zh','zh-CN'],['locale-en','en']] as const){$(button).onclick=()=>void(async()=>{if(!editor)return;await flush();locale=next;await mount(editor.getMarkdown());$('locale-zh').setAttribute('aria-pressed',String(locale==='zh-CN'));$('locale-en').setAttribute('aria-pressed',String(locale==='en'));})().catch(report);}
$('import').onclick=()=>{menu.close();$<HTMLInputElement>('file').click();};
$<HTMLInputElement>('file').onchange=()=>void(async()=>{const file=$<HTMLInputElement>('file').files?.[0];if(file)await create(await file.text());$<HTMLInputElement>('file').value='';})().catch(report);
$('export').onclick=()=>{menu.close();if(!editor)return;const url=URL.createObjectURL(new Blob([editor.getMarkdown()],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=(notes.find(n=>n.id===id)?.title??'note').replace(/[<>:"/\\|?*]/g,'_')+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty)void flush().catch(report);});
await (async()=>{await refresh();if(!notes.length){await api('/api/notes/guide',{method:'PUT',body:'# 集成指南\n\n此应用使用与集成示例相同的编辑器模块。\n\n返回 [[welcome|欢迎笔记]]。'});await api('/api/notes/welcome',{method:'PUT',body:welcome});await refresh();}await open(notes.find(n=>n.id==='welcome')?.id??notes[0].id);})().catch(report);
