param(
    [Parameter(Mandatory)][string]$PrinterName,
    [Parameter(Mandatory)][string]$DataPath
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
public static class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public class DOC_INFO_1 { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Unicode)] static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Unicode)] static extern int StartDocPrinter(IntPtr handle, int level, [In] DOC_INFO_1 info);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool WritePrinter(IntPtr handle, byte[] bytes, int count, out int written);
  public static void Send(string printer, string file) {
    IntPtr handle;
    if (!OpenPrinter(printer, out handle, IntPtr.Zero)) throw new System.ComponentModel.Win32Exception();
    try {
      var info = new DOC_INFO_1 { pDocName="PlayCoffee ticket", pDataType="RAW" };
      if (StartDocPrinter(handle, 1, info) == 0) throw new System.ComponentModel.Win32Exception();
      try {
        if (!StartPagePrinter(handle)) throw new System.ComponentModel.Win32Exception();
        byte[] bytes = File.ReadAllBytes(file); int written;
        if (!WritePrinter(handle, bytes, bytes.Length, out written) || written != bytes.Length) throw new IOException("No se escribió el ticket completo");
        EndPagePrinter(handle);
      } finally { EndDocPrinter(handle); }
    } finally { ClosePrinter(handle); }
  }
}
'@
[RawPrinter]::Send($PrinterName, (Resolve-Path -LiteralPath $DataPath).Path)
Remove-Item -LiteralPath $DataPath -Force
