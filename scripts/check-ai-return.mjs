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
  for (const slug of ['coffee-ad', 'pawly', 'saekomdalkom']) {
    await send('Page.navigate', {url:'http://127.0.0.1:4173/more/'+slug+'/'});
    await pause(2500);
    await evaluate("document.querySelector('.burger-wrap').click()");
    await pause(3500);
    const state = await evaluate(`({path: location.pathname, links: [...document.querySelectorAll('.container-menu .portfolio-ai-videos > a')].map(a => a.getAttribute('href')), videos: document.querySelectorAll('.container-menu .portfolio-ai-videos video').length})`);
    if (state.path !== '/' || state.links.length !== 3 || state.videos !== 0) throw new Error(JSON.stringify({slug,state}));
    results.push({slug,...state});
  }
  console.log(JSON.stringify({results,errors},null,2));
  if (errors.length) throw new Error('Browser errors detected');
  await send('Browser.close');
} finally { socket?.close(); browser.kill(); }
