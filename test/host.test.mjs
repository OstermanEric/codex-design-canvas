import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {join} from 'node:path';

test('Codex host discovers the portable plugin skill and canvas MCP server', {skip:!process.env.CANVAS_TEST_HOST}, async()=>{
  const root=process.env.CANVAS_TEST_SOURCE_ROOT||new URL('../',import.meta.url).pathname;
  const child=spawn('codex',['app-server','--stdio'],{cwd:root,stdio:['pipe','pipe','pipe']});
  const pending=new Map();let sequence=0,diagnostics='';
  const lines=createInterface({input:child.stdout});
  child.stderr.on('data',chunk=>{diagnostics+=chunk;});
  lines.on('line',line=>{const response=JSON.parse(line);if(pending.has(response.id)){const {resolve,reject,timer}=pending.get(response.id);clearTimeout(timer);pending.delete(response.id);response.error?reject(new Error(response.error.message)):resolve(response.result);}});
  const request=(method,params)=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Host timed out: ${method}`));},15000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,method,params})+'\n');});
  try{
    await request('initialize',{clientInfo:{name:'design_canvas_validation',version:'0.1.0'},capabilities:{experimentalApi:true}});
    child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
    const {plugin}=await request('plugin/read',{marketplacePath:join(root,'.agents/plugins/marketplace.json'),pluginName:'design-canvas'});
    assert.ok(plugin.mcpServers.includes('canvas'),`Canvas server missing from host discovery. ${diagnostics.split('\n').filter(l=>l.includes('failed to parse plugin MCP server')).join('\n')}`);
    assert.ok(plugin.skills.some(s=>s.name==='design-canvas:design-canvas'));
  }finally{
    for(const {timer} of pending.values())clearTimeout(timer);
    lines.close();child.kill();
  }
});
