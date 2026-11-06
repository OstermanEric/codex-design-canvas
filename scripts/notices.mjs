import {readFile, readdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join, basename} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const lock=JSON.parse(await readFile(join(root,'package-lock.json'),'utf8'));
const sections=['# Third-Party Notices\n\nRuntime bundles include software from the production dependency tree below. Original copyright, license, and notice text is reproduced for attribution. These notices apply to the respective third-party components.\n'];
for(const [path,metadata] of Object.entries(lock.packages).sort(([a],[b])=>a.localeCompare(b))){
  if(!path || metadata.dev)continue;
  const directory=join(root,path);
  const pkg=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));
  const files=(await readdir(directory,{withFileTypes:true})).filter(entry=>entry.isFile() && /^(licen[cs]e|copying|notice)([._-].*)?$/i.test(entry.name)).map(entry=>entry.name).sort();
  if(!files.some(name=>/^(licen[cs]e|copying)/i.test(name)))throw new Error(`Missing license text for ${path}`);
  sections.push(`## ${pkg.name} ${pkg.version}\n\nLicense: ${metadata.license||pkg.license||'See below'}.\n`);
  for(const file of files){const content=(await readFile(join(directory,file),'utf8')).replace(/\r\n/g,'\n').split('\n').map(line=>line.trimEnd()).join('\n');sections.push(`### ${basename(file)}\n\n\`\`\`text\n${content.trim()}\n\`\`\`\n`);}
}
await writeFile(join(root,'THIRD_PARTY_NOTICES.md'),sections.join('\n'));
console.log('Updated third-party license and attribution notices');
