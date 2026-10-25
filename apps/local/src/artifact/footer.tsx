import {createRoot} from 'react-dom/client';
import {StatusBar,type StatusBarProps} from './StatusBar';
export function createFooter(host:HTMLElement){
  const root=createRoot(host);
  const scroll=(event:WheelEvent)=>{const target=event.target instanceof Element?event.target.closest<HTMLElement>('.status-actions'):null;if(target&&target.scrollWidth>target.clientWidth){event.preventDefault();target.scrollLeft+=event.deltaX||event.deltaY;}};
  host.addEventListener('wheel',scroll,{passive:false});
  const observer=new MutationObserver(()=>{const active=document.activeElement;if(!(active instanceof HTMLElement)||!host.contains(active))return;const strip=active.closest('.status-actions');if(!strip)return;const bounds=strip.getBoundingClientRect(),button=active.getBoundingClientRect();if(button.right>bounds.right)strip.scrollLeft+=button.right-bounds.right;if(button.left<bounds.left)strip.scrollLeft+=button.left-bounds.left;});
  observer.observe(host,{subtree:true,childList:true,characterData:true});
  return {render(props:StatusBarProps){root.render(<StatusBar {...props}/>);},destroy(){observer.disconnect();host.removeEventListener('wheel',scroll);root.unmount();}};
}
