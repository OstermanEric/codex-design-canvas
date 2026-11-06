import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,symlink,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execute} from '../src/tools.mjs';
import {getBoard,letters} from '../src/store.mjs';

const root=await mkdtemp(join(tmpdir(),'canvas-store-'));process.env.CANVAS_DATA_DIR=join(root,'data');
after(()=>rm(root,{recursive:true,force:true}));
const create=async(title='Test')=>(await execute('create_workspace',{title})).structuredContent.workspace;
test('new screens, alternatives and revisions retain unambiguous stable labels',async()=>{
  const workspace=await create();const id=workspace.id;
  const first=await execute('add_rendering',{workspaceId:id,title:'Home A',html:'<h1>A</h1>'});assert.equal(first.structuredContent.label,'1a');
  const alternate=await execute('add_rendering',{workspaceId:id,title:'Home B',variantOf:'1a',html:'<h1>B</h1>'});assert.equal(alternate.structuredContent.label,'1b');
  const next=await execute('add_rendering',{workspaceId:id,title:'Settings',html:'<h1>Settings</h1>'});assert.equal(next.structuredContent.label,'2a');
  await execute('annotate_rendering',{workspaceId:id,label:'1b',version:1,x:.3,y:.2,text:'Breathe'});
  await execute('revise_rendering',{workspaceId:id,label:'1b',expectedVersion:1,note:'More space',html:'<h1 style="padding:40px">B</h1>'});
  const saved=await getBoard(id);assert.deepEqual(saved.renderings.map(r=>r.label),['1a','1b','2a']);assert.equal(saved.renderings[1].revisions.length,2);assert.equal(saved.renderings[1].revisions[0].content,'<h1>B</h1>');assert.equal(saved.annotations[0].version,1);assert.equal(saved.selection.version,2);
  const summary=(await execute('get_workspace',{workspaceId:id})).structuredContent.workspace;assert.equal(summary.renderings[1].revisions[0].content,undefined);
  assert.equal((await execute('get_rendering',{workspaceId:id,label:'1b',version:1})).structuredContent.revision.content,'<h1>B</h1>');
});
test('simultaneous alternatives are allocated without duplicate labels or lost updates',async()=>{
  const {id}=await create();await execute('add_rendering',{workspaceId:id,title:'Base',html:'base'});
  const results=await Promise.all(Array.from({length:30},(_,i)=>execute('add_rendering',{workspaceId:id,title:`Option ${i}`,variantOf:'1a',html:`${i}`})));
  assert.equal(new Set(results.map(r=>r.structuredContent.label)).size,30);const board=await getBoard(id);assert.equal(board.renderings.length,31);assert.equal(board.renderings.at(-1).label,'1ae');assert.equal(letters(26),'aa');
});
test('stale revisions conflict without losing an intervening edit',async()=>{
  const {id}=await create();await execute('add_rendering',{workspaceId:id,title:'Home',html:'v1'});
  const results=await Promise.allSettled(['A','B'].map(html=>execute('revise_rendering',{workspaceId:id,label:'1a',expectedVersion:1,html,note:html})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/Version conflict/);assert.equal((await getBoard(id)).renderings[0].revisions.length,2);
});
test('project import reads a bounded inventory, skips hidden files and symlinks, and never modifies source',async()=>{
  const project=join(root,'project');await mkdir(project);await writeFile(join(project,'README.md'),'Project context');await writeFile(join(project,'App.swift'),'struct App {}');await writeFile(join(project,'.env'),'SECRET');await symlink(join(project,'.env'),join(project,'leaked.md'));
  const board=await create('One-off');assert.equal(board.mode,'one-off');
  const result=await execute('create_workspace',{title:'Project',projectPath:project});const imported=result._meta.canvas;
  assert.equal(imported.mode,'project');assert.equal(imported.project.readme,'Project context');assert.deepEqual(imported.project.files,['App.swift','README.md']);assert.equal(await readFile(join(project,'App.swift'),'utf8'),'struct App {}');
});
test('invalid content, nonexistent revisions, bad positions and traversal IDs are rejected',async()=>{
  const {id}=await create();
  await assert.rejects(execute('add_rendering',{workspaceId:id,title:'Invalid',html:'a',imageData:'data:image/png;base64,YQ=='}),/exactly one/);
  await assert.rejects(execute('get_workspace',{workspaceId:'../../private'}));
  await execute('add_rendering',{workspaceId:id,title:'Home',html:'a'});
  await assert.rejects(execute('select_rendering',{workspaceId:id,label:'1a',version:50}),/Unknown revision/);
  await assert.rejects(execute('annotate_rendering',{workspaceId:id,label:'1a',x:-1,y:0,text:'No'}));
  await assert.rejects(execute('add_rendering',{workspaceId:id,title:'Bad',variantOf:'9z',html:'x'}),/does not exist/);
});
test('data survives another read and annotation resolution preserves history',async()=>{
  const {id}=await create();await execute('add_rendering',{workspaceId:id,title:'Home',html:'a'});
  const annotated=await execute('annotate_rendering',{workspaceId:id,label:'1a',x:.5,y:.5,text:'Note'});const note=annotated._meta.canvas.annotations[0];
  await execute('resolve_annotation',{workspaceId:id,annotationId:note.id,resolved:true});
  const board=await getBoard(id);assert.equal(board.annotations.length,1);assert.equal(board.annotations[0].resolved,true);
});
