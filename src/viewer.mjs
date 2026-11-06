import { readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dataRoot } from './store.mjs';

export async function viewerInfo() {
  try {
    const info = JSON.parse(await readFile(join(dataRoot(),'viewer.json'),'utf8'));
    const url = new URL(info.url);
    if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:') return null;
    const response = await fetch(`${url.origin}/api/health`, {headers:{'x-canvas-token':url.hash.slice(1)},signal:AbortSignal.timeout(1000)});
    return response.ok ? info : null;
  } catch { return null; }
}
export async function ensureViewer() {
  const existing = await viewerInfo();
  if (existing) return existing;
  await mkdir(dataRoot(),{recursive:true,mode:0o700});
  const lock = join(dataRoot(),'viewer-start.lock');
  try { await mkdir(lock); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    for (let n=0;n<70;n++) { await new Promise(r=>setTimeout(r,100)); const info=await viewerInfo(); if(info)return info; }
    throw new Error('Viewer startup is busy. Stop canvas processes and remove viewer-start.lock if a previous launch crashed.');
  }
  try {
    const existing = await viewerInfo(); if(existing)return existing;
    const child=spawn(process.execPath,[fileURLToPath(new URL('./http.mjs',import.meta.url))],{detached:true,stdio:'ignore',env:process.env});
    child.on('error',()=>{}); child.unref();
    for(let n=0;n<70;n++){ await new Promise(r=>setTimeout(r,100)); const info=await viewerInfo(); if(info)return info; }
    throw new Error('Canvas viewer failed to start; run npm start in the plugin source for diagnostics.');
  } finally { await rm(lock,{recursive:true,force:true}); }
}
