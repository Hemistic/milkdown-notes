import {imageBlockSchema} from '@milkdown/components/image-block';
import type {Ctx} from '@milkdown/ctx';

// Standard alt text must not become Milkdown's numeric resize ratio. Keep size
// metadata in an optional title suffix; normal Markdown readers still show images.
const suffix=/\s*\{mn-ratio:([\d.]+)\}$/;
export function configureNoteImages(ctx:Ctx){
  ctx.update(imageBlockSchema.key,previous=>context=>{
    const schema=previous(context);
    return {...schema,attrs:{...schema.attrs,alt:{default:'',validate:'string'}},
      parseDOM:[{tag:'img[data-type="image-block"]',getAttrs:dom=>{
        const image=dom as HTMLElement;return{src:image.getAttribute('src')??'',alt:image.getAttribute('alt')??'',caption:image.getAttribute('caption')??'',ratio:Number(image.getAttribute('ratio'))||1};
      }}],
      parseMarkdown:{...schema.parseMarkdown,runner:(state,node,type)=>{
        const title=String(node.title??''),match=suffix.exec(title),value=match?Number(match[1]):1;
        state.addNode(type,{src:node.url,alt:String(node.alt??''),caption:title.replace(suffix,''),ratio:Number.isFinite(value)&&value>0?value:1});
      }},
      toMarkdown:{...schema.toMarkdown,runner:(state,node)=>{
        const ratio=Number(node.attrs.ratio),title=String(node.attrs.caption??'')+(ratio!==1?` {mn-ratio:${ratio.toFixed(2)}}`:'');
        state.openNode('paragraph');state.addNode('image',undefined,undefined,{url:node.attrs.src,alt:node.attrs.alt,title:title||null});state.closeNode();
      }},
    };
  });
}
