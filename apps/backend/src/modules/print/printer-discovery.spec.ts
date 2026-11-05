import { normalizePrinters } from './printer-discovery';

describe('Printer discovery', () => {
  it('encodes Windows names so the agent receives the exact name, including accents and slashes', () => {
    const [printer] = normalizePrinters([{ Name: 'Caja #1 / Café' }]);
    expect(decodeURIComponent(new URL(printer.target).pathname.slice(1))).toBe(
      'Caja #1 / Café',
    );
  });
  it('offers both a Windows queue and its network destination without duplicate targets', () => {
    const printers = normalizePrinters([
      { Name: 'Caja', Address: '192.168.1.20', Port: 9100 },
      { Name: 'Copia', Address: '192.168.1.20', Port: 9100 },
    ]);
    expect(printers.filter((printer) => printer.connection === 'tcp')).toEqual([
      {
        name: 'Caja (192.168.1.20:9100)',
        target: 'tcp://192.168.1.20:9100',
        connection: 'tcp',
      },
    ]);
  });
});
