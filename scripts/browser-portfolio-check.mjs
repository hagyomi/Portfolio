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
  const targeted = process.env.PORTFOLIO_QA_TARGETED === '1';
  for (const scenario of [
    { name: 'home-desktop', route: '/', width: 1440, height: 1000 },
    { name: 'works-desktop', route: '/works/', width: 1440, height: 1000 },
    { name: 'home-mobile', route: '/', width: 390, height: 844 },
    { name: 'project-mobile', route: '/works/kombucha/', width: 390, height: 844 },
    { name: 'about-desktop', route: '/more/', width: 1440, height: 1000 },
    { name: 'profile-mobile', route: '/atlason/', width: 390, height: 844 }
  ].filter(scenario => !targeted || ['home-desktop','works-desktop','home-mobile','profile-mobile'].includes(scenario.name)).filter(scenario => !process.env.PORTFOLIO_QA_SCREEN || scenario.name === process.env.PORTFOLIO_QA_SCREEN)) {
    await send('Emulation.setDeviceMetricsOverride', { width: scenario.width, height: scenario.height, deviceScaleFactor: 1, mobile: scenario.width < 768 });
    await send('Page.navigate', { url: 'http://127.0.0.1:4173' + scenario.route });
    await pause(6500);
    if (scenario.name === 'project-mobile') {
      await evaluate(`document.querySelectorAll('img[loading="lazy"]').forEach(image => image.loading = 'eager')`);
      await pause(1500);
    }
    const state = await evaluate(`JSON.stringify({title:document.title,menuLoaded:!!document.querySelector('.menu-loaded,.all-loaded'),bodyClasses:document.body.className,overflow:document.documentElement.scrollWidth>innerWidth,images:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src),cards:document.querySelectorAll('.grid-item').length,token:getComputedStyle(document.documentElement).getPropertyValue('--pf-page-gutter')})`);
    if (targeted) results.push({ geometry: scenario.name, headers: await evaluate(`[...document.querySelectorAll('.main-header')].map(el => ({text:el.textContent.trim(),transform:getComputedStyle(el).transform,fontSize:getComputedStyle(el).fontSize,rect:el.getBoundingClientRect().toJSON()}))`) });
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`qa/${scenario.name}.png`, Buffer.from(screenshot.data, 'base64'));
    results.push({ ...scenario, ...JSON.parse(state) });
  }
  if (targeted) {
    await writeFile('qa/targeted-results.json', JSON.stringify({ results, errors }, null, 2));
    console.log(JSON.stringify({ results, errors }, null, 2));
    await send('Browser.close');
    process.exitCode = errors.length ? 1 : 0;
  } else {
  // Exercise the actual GSAP/Barba click path, then browser history restoration.
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  await pause(5500);
  await evaluate(`document.querySelector('.the-menu-link[data-page="works-list"]').click()`);
  await pause(2500);
  results.push({ interaction: 'menu to works', url: await evaluate('location.pathname'), busy: await evaluate('document.body.classList.contains("is-busy")') });
  await evaluate('history.back()');
  await pause(2500);
  results.push({ interaction: 'history back', url: await evaluate('location.pathname') });
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/works/' });
  await pause(2000);
  await evaluate('window.scrollTo(0, document.body.scrollHeight)');
  await pause(3000);
  results.push({ interaction: 'five Figma projects', cards: await evaluate('document.querySelectorAll(".grid-item").length') });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  await pause(3500);
  await evaluate(`document.querySelector('.the-menu-link[data-page="works-list"]').click()`);
  await pause(2000);
  results.push({ interaction: 'reduced motion navigation', url: await evaluate('location.pathname'), duration: await evaluate('getComputedStyle(document.documentElement).getPropertyValue("--pf-duration-page")') });
  for (const slug of ['kombucha','laka','kamill','tous','kvelo']) {
    await send('Page.navigate', { url: 'http://127.0.0.1:4173/works/' + slug + '/' });
    await pause(1000);
    await evaluate(`document.querySelectorAll('img').forEach(image => image.loading = 'eager')`);
    await pause(800);
    results.push({ project: slug, loaded: await evaluate(`[...document.images].every(image => image.complete && image.naturalWidth > 0)`), overflow: await evaluate('document.documentElement.scrollWidth > innerWidth') });
  }
  await writeFile('qa/browser-results.json', JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ results, errors }, null, 2));
  await send('Browser.close');
  }
} finally {
  socket?.close();
  browser.kill();
}
