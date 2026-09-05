"use client";

import { Loader2, Printer, Send, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PrintTicketDocument } from "@/types/print.types";

interface PrintableTicketProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: PrintTicketDocument | null;
  title: string;
  children: ReactNode;
  onQueue?: () => Promise<void>;
  isQueueing?: boolean;
}

export function PrintableTicket({
  open,
  onOpenChange,
  document,
  title,
  children,
  onQueue,
  isQueueing = false,
}: PrintableTicketProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md print:contents">
        <DialogHeader className="print:hidden">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center bg-muted/40 p-4 print:block print:bg-white print:p-0">
          <div className="print-ticket" data-width={document?.width ?? "80mm"}>
            {children}
          </div>
        </div>
        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Cerrar
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
          {onQueue && (
            <Button onClick={() => void onQueue()} disabled={isQueueing}>
              {isQueueing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar a impresora
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
