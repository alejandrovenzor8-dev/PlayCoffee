import { formatCurrency, formatDate } from "@/lib/utils";
import type { PrintTicketDocument } from "@/types/print.types";

const paymentLabels: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  QR: "QR",
  MIXED: "Mixto",
};

export function CustomerReceipt({ document }: { document: PrintTicketDocument }) {
  return (
    <article className="ticket-body">
      <header className="ticket-center ticket-section">
        <h2 className="ticket-business">{document.config.businessName}</h2>
        <p>{document.config.branchName}</p>
        {document.config.address && <p>{document.config.address}</p>}
        {document.config.phone && <p>Tel. {document.config.phone}</p>}
      </header>

      <section className="ticket-section">
        <div className="ticket-row">
          <span>Folio</span>
          <strong>{document.order.orderNumber}</strong>
        </div>
        <div className="ticket-row">
          <span>Fecha</span>
          <span>{formatDate(document.order.createdAt)}</span>
        </div>
        {document.order.cashier && (
          <div className="ticket-row">
            <span>Cajero</span>
            <span>{document.order.cashier}</span>
          </div>
        )}
        {document.order.table && (
          <div className="ticket-row">
            <span>Mesa</span>
            <span>{document.order.table}</span>
          </div>
        )}
      </section>

      <section className="ticket-section">
        {document.items.map((item) => (
          <div key={item.id} className="ticket-item">
            <div className="ticket-row">
              <span>
                {item.quantity} x {item.name}
              </span>
              <strong>{formatCurrency(item.totalPrice ?? 0)}</strong>
            </div>
            {item.modifiers.map((modifier) => (
              <p key={`${item.id}-${modifier.name}`} className="ticket-muted">
                + {modifier.quantity} {modifier.name}
                {modifier.price ? ` ${formatCurrency(modifier.price)}` : ""}
              </p>
            ))}
            {item.notes && <p className="ticket-note">Nota: {item.notes}</p>}
          </div>
        ))}
      </section>

      {document.totals && (
        <section className="ticket-section">
          <div className="ticket-row">
            <span>Subtotal</span>
            <span>{formatCurrency(document.totals.subtotal)}</span>
          </div>
          {document.totals.discountAmount > 0 && (
            <div className="ticket-row">
              <span>Descuento</span>
              <span>-{formatCurrency(document.totals.discountAmount)}</span>
            </div>
          )}
          {document.totals.taxAmount > 0 && (
            <div className="ticket-row">
              <span>Impuestos</span>
              <span>{formatCurrency(document.totals.taxAmount)}</span>
            </div>
          )}
          {document.totals.tipAmount > 0 && (
            <div className="ticket-row">
              <span>Propina</span>
              <span>{formatCurrency(document.totals.tipAmount)}</span>
            </div>
          )}
          <div className="ticket-row ticket-total">
            <span>Total</span>
            <span>{formatCurrency(document.totals.total)}</span>
          </div>
        </section>
      )}

      {document.payments && document.payments.length > 0 && (
        <section className="ticket-section">
          <h3 className="ticket-subtitle">Pagos</h3>
          {document.payments.map((payment) => (
            <div key={payment.id} className="ticket-item">
              <div className="ticket-row">
                <span>{paymentLabels[payment.method]}</span>
                <span>{formatCurrency(payment.amount)}</span>
              </div>
              {payment.receivedAmount !== null && (
                <div className="ticket-row ticket-muted">
                  <span>Recibido</span>
                  <span>{formatCurrency(payment.receivedAmount)}</span>
                </div>
              )}
              {payment.changeAmount > 0 && (
                <div className="ticket-row ticket-muted">
                  <span>Cambio</span>
                  <span>{formatCurrency(payment.changeAmount)}</span>
                </div>
              )}
              {payment.reference && <p className="ticket-muted">Ref: {payment.reference}</p>}
            </div>
          ))}
        </section>
      )}

      <footer className="ticket-center ticket-section">
        <p>{document.config.ticketMessage}</p>
      </footer>
    </article>
  );
}
