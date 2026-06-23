export type PrintTicketType = "CUSTOMER" | "KITCHEN" | "BAR";

export interface PrintTicketDocument {
  type: PrintTicketType;
  width: "58mm" | "80mm";
  config: {
    businessName: string;
    branchName: string;
    address: string | null;
    phone: string | null;
    ticketMessage: string;
    kitchenPrinter: string | null;
    barPrinter: string | null;
    cashierPrinter: string | null;
  };
  order: {
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    table: string | null;
    cashier: string | null;
    waiter: string | null;
    notes: string | null;
  };
  items: PrintTicketItem[];
  payments?: PrintTicketPayment[];
  totals?: {
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    tipAmount: number;
    total: number;
    paid: number;
    changeAmount: number;
  };
}

export interface PrintTicketItem {
  id: string;
  quantity: number;
  name: string;
  category: string | null;
  notes: string | null;
  unitPrice?: number;
  totalPrice?: number;
  modifiers: Array<{
    name: string;
    quantity: number;
    price?: number;
  }>;
}

export interface PrintTicketPayment {
  id: string;
  method: "CASH" | "CARD" | "TRANSFER" | "QR" | "MIXED";
  amount: number;
  receivedAmount: number | null;
  changeAmount: number;
  reference: string | null;
}
