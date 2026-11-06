import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile } from 'node:fs/promises';
import { tools, execute } from './tools.mjs';
import { ensureViewer } from './viewer.mjs';

const server = new McpServer({name:'design-canvas',version:'0.1.0'},{instructions:'Use labeled design boards for project and one-off work. Open/read the workspace before iterating. Labels such as 1a/1b identify alternatives; revisions keep the label and increment version. User requests like “iterate on 1b” target that exact rendering. Read selected version and annotations; never silently replace another variant.'});
const resourceUri='ui://design-canvas/v1.html';
server.registerResource('design-canvas',resourceUri,{},async()=>({contents:[{uri:resourceUri,mimeType:'text/html;profile=mcp-app',text:await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),_meta:{ui:{prefersBorder:false,csp:{connectDomains:[],resourceDomains:[]}}}}]}));
for(const [name,tool] of Object.entries(tools)){
  server.registerTool(name,{
    title:name.replaceAll('_',' '),description:tool.description,inputSchema:tool.schema,
    annotations:{readOnlyHint:!!tool.readOnly,destructiveHint:false,openWorldHint:false},
    ...(tool.ui?{_meta:{ui:{resourceUri},'openai/outputTemplate':resourceUri,'openai/ui':{entrypoints:[{type:'thread'},{type:'global'}]}}}:{}),
  },async args=>{
    try{
      const result=await execute(name,args);
      if(name==='open_workspace'){
        try{const info=await ensureViewer();result.structuredContent={...result.structuredContent,viewerUrl:info.url};result.content.push({type:'text',text:`Browser canvas: ${info.url}`});}catch(error){result.content.push({type:'text',text:`Browser viewer unavailable: ${error.message}`});}
      }
      return result;
    }catch(error){return {isError:true,content:[{type:'text',text:error.message}]};}
  });
}
await server.connect(new StdioServerTransport());
