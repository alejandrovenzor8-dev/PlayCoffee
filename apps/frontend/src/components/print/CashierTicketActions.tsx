"use client";
import { useRef, useState } from 'react';
import { useCashierPrintPolicy } from '@/hooks/useCashierPrintPolicy';
import { printApi, getApiErrorMessage } from '@/lib/api';
import { createPaymentAttemptId } from '@/lib/payment-id';
import { useAuthStore } from '@/store/auth.store';
import type { PrintTicketDocument } from '@/types/print.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomerReceipt } from './CustomerReceipt';
import { PrintableTicket } from './PrintableTicket';

export function CashierTicketActions({ orderId, status }: { orderId: string; status: string }) {
  const { data: policy } = useCashierPrintPolicy();
  const role = useAuthStore(state => state.user?.role);
  const authorized = ['ADMIN', 'SUPER_ADMIN', 'CASHIER'].includes(role ?? '');
  const business = status === 'COMPLETED';
  const [document, setDocument] = useState<PrintTicketDocument | null>(null);
  const [open, setOpen] = useState(false);
  const [jobStatus, setJobStatus] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  if (status === 'CANCELLED' || (business ? !authorized : policy?.cashierMode !== 'CUSTOMER_AND_BUSINESS')) return null;
  const load = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage(null);
    try {
      if (business) {
        const receipt = await printApi.businessReceipt(orderId);
        setDocument(receipt.document); setJobStatus(receipt.status); setMessage(receipt.lastError);
      } else { setDocument(await printApi.prebill(orderId)); setJobStatus(''); }
      requestId.current = createPaymentAttemptId(); setReason(''); setOpen(true);
    } catch (error) { setMessage(getApiErrorMessage(error, 'No se pudo consultar el documento.')); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const reprint = business && jobStatus !== 'HELD';
  const queue = async () => {
    if (inFlight.current) return;
    if (reprint && !window.confirm('Revisa la impresora. Confirma reimprimir el mismo comprobante sin registrar otro pago.')) return;
    inFlight.current = true; setBusy(true);
    try {
      requestId.current ??= createPaymentAttemptId();
      if (business) await printApi.printBusinessReceipt(orderId, requestId.current, reprint ? reason : 'Primera impresion de copia negocio');
      else await printApi.queuePrebill(orderId, requestId.current);
      setOpen(false); setMessage('Documento enviado a caja. El resultado de impresion no modifica el cobro.');
    } catch (error) { setMessage(getApiErrorMessage(error, 'No se pudo enviar a caja.')); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const blocked = business && (['PENDING', 'PROCESSING'].includes(jobStatus) || (reprint && (!policy?.allowReprint || reason.trim().length < 3)));
  return <div className="space-y-2">
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>{business ? 'Comprobante negocio' : 'Imprimir precuenta'}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
    <PrintableTicket open={open} onOpenChange={setOpen} document={document} title={business ? 'Copia negocio' : 'Precuenta'} onQueue={queue} isQueueing={busy} queueDisabled={blocked} queueLabel={business ? (reprint ? 'Reimprimir comprobante' : 'Imprimir comprobante') : 'Imprimir precuenta'} controls={business ? <div className="space-y-2 text-sm"><p>Estado de impresion: {jobStatus}. El pago confirmado no cambia.</p>{reprint && policy?.allowReprint && <Input aria-label="Motivo de reimpresion" placeholder="Motivo obligatorio" value={reason} onChange={e => setReason(e.target.value)} />}{reprint && !policy?.allowReprint && <p>Reimpresion deshabilitada por la sucursal.</p>}</div> : undefined}>
      {document && <CustomerReceipt document={document} />}
    </PrintableTicket>
  </div>;
}
