export type PreparationStation = "KITCHEN" | "BAR" | "NONE";

export interface Product {
  id: string;
  categoryId?: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  imageUrl?: string;
  sku?: string;
  barcode?: string;
  isActive: boolean;
  isFeatured: boolean;
  trackInventory: boolean;
  taxRate: number;
  preparationStation: PreparationStation;
  category?: Category;
  modifiers?: ProductModifier[];
  inventoryItems?: ProductInventoryItem[];
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Modifier {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
}

export interface ProductModifier {
  id: string;
  productId: string;
  modifierId: string;
  modifier: Modifier;
}

export interface ProductInventoryItem {
  id: string;
  currentStock: number;
  minStock: number;
  unit: string;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  selectedModifiers: Array<{
    modifier: Modifier;
    quantity: number;
  }>;
}
