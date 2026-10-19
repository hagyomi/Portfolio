import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9237', `--user-data-dir=${path.join(os.tmpdir(), 'portfolio-cdp-qa')}`,
  'about:blank'
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let pages;
  for (let i = 0; i < 40; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9237/json')).json(); break; }
    catch { await pause(250); }
  }
  if (!pages) throw new Error('Browser debug endpoint unavailable');
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const job = pending.get(message.id);
      if (job) { pending.delete(message.id); message.error ? job.reject(message.error) : job.resolve(message.result); }
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const current = ++id;
    pending.set(current, { resolve, reject });
    socket.send(JSON.stringify({ id: current, method, params }));
  });
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
  await send('Runtime.enable');
  await send('Page.enable');
  await mkdir('qa', { recursive: true });
  const results = [];
  for (const route of ['/', '/works/', '/atlason/', '/more/', '/works/kombucha/']) {
    await send('Page.navigate', {url:'http://127.0.0.1:4173'+route});
    await pause(2500);
    for (let i=0;i<2;i++) {
      await send('Page.reload', {ignoreCache:i===1});
      await pause(3000);
      results.push({route,reload:i,state:await evaluate(`({url:location.pathname,ready:document.readyState,classes:document.body.className,menu:document.querySelector('.homepage-menu')?.className,unloaded:document.querySelectorAll('.to-load').length})`)});
    }
  }
  console.log(JSON.stringify({results,errors},null,2));
  await writeFile('qa/refresh-results.json',JSON.stringify({results,errors},null,2));
  await send('Browser.close');

} finally {
  socket?.close();
  browser.kill();
}
