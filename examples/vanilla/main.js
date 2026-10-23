import {mountEditor,renderMarkdown} from '/editor/index.js';
const $=id=>document.getElementById(id);
const initial='# Your application\n\nSelect **text** or type / to insert.\n\n| Name | Value |\n| --- | --- |\n| Hello | 42 |\n\nInline $x^2$, ==highlight== and [[guide|a host link]].\n';
$('source').value=initial;
let editor,reader,count=0;
async function mount(){if(editor)return;editor=await mountEditor($('editor'),{markdown:$('source').value,locale:'en',onWikiLink:target=>{$('status').textContent='Host navigation: '+target;},onChange:markdown=>{$('source').value=markdown;$('status').textContent=`Change event ${++count}`;}});$('status').textContent='Mounted';}
async function read(){await reader?.destroy();reader=await renderMarkdown($('reader'),$('source').value,{locale:'en'});await reader.settled();}
$('mount').onclick=mount;
$('destroy').onclick=async()=>{await editor?.destroy();editor=undefined;$('status').textContent='Destroyed; host ready to mount again';};
$('undo').onclick=()=>editor?.undo();$('redo').onclick=()=>editor?.redo();
$('replace').onclick=()=>editor?.setMarkdown($('source').value);
$('read').onclick=read;
$('scale').onchange=()=>{$('scale-wrap').style.transform=`scale(${$('scale').value})`;};
await mount();await read();
