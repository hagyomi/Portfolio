import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9241', `--user-data-dir=${path.join(os.tmpdir(), 'portfolio-video-preview')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let tabs;
  for (let i = 0; i < 50; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:9241/json')).json(); break; } catch { await new Promise(r => setTimeout(r, 200)); }
  }
  socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => socket.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => { const m = JSON.parse(data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise(resolve => { const n = ++id; pending.set(n, resolve); socket.send(JSON.stringify({ id: n, method, params })); });
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/more/#saekomdalkom' });
  await new Promise(r => setTimeout(r, 1500));
  const result = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const video = document.querySelector('#saekomdalkom video');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Video load timeout')), 45000);
      video.addEventListener('seeked', () => { clearTimeout(timeout); resolve(); }, {once:true});
      const seek = () => { video.currentTime = Math.min(2, video.duration / 2); };
      video.addEventListener('loadedmetadata', seek, {once:true});
      video.load();
    });
    const canvas = document.createElement('canvas');
    canvas.width = 960; canvas.height = Math.round(960 * video.videoHeight / video.videoWidth);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight, controls: video.controls, poster: canvas.toDataURL('image/png') };
  })()` });
  if (result.result.exceptionDetails) throw new Error(JSON.stringify(result.result.exceptionDetails));
  const { poster, ...metadata } = result.result.result.value;
  await writeFile(new URL('../assets/portfolio/video/saekomdalkom.png', import.meta.url), Buffer.from(poster.split(',')[1], 'base64'));
  console.log(JSON.stringify(metadata));
} finally { socket?.close(); browser.kill(); }
