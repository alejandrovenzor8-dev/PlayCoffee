import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderTicket } from './escpos-renderer.mjs';

const apiUrl = (process.env.PRINT_AGENT_API_URL ?? 'http://127.0.0.1:3001/api/v1').replace(/\/$/, '');
const token = process.env.PRINT_AGENT_TOKEN;
const agentId = process.env.PRINT_AGENT_ID ?? `${os.hostname()}-${process.pid}`;
const pollMs = Number(process.env.PRINT_AGENT_POLL_MS ?? 1000);
const dataDirectory = process.env.PLAYCOFFEE_DATA ?? process.cwd();
if (!token) throw new Error('PRINT_AGENT_TOKEN es obligatorio');

async function request(route, body) {
  const response = await fetch(`${apiUrl}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-print-agent-token': token },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
  const result = await response.json();
  return result.data;
}

function sendTcp(host, port, bytes) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: 10000 });
    socket.once('connect', () => socket.end(bytes));
    socket.once('timeout', () => socket.destroy(new Error('Tiempo de conexión agotado')));
    socket.once('error', reject);
    socket.once('close', (hadError) => { if (!hadError) resolve(); });
  });
}

async function sendWindows(printerName, bytes, jobId) {
  const spoolDir = path.join(dataDirectory, 'runtime', 'print-spool');
  await mkdir(spoolDir, { recursive: true });
  const spoolPath = path.join(spoolDir, `${jobId}.bin`);
  await writeFile(spoolPath, bytes);
  const helper = path.join(path.dirname(fileURLToPath(import.meta.url)), 'send-windows-raw.ps1');
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', helper, '-PrinterName', printerName, '-DataPath', spoolPath], { windowsHide: true });
    let error = '';
    child.stderr.on('data', (chunk) => { error += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(error || `Windows spooler terminó con ${code}`)));
  });
}

async function printJob(job) {
  const bytes = renderTicket(job.payload);
  const target = new URL(job.printerTarget);
  if (target.protocol === 'tcp:') {
    await sendTcp(target.hostname, Number(target.port || 9100), bytes);
    return;
  }
  if (target.protocol === 'windows:') {
    const printerName = decodeURIComponent(target.pathname.replace(/^\/+/, '') || target.hostname);
    if (!printerName) throw new Error('Falta el nombre de la impresora de Windows');
    await sendWindows(printerName, bytes, job.id);
    return;
  }
  if (target.protocol === 'file:') {
    const outputDir = path.join(dataDirectory, 'test-prints');
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, `${job.id}.bin`), bytes);
    await appendFile(path.join(outputDir, 'printed.log'), `${new Date().toISOString()} ${job.id} ${job.type}\n`);
    return;
  }
  throw new Error(`Destino no compatible: ${target.protocol}`);
}

async function cycle() {
  const job = await request('/print-agent/claim', { agentId });
  if (!job) return;
  try {
    await printJob(job);
    await request(`/print-agent/${job.id}/complete`, { agentId });
    console.log(`${new Date().toISOString()} impreso ${job.id} en ${job.printerTarget}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await request(`/print-agent/${job.id}/fail`, { agentId, error: message });
    console.error(`${new Date().toISOString()} fallo ${job.id}: ${message}`);
  }
}

console.log(`Agente de impresión ${agentId} iniciado`);
while (true) {
  try { await cycle(); } catch (error) { console.error(new Date().toISOString(), error); }
  await new Promise((resolve) => setTimeout(resolve, pollMs));
}
