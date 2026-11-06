import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

test('bundled stdio plugin advertises UI and supports the complete local design workflow',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'canvas-mcp-'));
  const installed=process.env.CANVAS_TEST_PLUGIN_ROOT;
  const transport=new StdioClientTransport({command:installed?'/bin/sh':process.execPath,args:[installed?join(installed,'scripts/launch.sh'):new URL('../dist/mcp.mjs',import.meta.url).pathname],env:{...process.env,...(installed?{PATH:'/usr/bin:/bin:/usr/sbin:/sbin'}:{}),CANVAS_DATA_DIR:dir},stderr:'pipe'});
  const client=new Client({name:'canvas-test',version:'1.0.0'});
  let viewer;
  try{
    await client.connect(transport);
    const advertised=await client.listTools();assert.equal(advertised.tools.length,11);const open=advertised.tools.find(t=>t.name==='open_workspace');assert.equal(open._meta.ui.resourceUri,'ui://design-canvas/v1.html');assert.equal(open._meta['openai/ui'].entrypoints[0].type,'thread');
    const resource=await client.readResource({uri:'ui://design-canvas/v1.html'});assert.match(resource.contents[0].text,/<title>Design Canvas/);
    const created=await client.callTool({name:'create_workspace',arguments:{title:'MCP one-off'}});assert.ok(!created.isError);const id=created.structuredContent.workspace.id;
    const added=await client.callTool({name:'add_rendering',arguments:{workspaceId:id,title:'Home',html:'<h1>Hello</h1>'}});assert.equal(added.structuredContent.label,'1a');
    const opened=await client.callTool({name:'open_workspace',arguments:{workspaceId:id}});assert.ok(!opened.isError);viewer=JSON.parse(await readFile(join(dir,'viewer.json'),'utf8'));const url=new URL(viewer.url);
    const page=await fetch(url.origin);assert.equal(page.status,200);assert.match(await page.text(),/Design Canvas/);
    const denied=await fetch(`${url.origin}/api/tool`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'list_workspaces'})});assert.equal(denied.status,401);
    const forbidden=await fetch(`${url.origin}/api/tool`,{method:'POST',headers:{'content-type':'application/json','x-canvas-token':url.hash.slice(1),origin:'https://evil.example'},body:'{}'});assert.equal(forbidden.status,403);
    const allowed=await fetch(`${url.origin}/api/tool`,{method:'POST',headers:{'content-type':'application/json','x-canvas-token':url.hash.slice(1)},body:JSON.stringify({name:'get_workspace',args:{workspaceId:id}})});assert.equal(allowed.status,200);assert.equal((await allowed.json())._meta.canvas.renderings[0].label,'1a');
    const invalid=await client.callTool({name:'revise_rendering',arguments:{workspaceId:id,label:'1a',expectedVersion:9,html:'oops',note:'stale'}});assert.equal(invalid.isError,true);
  }finally{
    await client.close();if(viewer)try{process.kill(viewer.pid);}catch{}
    await rm(dir,{recursive:true,force:true});
  }
});
