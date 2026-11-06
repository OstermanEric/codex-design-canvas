import { z } from 'zod';
import { createBoard, listBoards, getBoard, summarize, addRendering, reviseRendering, annotate, mutateBoard, findRendering } from './store.mjs';

const workspaceId = z.string().uuid();
const label = z.string().regex(/^[1-9][0-9]*[a-z]+$/);
const text = z.string().trim().min(1).max(10000);
const content = { html: z.string().max(2_000_000).optional(), filePath: z.string().min(1).optional(), imageData: z.string().max(12_000_000).optional() };
const canvas = board => ({ structuredContent: { workspace: summarize(board) }, _meta: { canvas: board }, content: [{ type: 'text', text: `${board.title} (${board.id}): ${board.renderings.map(r => `${r.label} · v${r.revisions.length} — ${r.title}`).join('; ') || 'Empty board'}` }] });
const definitions = {
  list_workspaces: {
    description: 'Find saved project and one-off design boards. Labels are scoped to each workspace.', schema: z.object({}), readOnly: true,
    run: async () => { const workspaces = (await listBoards()).map(({renderings, ...board}) => ({...board, renderingCount: renderings.length})); return { structuredContent: { workspaces }, content: [{type:'text',text:JSON.stringify(workspaces)}] }; }
  },
  create_workspace: {
    description: 'Start a one-off design board or load a local project by absolute folder path. Project import reads a bounded file inventory and README only; never modifies project source.',
    schema: z.object({ title: z.string().trim().min(1).max(160), projectPath: z.string().min(1).optional() }),
    run: async args => canvas(await createBoard(args))
  },
  open_workspace: {
    description: 'Open a saved design canvas. Omit workspaceId to show the workspace picker. Renderings have stable labels like 1a and 1b, with separate revision numbers.',
    schema: z.object({ workspaceId: workspaceId.optional() }), ui: true,
    run: async args => args.workspaceId ? canvas(await getBoard(args.workspaceId)) : definitions.list_workspaces.run()
  },
  get_workspace: {
    description: 'Read a board, its project context, stable rendering labels, revisions, selected rendering and annotations. HTML/image content is provided to UI only.',
    schema: z.object({ workspaceId }), readOnly: true,
    run: async args => canvas(await getBoard(args.workspaceId))
  },
  add_rendering: {
    description: 'Add a labeled design from self-contained HTML, a local HTML/PNG/JPEG/WebP file, or image data. Omit variantOf for the next screen (2a); set variantOf to 1a for another option in that screen (1b). Labels are allocated atomically and never reused.',
    schema: z.object({ workspaceId, title: z.string().trim().min(1).max(160), variantOf: label.optional(), width: z.number().int().min(200).max(1920).optional(), height: z.number().int().min(200).max(2400).optional(), note: text.optional(), ...content }),
    run: async args => { const {board,rendering} = await addRendering(args); return {...canvas(board), structuredContent: {workspace: summarize(board), label: rendering.label, version: 1}}; }
  },
  revise_rendering: {
    description: 'Iterate on a specific rendering without changing its label. Appends a revision; preserves all earlier versions. Read latest version first and supply expectedVersion to prevent overwriting another revision.',
    schema: z.object({ workspaceId, label, expectedVersion: z.number().int().positive(), title: z.string().trim().min(1).max(160).optional(), note: text, ...content }),
    run: async args => { const {board,rendering} = await reviseRendering(args); return {...canvas(board), structuredContent: {workspace: summarize(board), label: rendering.label, version: rendering.revisions.length}}; }
  },
  get_rendering: {
    description: 'Read a specific rendering revision, including source HTML or image data, for targeted iteration. Omit version for latest.',
    schema: z.object({ workspaceId, label, version: z.number().int().positive().optional() }), readOnly: true,
    run: async args => {
      const board = await getBoard(args.workspaceId), rendering = findRendering(board, args.label);
      const revision = rendering.revisions.find(r => r.version === (args.version ?? rendering.revisions.length));
      if (!revision) throw new Error('Unknown revision');
      return { structuredContent: { workspaceId: board.id, label: rendering.label, title: rendering.title, revision }, content: revision.kind === 'image' ? [{type:'text', text:`${rendering.label} v${revision.version}: ${revision.note}`}, {type:'image',mimeType:revision.content.slice(5,revision.content.indexOf(';')),data:revision.content.split(',')[1]}] : [{type:'text',text:JSON.stringify({label:rendering.label,...revision})}] };
    }
  },
  annotate_rendering: {
    description: 'Pin a comment to a specific rendering revision. x/y are normalized positions from 0 to 1. Old comments stay attached to their original revision.',
    schema: z.object({ workspaceId, label, version: z.number().int().positive().optional(), x: z.number().min(0).max(1), y: z.number().min(0).max(1), text }),
    run: async args => canvas(await annotate(args))
  },
  resolve_annotation: {
    description: 'Resolve or reopen an annotation; comments are retained.',
    schema: z.object({ workspaceId, annotationId: z.string().uuid(), resolved: z.boolean() }),
    run: async args => canvas(await mutateBoard(args.workspaceId, board => { const annotation = board.annotations.find(a => a.id === args.annotationId); if (!annotation) throw new Error('Unknown annotation'); annotation.resolved = args.resolved; }))
  },
  select_rendering: {
    description: 'Save the exact rendering and revision selected for the next design iteration. Selection is shared between browser and agent sessions.',
    schema: z.object({ workspaceId, label, version: z.number().int().positive().optional() }),
    run: async args => canvas(await mutateBoard(args.workspaceId, board => { const rendering = findRendering(board,args.label); const version = args.version ?? rendering.revisions.length; if (!rendering.revisions.some(r => r.version === version)) throw new Error('Unknown revision'); board.selection = {label: rendering.label,version}; }))
  },
  update_layout: {
    description: 'Move rendering cards on the canvas. Changes presentation only.',
    schema: z.object({ workspaceId, positions: z.array(z.object({label, x: z.number().min(0).max(20000), y: z.number().min(0).max(20000)})).max(500) }),
    run: async args => canvas(await mutateBoard(args.workspaceId, board => { for (const position of args.positions) Object.assign(findRendering(board, position.label), {x:position.x,y:position.y}); }))
  }
};
export const tools = definitions;
export async function execute(name, input) {
  const tool = tools[name];
  if (!tool) throw new Error(`Unknown canvas tool: ${name}`);
  return tool.run(tool.schema.parse(input));
}
