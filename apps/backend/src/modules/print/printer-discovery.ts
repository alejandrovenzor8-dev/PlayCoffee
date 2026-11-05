import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ServiceUnavailableException } from '@nestjs/common';

const run = promisify(execFile);
export type DiscoveredPrinter = {
  name: string;
  target: string;
  connection: 'windows' | 'tcp';
};

export function normalizePrinters(
  rows: Array<{ Name: string; Address?: string; Port?: number }>,
): DiscoveredPrinter[] {
  const found: DiscoveredPrinter[] = [];
  for (const row of rows) {
    if (!row.Name) continue;
    found.push({
      name: row.Name,
      target: `windows:///${encodeURIComponent(row.Name)}`,
      connection: 'windows',
    });
    if (row.Address && row.Port && row.Port > 0 && row.Port <= 65535) {
      found.push({
        name: `${row.Name} (${row.Address}:${row.Port})`,
        target: `tcp://${row.Address}:${row.Port}`,
        connection: 'tcp',
      });
    }
  }
  return found.filter(
    (printer, index) =>
      found.findIndex((other) => other.target === printer.target) === index,
  );
}

export async function discoverPrinters() {
  if (process.platform !== 'win32')
    throw new ServiceUnavailableException(
      'La detección requiere el servidor Windows. Puedes introducir la IP manualmente.',
    );
  try {
    // Fixed script: no user input is interpolated into PowerShell.
    const script = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; $ports=@(Get-PrinterPort); $result=@(Get-Printer | ForEach-Object { $p=$_; $port=$ports | Where-Object Name -eq $p.PortName | Select-Object -First 1; [pscustomobject]@{ Name=$p.Name; Address=$(if($port -and $port.Protocol -eq 1 -and $port.PrinterHostAddress){$port.PrinterHostAddress}else{''}); Port=$(if($port -and $port.PortNumber){$port.PortNumber}else{0}) } }); ConvertTo-Json -InputObject $result -Compress`;
    const { stdout } = await run(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 },
    );
    return normalizePrinters(
      JSON.parse(stdout.replace(/^\uFEFF/, '').trim()) as Array<{
        Name: string;
        Address?: string;
        Port?: number;
      }>,
    );
  } catch {
    throw new ServiceUnavailableException(
      'No se pudieron consultar las impresoras de Windows. Revisa el servicio de cola de impresión y la cuenta que ejecuta PlayCoffee.',
    );
  }
}
