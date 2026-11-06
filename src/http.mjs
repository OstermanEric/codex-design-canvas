import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { dataRoot } from './store.mjs';
import { execute } from './tools.mjs';

const token = randomBytes(32).toString('hex');
const html = await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
function authorized(req) {
  const input=Buffer.from(String(req.headers['x-canvas-token']||'')), secret=Buffer.from(token);
  return input.length===secret.length && timingSafeEqual(input,secret);
}
export const server = http.createServer(async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  try {
    const address=server.address(); const origin=`http://127.0.0.1:${address.port}`;
    if (req.headers.host!==`127.0.0.1:${address.port}` || (req.headers.origin && req.headers.origin!==origin)) {res.writeHead(403);res.end('Origin rejected');return;}
    const path = new URL(req.url,origin).pathname;
    if(req.method==='GET' && path==='/') {res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
    if(!authorized(req)){res.writeHead(401);res.end('Open the full canvas link from the plugin, including its access fragment.');return;}
    res.setHeader('Content-Type','application/json');
    if(req.method==='GET' && path==='/api/health'){res.end(JSON.stringify({ok:true,version:'0.1.0'}));return;}
    if(req.method==='POST' && path==='/api/tool'){
      let body='';
      for await(const chunk of req){ body+=chunk; if(Buffer.byteLength(body)>14_000_000){res.writeHead(413);res.end(JSON.stringify({error:'Request too large'}));return;} }
      const {name,args={}}=JSON.parse(body);
      // Local file import is only exposed to the stdio agent/CLI. Browser file
      // inputs send actual selected content, never an arbitrary file path.
      if(args.filePath)throw new Error('Choose a file in the browser to import it');
      const result=await execute(name,args);res.end(JSON.stringify(result));return;
    }
    res.writeHead(404);res.end(JSON.stringify({error:'Not found'}));
  }catch(error){if(!res.headersSent)res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(process.env.CANVAS_PORT||0),'127.0.0.1',resolve);});
await mkdir(dataRoot(),{recursive:true,mode:0o700});
const info={url:`http://127.0.0.1:${server.address().port}/#${token}`,pid:process.pid,version:'0.1.0'};
await writeFile(join(dataRoot(),'viewer.json'),JSON.stringify(info),{mode:0o600});
console.log(`Design Canvas: ${info.url}`);
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.close(()=>process.exit(0)));
