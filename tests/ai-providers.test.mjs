import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpenAIProvider} from '@milkdown/crepe/llm-providers/openai';
import {createAnthropicProvider} from '@milkdown/crepe/llm-providers/anthropic';

const context={document:'完整文档',selection:'选中内容',instruction:'精简'};
const collect=async(iterator)=>{let text='';for await(const chunk of iterator)text+=chunk;return text;};
for(const [name,factory,event,stop,path] of [
  ['OpenAI',createOpenAIProvider,text=>({choices:[{delta:{content:text}}]}),'data: [DONE]\n\n','/v1/chat/completions'],
  ['Anthropic',createAnthropicProvider,text=>({type:'content_block_delta',delta:{type:'text_delta',text}}),'data: {"type":"message_stop"}\n\n','/v1/messages'],
]){
  test(`${name}: fragmented UTF-8 SSE, context and cancellation signal`,async t=>{
    const controller=new AbortController();let request;
    const stream=': heartbeat\r\n\r\ndata: broken-json\n\n'+['中文',' **加粗**'].map(text=>'data: '+JSON.stringify(event(text))+'\r\n\r\n').join('')+stop;
    const bytes=new TextEncoder().encode(stream);
    t.mock.method(globalThis,'fetch',async(url,init)=>{request={url,init};return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=2)c.enqueue(bytes.slice(i,i+2));c.close();}}),{headers:{'content-type':'text/event-stream'}});});
    const output=await collect(factory({model:'test-only',baseURL:'https://local-fixture.invalid'})(context,controller.signal));
    assert.equal(output,'中文 **加粗**');assert.equal(request.url,'https://local-fixture.invalid'+path);assert.equal(request.init.signal,controller.signal);
    const body=JSON.parse(request.init.body);assert.equal(body.stream,true);for(const value of Object.values(context))assert.ok(body.messages.at(-1).content.includes(value));
  });
  test(`${name}: HTTP failure and aborted request propagate`,async t=>{
    t.mock.method(globalThis,'fetch',async()=>new Response('fixture unavailable',{status:503}));
    const p=factory({model:'test-only',baseURL:'https://local-fixture.invalid'});
    await assert.rejects(()=>collect(p(context,new AbortController().signal)),/503|unavailable/);
    globalThis.fetch=async(_url,{signal})=>{signal.throwIfAborted();throw Error('unexpected request');};
    const controller=new AbortController();controller.abort();await assert.rejects(()=>collect(p(context,controller.signal)),{name:'AbortError'});
  });
}
