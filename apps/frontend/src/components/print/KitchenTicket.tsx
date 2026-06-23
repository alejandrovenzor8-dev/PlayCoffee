import { formatDate } from "@/lib/utils";
import type { PrintTicketDocument } from "@/types/print.types";

export function KitchenTicket({ document }: { document: PrintTicketDocument }) {
  return <ProductionTicket document={document} title="COCINA" />;
}

export function ProductionTicket({
  document,
  title,
}: {
  document: PrintTicketDocument;
  title: string;
}) {
  return (
    <article className="ticket-body ticket-production">
      <header className="ticket-center ticket-section">
        <h2 className="ticket-station">{title}</h2>
        <p className="ticket-order">{document.order.orderNumber}</p>
      </header>

      <section className="ticket-section ticket-large">
        <div className="ticket-row">
          <span>Mesa</span>
          <strong>{document.order.table ?? "Para llevar"}</strong>
        </div>
        <div className="ticket-row">
          <span>Hora</span>
          <span>{formatDate(document.order.createdAt, { dateStyle: undefined, timeStyle: "short" })}</span>
        </div>
        {document.order.waiter && (
          <div className="ticket-row">
            <span>Mesero</span>
            <span>{document.order.waiter}</span>
          </div>
        )}
      </section>

      <section className="ticket-section">
        {document.items.length === 0 ? (
          <p className="ticket-center ticket-muted">Sin productos para esta estacion</p>
        ) : (
          document.items.map((item) => (
            <div key={item.id} className="ticket-item ticket-command-item">
              <div className="ticket-row">
                <strong>
                  {item.quantity} x {item.name}
                </strong>
              </div>
              {item.modifiers.map((modifier) => (
                <p key={`${item.id}-${modifier.name}`} className="ticket-command-note">
                  + {modifier.quantity} {modifier.name}
                </p>
              ))}
              {item.notes && <p className="ticket-command-note">Nota: {item.notes}</p>}
            </div>
          ))
        )}
      </section>

      {document.order.notes && (
        <section className="ticket-section">
          <h3 className="ticket-subtitle">Notas orden</h3>
          <p className="ticket-command-note">{document.order.notes}</p>
        </section>
      )}
    </article>
  );
}
