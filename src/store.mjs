import { mkdir, readFile, writeFile, rename, readdir, stat, rm, realpath } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

export const dataRoot = () => resolve(process.env.CANVAS_DATA_DIR || join(homedir(), '.local/share/codex-design-canvas'));
const idPattern = /^[a-zA-Z0-9-]{1,80}$/;
const now = () => new Date().toISOString();
export function letters(index) {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(97 + (n - 1) % 26) + result;
  return result;
}
export function boardPath(id) {
  if (!idPattern.test(id)) throw new Error('Invalid workspace ID');
  return join(dataRoot(), 'boards', `${id}.json`);
}
export async function getBoard(id) { return JSON.parse(await readFile(boardPath(id), 'utf8')); }
export async function listBoards() {
  const dir = join(dataRoot(), 'boards');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const boards = await Promise.all((await readdir(dir)).filter(f => f.endsWith('.json')).map(async f => summarize(JSON.parse(await readFile(join(dir, f), 'utf8')))));
  return boards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
async function atomicWrite(path, value) {
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temp, path);
}
// All MCP sessions and the browser share this transaction lock. Never take over
// a lock by age: a busy writer must not be mistaken for a dead writer.
export async function mutateBoard(id, fn) {
  const path = boardPath(id), lock = `${path}.lock`;
  await mkdir(join(dataRoot(), 'boards'), { recursive: true, mode: 0o700 });
  let acquired = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    try { await mkdir(lock); acquired = true; break; }
    catch (e) { if (e.code !== 'EEXIST') throw e; await new Promise(r => setTimeout(r, 25)); }
  }
  if (!acquired) throw new Error('Workspace is busy; retry. If a process crashed, remove its .json.lock directory after stopping canvas processes.');
  try {
    const board = await getBoard(id);
    await fn(board);
    board.updatedAt = now(); board.sequence++;
    await atomicWrite(path, board);
    return board;
  } finally { await rm(lock, { recursive: true, force: true }); }
}
const excluded = new Set(['node_modules', 'build', 'dist', 'Pods', 'DerivedData', 'vendor']);
export async function inspectProject(path) {
  const root = await realpath(resolve(path));
  if (!(await stat(root)).isDirectory()) throw new Error('Project path must be a folder');
  const files = [];
  async function walk(dir, depth = 0) {
    if (depth > 3 || files.length >= 160) return;
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || excluded.has(entry.name) || entry.isSymbolicLink()) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name.endsWith('.xcodeproj')) files.push(full.slice(root.length + 1)); else await walk(full, depth + 1); }
      else if (/\.(swift|tsx?|jsx?|html|css|md)$/.test(entry.name) || entry.name === 'package.json') files.push(full.slice(root.length + 1));
      if (files.length >= 160) break;
    }
  }
  await walk(root);
  let readme = '';
  // Only this specifically named reference is read automatically. Symlinks
  // cannot use a project import to read outside the selected root.
  try {
    const path = join(root, 'README.md');
    if (await realpath(path) === path && (await stat(path)).size < 100_000) readme = (await readFile(path, 'utf8')).slice(0, 8000);
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  return { path: root, name: basename(root), files, readme, importedAt: now(), readOnly: true };
}
export async function createBoard({ title, projectPath }) {
  const project = projectPath ? await inspectProject(projectPath) : null;
  const board = { schemaVersion: 1, id: randomUUID(), title, mode: project ? 'project' : 'one-off', project, createdAt: now(), updatedAt: now(), sequence: 0, nextScreen: 1, renderings: [], annotations: [], selection: null };
  await mkdir(join(dataRoot(), 'boards'), { recursive: true, mode: 0o700 });
  await atomicWrite(boardPath(board.id), board);
  return board;
}
export function findRendering(board, label) {
  const rendering = board.renderings.find(r => r.label === label.toLowerCase());
  if (!rendering) throw new Error(`Rendering ${label} does not exist in ${board.title}`);
  return rendering;
}
export function summarize(board) {
  return { ...board, renderings: board.renderings.map(r => ({ ...r, revisions: r.revisions.map(({content, ...revision}) => revision) })) };
}
export async function payload({ html, filePath, imageData }) {
  if ([html, filePath, imageData].filter(v => v !== undefined).length !== 1) throw new Error('Provide exactly one of html, filePath, or imageData');
  if (html !== undefined) {
    if (Buffer.byteLength(html) > 2_000_000) throw new Error('HTML exceeds 2 MB');
    return { kind: 'html', content: html };
  }
  if (imageData !== undefined) {
    if (!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(imageData) || imageData.length > 12_000_000) throw new Error('Use a PNG/JPEG/WebP data URL under 9 MB');
    return { kind: 'image', content: imageData };
  }
  const path = resolve(filePath), info = await stat(path);
  if (!info.isFile() || info.size > 9_000_000) throw new Error('Import a regular file under 9 MB');
  const extension = path.split('.').pop().toLowerCase();
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }[extension];
  if (mime) return { kind: 'image', content: `data:${mime};base64,${(await readFile(path)).toString('base64')}` };
  if (extension === 'html' || extension === 'htm') return payload({ html: await readFile(path, 'utf8') });
  throw new Error('Supported files: HTML, PNG, JPEG, WebP');
}
export async function addRendering(args) {
  const body = await payload(args);
  let added;
  const board = await mutateBoard(args.workspaceId, board => {
    let screen;
    if (args.variantOf) screen = findRendering(board, args.variantOf).screen;
    else screen = board.nextScreen++;
    const variants = board.renderings.filter(r => r.screen === screen);
    const label = `${screen}${letters(variants.length)}`;
    added = { label, screen, title: args.title, width: args.width ?? 390, height: args.height ?? 844, x: (board.renderings.length % 3) * 470 + 80, y: Math.floor(board.renderings.length / 3) * 1000 + 80, revisions: [{ version: 1, ...body, note: args.note || 'Initial design', createdAt: now() }] };
    board.renderings.push(added);
    board.selection = { label, version: 1 };
  });
  return { board, rendering: added };
}
export async function reviseRendering(args) {
  const body = await payload(args);
  const board = await mutateBoard(args.workspaceId, board => {
    const rendering = findRendering(board, args.label);
    if (rendering.revisions.length !== args.expectedVersion) throw new Error(`Version conflict: ${rendering.label} is v${rendering.revisions.length}; refresh before revising`);
    rendering.revisions.push({ version: rendering.revisions.length + 1, ...body, note: args.note, createdAt: now() });
    if (args.title) rendering.title = args.title;
    board.selection = { label: rendering.label, version: rendering.revisions.length };
  });
  return { board, rendering: findRendering(board, args.label) };
}
export async function annotate(args) {
  return mutateBoard(args.workspaceId, board => {
    const rendering = findRendering(board, args.label);
    const version = args.version ?? rendering.revisions.length;
    if (!rendering.revisions.some(r => r.version === version)) throw new Error('Unknown revision');
    board.annotations.push({ id: randomUUID(), label: rendering.label, version, x: args.x, y: args.y, text: args.text, resolved: false, createdAt: now() });
  });
}
