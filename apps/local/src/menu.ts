import {PanelTop,FilePlus2,History,BookOpen,Pencil,Undo2,Redo2,FileText,FolderInput,Download,Settings2,Moon,Sun,Languages,Check,ChevronRight,Code2,ArrowUpRight,CheckCheck,type IconNode} from 'lucide';

const icons={menu:PanelTop,new:FilePlus2,history:History,read:BookOpen,edit:Pencil,undo:Undo2,redo:Redo2,file:FileText,import:FolderInput,export:Download,settings:Settings2,moon:Moon,sun:Sun,language:Languages,check:Check,chevron:ChevronRight,code:Code2,external:ArrowUpRight,saved:CheckCheck} satisfies Record<string,IconNode>;
export function setIcon(element:Element,name:keyof typeof icons){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);
  for(const [tag,attributes] of icons[name]){const child=document.createElementNS(svg.namespaceURI,tag);for(const [key,value] of Object.entries(attributes))child.setAttribute(key,String(value));svg.append(child);}
  element.replaceChildren(svg);
}
export function setupMenu(){
  document.querySelectorAll<HTMLElement>('[data-icon]').forEach(el=>setIcon(el,el.dataset.icon as keyof typeof icons));
  const anchor=document.getElementById('menu-anchor')!,panel=document.getElementById('app-menu')!,toggle=document.getElementById('menu-toggle')!;
  const branches=[...panel.querySelectorAll<HTMLElement>('.menu-branch')];
  const button=(branch:HTMLElement)=>branch.querySelector<HTMLButtonElement>('.branch-toggle')!;
  const submenu=(branch:HTMLElement)=>branch.querySelector<HTMLElement>('.submenu')!;
  const setBranch=(branch:HTMLElement,expanded:boolean)=>{button(branch).setAttribute('aria-expanded',String(expanded));submenu(branch).hidden=!expanded;};
  const closeBranches=()=>branches.forEach(branch=>setBranch(branch,false));
  const openBranch=(branch:HTMLElement)=>{closeBranches();setBranch(branch,true);};
  const close=(restoreFocus=false)=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false');closeBranches();if(restoreFocus)toggle.focus();};
  const items=(container:Element)=>[...container.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')].filter(el=>el.getClientRects().length>0);
  toggle.onclick=()=>{if(!panel.hidden){close();return;}panel.hidden=false;toggle.setAttribute('aria-expanded','true');};
  toggle.onkeydown=event=>{if(event.key==='ArrowDown'){event.preventDefault();panel.hidden=false;toggle.setAttribute('aria-expanded','true');items(panel)[0]?.focus();}};
  for(const branch of branches){
    branch.onpointerenter=event=>{if(event.pointerType==='mouse')openBranch(branch);};
    branch.onpointerleave=event=>{if(event.pointerType==='mouse'&&!branch.contains(document.activeElement))setBranch(branch,false);};
    button(branch).onclick=()=>openBranch(branch);
  }
  panel.querySelectorAll<HTMLElement>(':scope > .menu-item').forEach(el=>el.onpointerenter=()=>closeBranches());
  panel.addEventListener('keydown',event=>{
    const target=event.target as HTMLElement,branch=target.closest<HTMLElement>('.menu-branch');
    if(event.key==='ArrowRight'&&target.classList.contains('branch-toggle')&&branch){event.preventDefault();openBranch(branch);items(submenu(branch))[0]?.focus();}
    else if(event.key==='ArrowLeft'&&branch&&!submenu(branch).hidden){event.preventDefault();setBranch(branch,false);button(branch).focus();}
    else if(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Home'||event.key==='End'){
      event.preventDefault();const scope=target.closest('.submenu')??panel;const list=items(scope).filter(el=>scope!==panel||!el.closest('.submenu'));const index=list.indexOf(target);list[event.key==='Home'?0:event.key==='End'?list.length-1:(index+(event.key==='ArrowDown'?1:-1)+list.length)%list.length]?.focus();
    }
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close(true);}});
  document.addEventListener('pointerdown',event=>{if(!anchor.contains(event.target as Node))close();});
  anchor.addEventListener('focusout',event=>{if(event.relatedTarget&&!anchor.contains(event.relatedTarget as Node))close();});
  return {close};
}
