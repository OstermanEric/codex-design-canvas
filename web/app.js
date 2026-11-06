import { App } from '@modelcontextprotocol/ext-apps';

const $ = selector => document.querySelector(selector);
const el = (tag, cls, text) => {const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
let board=null, workspaces=[], zoom=.65, selected=null, pinning=false, pendingPin=null, compareMode=false, busy=false, bridge=null;
const compared=new Set(), versions=new Map();
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
function fail(error){toast(error.message||String(error));console.error(error);}
const embedded=window.parent!==window;
const token=location.hash.slice(1)||sessionStorage.getItem('canvas-token')||'';
if(!embedded && token){sessionStorage.setItem('canvas-token',token);history.replaceState(null,'',location.pathname);}

async function call(name,args={}){
  let result;
  if(bridge)result=await bridge.callServerTool({name,arguments:args});
  else{
    const response=await fetch('/api/tool',{method:'POST',headers:{'content-type':'application/json','x-canvas-token':token},body:JSON.stringify({name,args})});
    result=await response.json();if(!response.ok)throw new Error(result.error||'Canvas request failed');
  }
  if(result.isError)throw new Error(result.content?.find(c=>c.type==='text')?.text||'Canvas tool failed');
  return result;
}
function apply(result,{force=false}={}){
  if(result.structuredContent?.workspaces){workspaces=result.structuredContent.workspaces;renderWorkspaces();}
  if(result._meta?.canvas){
    const next=result._meta.canvas;
    if(!force && board?.id===next.id && board.sequence===next.sequence)return;
    if(board?.id!==next.id){selected=null;versions.clear();compared.clear();compareMode=false;$('#show-all').hidden=true;}
    board=next;selected=board.selection?.label||selected;
    if(board.selection)versions.set(board.selection.label,board.selection.version);
    render();renderWorkspaces();
    $('#save-status').textContent=`Saved locally · ${new Date(board.updatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
  }
}
async function refreshList(){apply(await call('list_workspaces'));}
async function openBoard(id){
  const switching=board?.id!==id;
  apply(await call('get_workspace',{workspaceId:id}),{force:true});
  if(!embedded)localStorage.setItem('canvas-board',id);
  if(switching)fit();
}
function renderWorkspaces(){
  const nav=$('#workspaces');nav.replaceChildren();
  for(const workspace of workspaces){
    const button=el('button',`workspace-link${workspace.id===board?.id?' active':''}`);button.dataset.workspace=workspace.id;button.setAttribute('aria-label',workspace.title);button.title=workspace.title;
    button.append(el('span','workspace-icon',workspace.mode==='project'?'▦':'◇'));
    const copy=el('span');copy.append(el('span','workspace-name',workspace.title),el('small',null,workspace.mode==='project'?'Project workspace':'One-off exploration'));button.append(copy);
    button.onclick=()=>openBoard(workspace.id).catch(fail);nav.append(button);
  }
}
function currentVersion(rendering){return versions.get(rendering.label)||rendering.revisions.length;}
function currentRevision(rendering){return rendering.revisions.find(r=>r.version===currentVersion(rendering))||rendering.revisions.at(-1);}
function renderingAnnotations(rendering){return board.annotations.filter(a=>a.label===rendering.label && a.version===currentVersion(rendering));}
function render(){
  $('#board-title').textContent=board.title;$('#board-mode').textContent=board.mode==='project'?'PROJECT WORKSPACE':'ONE-OFF EXPLORATION';
  $('#project-info').hidden=!board.project;$('#add-rendering').disabled=false;
  $('#rendering-count').textContent=`${board.renderings.length} rendering${board.renderings.length===1?'':'s'}`;
  $('#empty-state').hidden=!!board.renderings.length;
  if(!board.renderings.length){$('#empty-state h2').textContent='A blank canvas. A clear starting point.';$('#empty-state p').textContent='Ask Codex to add your first design, or import a rendering.\nYour first direction will be labeled 1a.';$('#empty-new').textContent='＋ Add a rendering';}
  const world=$('#world');world.replaceChildren();
  let right=700,bottom=900;
  for(const rendering of board.renderings){
    if(compareMode&&!compared.has(rendering.label))continue;
    const card=el('article',`rendering-card${selected===rendering.label?' selected':''}`);card.dataset.label=rendering.label;card.setAttribute('aria-label',`${rendering.label} ${rendering.title}`);
    card.style.left=`${rendering.x}px`;card.style.top=`${rendering.y}px`;card.style.width=`${rendering.width}px`;
    const header=el('div','rendering-header');header.append(el('span','label-badge',rendering.label),el('span','rendering-name',rendering.title),el('span','version-badge',`v${currentVersion(rendering)}`));
    const checkbox=el('input','compare-box');checkbox.type='checkbox';checkbox.checked=compared.has(rendering.label);checkbox.setAttribute('aria-label',`Compare ${rendering.label}`);checkbox.onchange=()=>{checkbox.checked?compared.add(rendering.label):compared.delete(rendering.label);};header.append(checkbox);
    header.onpointerdown=event=>dragCard(event,card,rendering);
    const frame=el('div','preview-frame');frame.style.height=`${rendering.height}px`;
    const revision=currentRevision(rendering);
    if(revision.kind==='image'){const image=el('img');image.src=revision.content;image.alt=`${rendering.label}: ${rendering.title}`;frame.append(image);}
    else{
      const iframe=el('iframe');iframe.title=`${rendering.label} v${revision.version} — ${rendering.title}`;iframe.setAttribute('sandbox','');iframe.setAttribute('referrerpolicy','no-referrer');
      // Sandboxed opaque origin, no network/storage/forms/top navigation. All
      // design assets must be embedded; preview code never runs in the board.
      iframe.srcdoc=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">${revision.content}`;frame.append(iframe);
    }
    const overlay=el('div',`preview-overlay${pinning&&selected===rendering.label?' pinning':''}`);overlay.tabIndex=0;overlay.setAttribute('role','button');overlay.setAttribute('aria-label',`Select ${rendering.label}`);
    overlay.onclick=event=>{
      if(pinning&&selected===rendering.label){const rect=overlay.getBoundingClientRect();beginPin(rendering,(event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height);}
      else select(rendering).catch(fail);
    };
    overlay.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(rendering).catch(fail);}};
    const annotations=renderingAnnotations(rendering);
    annotations.forEach((annotation,index)=>{const pin=el('span',`pin${annotation.resolved?' resolved':''}`,String(index+1));pin.style.left=`${annotation.x*100}%`;pin.style.top=`${annotation.y*100}%`;pin.title=annotation.text;overlay.append(pin);});
    frame.append(overlay);const caption=el('div','rendering-caption');caption.append(el('span',null,revision.note),el('span','note-count',annotations.length?`${annotations.length} note${annotations.length===1?'':'s'}`:'No notes yet'));
    card.append(header,frame,caption);world.append(card);right=Math.max(right,rendering.x+rendering.width+100);bottom=Math.max(bottom,rendering.y+rendering.height+150);
  }
  world.style.width=`${right}px`;world.style.height=`${bottom}px`;world.dataset.width=right;world.dataset.height=bottom;applyZoom();renderInspector();
}
function applyZoom(){const world=$('#world');world.style.transform=`scale(${zoom})`;$('#world-shell').style.width=`${Number(world.dataset.width||900)*zoom}px`;$('#world-shell').style.height=`${Number(world.dataset.height||1000)*zoom}px`;$('#zoom-level').textContent=`${Math.round(zoom*100)}%`;}
function fit(){if(!board?.renderings.length)return;zoom=Math.max(.2,Math.min(1,($('#viewport').clientWidth-35)/Number($('#world').dataset.width||900)));applyZoom();$('#viewport').scrollTo(0,0);}
async function select(rendering,version=currentVersion(rendering)){
  selected=rendering.label;versions.set(rendering.label,version);pinning=false;
  apply(await call('select_rendering',{workspaceId:board.id,label:rendering.label,version}),{force:true});
  if(bridge)await bridge.updateModelContext({content:[{type:'text',text:selectionPrompt()}]});
}
function selectionPrompt(){
  const rendering=board.renderings.find(r=>r.label===selected);if(!rendering)return '';
  const revision=currentRevision(rendering);
  const notes=renderingAnnotations(rendering).filter(a=>!a.resolved).map((a,i)=>`${i+1}. ${a.text}`).join('\n');
  return `Design Canvas workspace: ${board.title}\nworkspaceId: ${board.id}\nSelected rendering: ${rendering.label} · v${revision.version} — ${rendering.title}\nRevision note: ${revision.note}${notes?`\nOpen annotations:\n${notes}`:''}\nIterate on ${rendering.label} using revise_rendering with expectedVersion ${rendering.revisions.length}; preserve other variations. If I request a new alternative, use add_rendering with variantOf "${rendering.label}".`;
}
function renderInspector(){
  const inspector=$('#inspector'),rendering=board.renderings.find(r=>r.label===selected);
  if(!rendering){inspector.innerHTML='<div class="inspector-empty"><span>↖</span><h3>Pick a direction.</h3><p>Select a rendering to see its revisions, leave a note, or continue in Codex.</p></div>';return;}
  inspector.replaceChildren(el('div','inspector-label','SELECTED RENDERING'));
  const heading=el('div','inspector-heading');heading.append(el('span','label-badge',rendering.label),el('h3',null,rendering.title));inspector.append(heading);
  const dropdown=el('select','inspector-version');dropdown.setAttribute('aria-label',`Revision for ${rendering.label}`);
  for(const revision of [...rendering.revisions].reverse()){const option=el('option',null,`Version ${revision.version}${revision.version===rendering.revisions.length?' · Latest':''}`);option.value=revision.version;dropdown.append(option);}dropdown.value=currentVersion(rendering);dropdown.onchange=()=>select(rendering,Number(dropdown.value)).catch(fail);inspector.append(dropdown,el('p','revision-note',currentRevision(rendering).note));
  const actions=el('div','inspector-actions');
  const pinButton=el('button',null,pinning?'Cancel pin':'⊕ Pin an annotation');pinButton.onclick=()=>{pinning=!pinning;render();};actions.append(pinButton);
  const copyButton=el('button','primary',bridge?'Continue in Codex ↗':'Copy context for Codex ↗');copyButton.onclick=async()=>{
    try{
      const prompt=selectionPrompt();
      if(bridge){const result=await bridge.sendMessage({role:'user',content:[{type:'text',text:prompt}]});if(result.isError)throw new Error('Host could not send context');toast('Selection sent to Codex');}
      else{await navigator.clipboard.writeText(prompt);toast('Copied. Paste into your Codex chat and describe the change.');}
    }catch(error){fail(error);}
  };actions.append(copyButton);
  const duplicate=el('button','quiet','＋ Create another variation');duplicate.onclick=async()=>{try{const revision=currentRevision(rendering);apply(await call('add_rendering',{workspaceId:board.id,title:rendering.title,variantOf:rendering.label,width:rendering.width,height:rendering.height,note:`Copied from ${rendering.label} v${revision.version}; ready to explore`,...(revision.kind==='html'?{html:revision.content}:{imageData:revision.content})}));await refreshList();toast('Variation added. Ask Codex to take it in a new direction.');}catch(error){fail(error);}};actions.append(duplicate);inspector.append(actions);
  if(pinning)inspector.append(el('p','pin-instruction','Click a point on the selected design to attach your note. Keyboard alternative: add a centered note below.'));
  const notesTitle=el('div','notes-heading');notesTitle.append(el('span',null,`ANNOTATIONS · V${currentVersion(rendering)}`));const addNote=el('button','quiet','＋');addNote.setAttribute('aria-label','Add a centered annotation');addNote.onclick=()=>beginPin(rendering,.5,.5);notesTitle.append(addNote);inspector.append(notesTitle);
  const annotations=renderingAnnotations(rendering);
  if(!annotations.length)inspector.append(el('p','no-notes','A little context goes a long way. Pin a note to explain what you want to explore.'));
  annotations.forEach((annotation,index)=>{
    const note=el('div',`note${annotation.resolved?' resolved':''}`);const top=el('div','note-top');top.append(el('span','note-number',`NOTE ${index+1}`));const resolve=el('button',null,annotation.resolved?'Reopen':'Resolve');resolve.onclick=async()=>{try{apply(await call('resolve_annotation',{workspaceId:board.id,annotationId:annotation.id,resolved:!annotation.resolved}));}catch(error){fail(error);}};top.append(resolve);note.append(top,el('p',null,annotation.text));inspector.append(note);
  });
}
function beginPin(rendering,x,y){pendingPin={label:rendering.label,version:currentVersion(rendering),x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))};$('#annotation-target').textContent=`ANNOTATION · ${rendering.label.toUpperCase()} · V${currentVersion(rendering)}`;$('#annotation-form').reset();$('#annotation-dialog').showModal();}
function dragCard(event,card,rendering){
  if(event.target.closest('input,button'))return;
  const startX=event.clientX,startY=event.clientY,oldX=rendering.x,oldY=rendering.y;let moved=false;
  const header=event.currentTarget;header.setPointerCapture(event.pointerId);busy=true;
  header.onpointermove=event=>{const dx=(event.clientX-startX)/zoom,dy=(event.clientY-startY)/zoom;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;if(moved){rendering.x=Math.min(20000,Math.max(0,oldX+dx));rendering.y=Math.min(20000,Math.max(0,oldY+dy));card.style.left=`${rendering.x}px`;card.style.top=`${rendering.y}px`;}};
  header.onpointerup=async()=>{header.onpointermove=null;header.onpointerup=null;try{if(moved)apply(await call('update_layout',{workspaceId:board.id,positions:[{label:rendering.label,x:rendering.x,y:rendering.y}]}));else await select(rendering);}catch(error){fail(error);}finally{busy=false;}};
  header.onpointercancel=()=>{header.onpointermove=null;busy=false;render();};
}
function newWorkspace(){ $('#workspace-form').reset();$('#project-path-field').hidden=true;$('#workspace-dialog').showModal(); }
function addRendering(){if(!board)return newWorkspace();$('#render-form').reset();const dropdown=$('#variant-of');dropdown.replaceChildren(new Option('New screen (next number)',''));const seen=new Set();for(const rendering of board.renderings){if(!seen.has(rendering.screen)){seen.add(rendering.screen);dropdown.append(new Option(`Another variation of screen ${rendering.screen}`,rendering.label));}}$('#render-dialog').showModal();}
$('#new-workspace').onclick=newWorkspace;$('.brand').onclick=event=>{event.preventDefault();newWorkspace();};$('#empty-new').onclick=()=>board?addRendering():newWorkspace();$('#add-rendering').onclick=addRendering;
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$('#workspace-form').addEventListener('change',()=>{$('#project-path-field').hidden=$('#workspace-form').elements.mode.value!=='project';});
$('#workspace-form').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,data=new FormData(form);const button=form.querySelector('[type=submit]');button.disabled=true;
  try{const projectPath=String(data.get('projectPath')).trim();if(data.get('mode')==='project'&&!projectPath)throw new Error('Enter an absolute project folder path');const result=await call('create_workspace',{title:String(data.get('title')), ...(data.get('mode')==='project'?{projectPath}:{})});apply(result,{force:true});await refreshList();$('#workspace-dialog').close();if(!embedded)localStorage.setItem('canvas-board',board.id);}catch(error){fail(error);}finally{button.disabled=false;}
};
$('#render-form').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,data=new FormData(form),file=data.get('file');const button=form.querySelector('[type=submit]');button.disabled=true;
  try{if(file.size>9_000_000)throw new Error('Choose a file under 9 MB');let content;if(/\.html?$/i.test(file.name))content={html:await file.text()};else content={imageData:await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);})};apply(await call('add_rendering',{workspaceId:board.id,title:String(data.get('title')),width:Number(data.get('width')),height:Number(data.get('height')),...(data.get('variantOf')?{variantOf:String(data.get('variantOf'))}:{}),...content}));await refreshList();$('#render-dialog').close();fit();}catch(error){fail(error);}finally{button.disabled=false;}
};
$('#annotation-form').onsubmit=async event=>{event.preventDefault();try{apply(await call('annotate_rendering',{workspaceId:board.id,...pendingPin,text:new FormData(event.currentTarget).get('text')}));pinning=false;$('#annotation-dialog').close();render();}catch(error){fail(error);}};
$('#project-info').onclick=()=>{$('#context-title').textContent=board.project.name;$('#context-path').textContent=board.project.path;$('#context-content').textContent=`${board.project.files.join('\n')}\n\n${board.project.readme}`;$('#context-dialog').showModal();};
$('#compare').onclick=()=>{if(compared.size<2)return toast('Check the boxes above at least two renderings to compare them.');compareMode=true;$('#show-all').hidden=false;render();fit();};
$('#show-all').onclick=()=>{compareMode=false;$('#show-all').hidden=true;render();fit();};
$('#zoom-in').onclick=()=>{zoom=Math.min(1.5,zoom+.1);applyZoom();};$('#zoom-out').onclick=()=>{zoom=Math.max(.2,zoom-.1);applyZoom();};$('#fit').onclick=fit;

async function initialize(){
  if(embedded){
    const app=new App({name:'Design Canvas',version:'0.1.0'},{});
    app.ontoolresult=result=>{apply(result);if(result.structuredContent?.workspace?.id && !result._meta?.canvas)openBoard(result.structuredContent.workspace.id).catch(fail);};
    app.ontoolinput=()=>{};
    bridge=app;await app.connect();$('#connection').textContent='Connected to Codex';
  }else $('#connection').textContent='Browser companion · Live sync';
  await refreshList();
  if(!board){const saved=embedded?null:localStorage.getItem('canvas-board');const target=workspaces.find(w=>w.id===saved)||workspaces[0];if(target)await openBoard(target.id);}
  setInterval(async()=>{if(busy||document.querySelector('dialog[open]')||document.hidden)return;try{await refreshList();if(board)apply(await call('get_workspace',{workspaceId:board.id}));}catch(error){$('#connection').textContent='Connection lost — reconnecting…';}},2500);
}
initialize().catch(error=>{$('#connection').textContent='Unable to connect';fail(error);});
