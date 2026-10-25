import DOMPurify from 'dompurify';
export function download(content:string,type:string,name:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export const safeName=(name:string)=>name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/\.md$/i,'')||'note';
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function dataUrl(url:string){const response=await fetch(url);if(!response.ok)throw Error('无法导出资源：'+url);const blob=await response.blob();return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});}
/** Export the actual rendered schema (including math/diagrams), with local assets embedded. */
export async function exportHtml(host:HTMLElement,title:string){
  const source=host.querySelector('.ProseMirror');if(!source)throw Error('编辑器尚未就绪');const copy=source.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('.ProseMirror-widget,.prosemirror-virtual-cursor,.milkdown-toolbar,.tools,.handle,.mn-note-selection-toolbar,.mn-note-math-source').forEach(el=>el.remove());
  copy.removeAttribute('role');copy.removeAttribute('aria-label');
  const headings=copy.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6');
  copy.querySelectorAll<HTMLAnchorElement>('a[data-note-heading]').forEach(link=>{const heading=headings[Number(link.dataset.noteHeading)];if(heading){if(!heading.id)heading.id='note-heading-'+link.dataset.noteHeading;link.href='#'+heading.id;}});
  for(const el of [copy,...copy.querySelectorAll<HTMLElement>('*')]){el.removeAttribute('contenteditable');el.removeAttribute('tabindex');el.removeAttribute('draggable');el.removeAttribute('data-mn-source-block');}
  await Promise.all(Array.from(copy.querySelectorAll('img')).map(async img=>{if(img.src.startsWith(location.origin+'/assets/'))img.src=await dataUrl(img.src);}));
  let css=await(await fetch('/editor/style.css')).text();
  const urls=[...new Set([...css.matchAll(/url\(([^)]+)\)/g)].map(match=>match[1].replace(/^['"]|['"]$/g,'')))];
  for(const url of urls){if(url.startsWith('data:')||url.startsWith('#'))continue;const full=new URL(url,location.origin+'/editor/style.css');if(full.origin===location.origin)css=css.split(url).join(await dataUrl(full.href));}
  const html=DOMPurify.sanitize(copy.outerHTML,{ADD_TAGS:['math','annotation']});
  return `<!doctype html><html lang="${document.documentElement.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${css.replace(/<\/style/gi,'<\\/style')}\nbody{margin:0;background:#fff;color:#222}.mn-note-document.mn-note-surface{box-sizing:border-box;max-width:min(880px,100%);margin:auto;padding:24px}.mn-note-document .milkdown .ProseMirror{min-height:0}.mn-note-document button{display:none}@media print{.mn-note-document.mn-note-surface{max-width:none;padding:0}pre,figure,img{break-inside:avoid}}</style></head><body><article class="mn-note-document mn-note-surface" data-theme="light"><div class="milkdown">${html}</div></article></body></html>`;
}
export async function printHtml(html:string){
  const frame=document.createElement('iframe');frame.title='PDF 打印';frame.style.cssText='position:fixed;width:1px;height:1px;left:-9999px;border:0';
  const loaded=new Promise<void>((resolve,reject)=>{frame.onload=()=>resolve();frame.onerror=()=>reject(Error('打印文档加载失败'));});
  frame.srcdoc=html;document.body.append(frame);await loaded;await frame.contentDocument?.fonts.ready;
  const cleanup=()=>frame.remove();frame.contentWindow?.addEventListener('afterprint',cleanup,{once:true});
  frame.contentWindow?.focus();frame.contentWindow?.print();
  // Some embedded browsers do not dispatch afterprint on cancellation.
  setTimeout(cleanup,60000);
}
