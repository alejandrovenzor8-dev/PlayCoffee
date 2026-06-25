import { PaymentMethod } from '@prisma/client';

export type PrintTicketType = 'CUSTOMER' | 'KITCHEN' | 'BAR';

export type PrintTicketDocument = {
  type: PrintTicketType;
  width: '58mm' | '80mm';
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
    createdAt: Date;
    table: string | null;
    cashier: string | null;
    waiter: string | null;
    notes: string | null;
  };
  items: Array<{
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
  }>;
  payments?: Array<{
    id: string;
    method: PaymentMethod;
    amount: number;
    receivedAmount: number | null;
    changeAmount: number;
    reference: string | null;
  }>;
  totals?: {
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    tipAmount: number;
    total: number;
    paid: number;
    changeAmount: number;
  };
};
