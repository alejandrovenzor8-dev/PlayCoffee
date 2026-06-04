export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "DELIVERED"
  | "CANCELLED"
  | "COMPLETED";

export type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" | "BLOCKED";

export interface Order {
  id: string;
  branchId: string;
  tableId?: string;
  userId: string;
  orderNumber: string;
  status: OrderStatus;
  notes?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  tipAmount: number;
  isDelivery: boolean;
  isTakeaway: boolean;
  createdAt: string;
  updatedAt: string;
  table?: RestaurantTable;
  user?: { id: string; firstName: string; lastName: string };
  items: OrderItem[];
  payments: Payment[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  status: OrderStatus;
  product: { id: string; name: string; imageUrl?: string };
  modifiers: OrderItemModifier[];
}

export interface OrderItemModifier {
  id: string;
  orderItemId: string;
  modifierId: string;
  quantity: number;
  price: number;
  modifier: { id: string; name: string };
}

export interface Payment {
  id: string;
  orderId: string;
  method: "CASH" | "CARD" | "TRANSFER" | "QR" | "MIXED";
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  amount: number;
  tipAmount: number;
  change?: number;
  processedAt?: string;
}

export interface RestaurantTable {
  id: string;
  areaId: string;
  number: string;
  capacity: number;
  status: TableStatus;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  rotation?: number;
  shape?: "circle" | "rect" | "oval";
  color?: string;
  isActive: boolean;
  area?: { id: string; name: string };
  orders?: Order[];
}

export interface TableArea {
  id: string;
  branchId: string;
  name: string;
  description?: string;
  color?: string;
  order: number;
  isActive: boolean;
  floorPlan?: any;
  createdAt?: string;
  updatedAt?: string;
  tables?: RestaurantTable[];
  _count?: {
    tables: number;
  };
}
