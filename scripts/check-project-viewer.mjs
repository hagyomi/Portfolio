import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9237', `--user-data-dir=${path.join(os.tmpdir(), 'portfolio-cdp-qa')}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
const sockets = [];
const errors = [];
const results = [];
async function pages() { return (await fetch('http://127.0.0.1:9237/json')).json(); }
async function attach(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  sockets.push(socket);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const job = pending.get(message.id);
    if (job) { pending.delete(message.id); message.error ? job.reject(message.error) : job.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const current = ++id;
    pending.set(current, { resolve, reject });
    socket.send(JSON.stringify({ id: current, method, params }));
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  return { send, evaluate };
}
function assert(condition, message) { if (!condition) throw new Error(message); }
try {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await pages(); break; } catch { await pause(250); } }
  const original = targets.find(p => p.type === 'page');
  const main = await attach(original);
  await main.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await main.send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  await pause(6500);
  const links = await main.evaluate(`[...document.querySelectorAll('[data-project]')].map(a => ({slug:a.dataset.project,target:a.target,rel:a.rel}))`);
  assert(links.length === 3 && links.every(link => link.target === '_blank' && link.rel.includes('noopener')), 'Works must contain three safe new-tab cards');
  const websites = await main.evaluate(`[...document.querySelectorAll('[data-website]')].map(a => ({slug:a.dataset.website,target:a.target,rel:a.rel}))`);
  assert(websites.length === 2 && websites.map(link => link.slug).join(',') === 'tous,kvelo' && websites.every(link => link.target === '_blank'), 'WebSite must contain Tous les Jours and K VELO');
  results.push({ websites });
  results.push({ cards: links });
  await main.evaluate(`window.__cardClickTrace=[];document.addEventListener('click',event=>{const panel=event.target.closest('.container-menu .menu-works-list');window.__cardClickTrace.push({target:event.target.outerHTML.slice(0,180),x:event.clientX,y:event.clientY,panel:!!panel,cards:panel?[...panel.querySelectorAll('[data-project]')].map(a=>({slug:a.dataset.project,rect:a.getBoundingClientRect().toJSON()})):[]});},true)`);
  await mkdir('qa', { recursive: true });
  for (const [slug, closeMethod] of [['kombucha','click'], ['laka','escape'], ['tous','click'], ['kvelo','escape']]) {
    const rect = await main.evaluate(`(() => {const a=document.querySelector('[data-project="${slug}"], [data-website="${slug}"]');const r=a.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+Math.min(r.height/2,100);return {x,y,hit:document.elementFromPoint(x,y)?.closest('[data-project],[data-website]')?.getAttribute('href')};})()`);
    console.log('Click check',slug,JSON.stringify(rect));
    await main.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
    await pause(600);
    // The home panel overlay can receive the pointer; capture delegation must open the matching card.
    const before = new Set((await pages()).map(page => page.id));
    await main.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: rect.x, y: rect.y });
    await main.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: rect.x, y: rect.y });
    let popup;
    for (let i = 0; i < 30; i++) { popup = (await pages()).find(p => p.type === 'page' && !before.has(p.id) && p.url.includes(`/works/${slug}/`)); if (popup) break; await pause(200); }
    if (!popup) console.log('click trace', JSON.stringify(await main.evaluate('window.__cardClickTrace')));
    assert(popup, `New tab did not open for ${slug}; main=${await main.evaluate('location.pathname')}`);
    assert(await main.evaluate('location.pathname') === '/', 'Original tab changed location');
    const tab = await attach(popup);
    await tab.evaluate(`document.querySelector('.viewer-image').decode()`);
    if (closeMethod === 'click') await tab.evaluate(`setTimeout(() => document.querySelector('.viewer-close').click(), 0)`);
    else { await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); }
    await pause(500);
    assert(!(await pages()).some(p => p.id === popup.id), `New tab did not close using ${closeMethod}`);
    results.push({ slug, newTab: true, originalTabPreserved: true, closeMethod, closed: true });
  }
  for (const [slug,width,height] of (process.env.PORTFOLIO_VIEWER_LINKS_ONLY ? [] : [['kombucha',1070,3318],['laka',1200,14048],['kamill',1200,29446],['tous',1920,10268],['kvelo',1920,6035]])) {
    await main.send('Page.navigate', { url: `http://127.0.0.1:4173/works/${slug}/` });
    await pause(600);
    await main.evaluate(`document.querySelector('.viewer-image').decode()`);
    for (const viewport of [{width:1440,height:1000,mobile:false},{width:390,height:844,mobile:true}]) {
      await main.send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1 });
      await main.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
      await pause(100);
      const geometry = await main.evaluate(`(() => {const image=document.querySelector('.viewer-image');const box=image.getBoundingClientRect();const close=document.querySelector('.viewer-close').getBoundingClientRect();return {naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,width:box.width,height:box.height,bottom:box.bottom,closeTop:close.top,closeRight:close.right,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
      assert(geometry.naturalWidth === width && geometry.naturalHeight === height, `Wrong export bounds: ${slug}`);
      assert(!geometry.overflow && Math.abs(geometry.height / geometry.width - height / width) < 0.01, `Image cropped or distorted: ${slug}`);
      assert(geometry.closeTop >= 0 && geometry.closeTop < 30 && geometry.closeRight <= viewport.width, `Close button not fixed: ${slug}`);
      results.push({ slug, viewport: viewport.width, ...geometry });
      if (slug === 'kamill' && viewport.mobile) {
        const shot = await main.send('Page.captureScreenshot', { format: 'png' });
        await writeFile('qa/viewer-mobile-bottom.png', Buffer.from(shot.data,'base64'));
      }
      if (slug === 'tous' && !viewport.mobile) {
        await main.evaluate('window.scrollTo(0,0)');
        await pause(100);
        const shot = await main.send('Page.captureScreenshot', { format: 'png' });
        await writeFile('qa/viewer-desktop-top.png', Buffer.from(shot.data,'base64'));
      }
    }
  }
  assert(errors.length === 0, 'Browser runtime errors');
  await writeFile('qa/viewer-results.json', JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({checks:results.length,errors,interactions:results.filter(result => result.newTab)},null,2));
  await main.send('Browser.close');
} finally {
  sockets.forEach(socket => socket.close());
  browser.kill();
}
