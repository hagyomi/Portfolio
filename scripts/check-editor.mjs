import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const install = path.join(process.env.LOCALAPPDATA, 'Programs/Microsoft VS Code');
const version = (await readdir(install, { withFileTypes: true })).find(item => /^[a-f0-9]{10}$/.test(item.name))?.name;
if (!version) throw new Error('VS Code language server not found');
const entry = path.join(install, version, 'resources/app/extensions/html-language-features/server/dist/node/htmlServerMain.js');
const child = spawn(process.execPath, [entry, '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
let buffer = Buffer.alloc(0);
const results = [];
function send(message) {
  const body = JSON.stringify({ jsonrpc: '2.0', ...message });
  child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}
child.stdout.on('data', chunk => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const boundary = buffer.indexOf('\r\n\r\n');
    if (boundary < 0) break;
    const length = Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0, boundary).toString())[1]);
    if (buffer.length < boundary + 4 + length) break;
    const message = JSON.parse(buffer.subarray(boundary + 4, boundary + 4 + length));
    buffer = buffer.subarray(boundary + 4 + length);
    if (message.id === 1 && message.result) open();
    if (message.method === 'textDocument/publishDiagnostics') results.push(message.params);
    if (message.method && message.id) send({ id: message.id, result: null });
  }
});
async function open() {
  send({ method: 'initialized', params: {} });
  send({ method: 'workspace/didChangeConfiguration', params: { settings: { html: { validate: { scripts: true, styles: true } } } } });
  send({ method: 'textDocument/didOpen', params: { textDocument: { uri: pathToFileURL(path.resolve('index.html')).href, languageId: 'html', version: 1, text: await readFile('index.html', 'utf8') } } });
}
send({ id: 1, method: 'initialize', params: { processId: process.pid, rootUri: pathToFileURL(process.cwd()).href, capabilities: {} } });
setTimeout(() => { console.log(JSON.stringify(results, null, 2)); child.kill(); }, 5000);
