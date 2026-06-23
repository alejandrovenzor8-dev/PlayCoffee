import type { PrintTicketDocument } from "@/types/print.types";
import { ProductionTicket } from "./KitchenTicket";

export function BarTicket({ document }: { document: PrintTicketDocument }) {
  return <ProductionTicket document={document} title="BARRA" />;
}
