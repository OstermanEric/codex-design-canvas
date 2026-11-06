import { execute } from './tools.mjs';
import { ensureViewer } from './viewer.mjs';
try {
  const [name,...rest]=process.argv.slice(2);
  if(name==='viewer')console.log(JSON.stringify(await ensureViewer()));
  else { const result=await execute(name,JSON.parse(rest.join(' ')||'{}')); console.log(JSON.stringify(result.structuredContent)); }
}catch(error){console.error(error.message);process.exitCode=1;}
