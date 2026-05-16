// ──────────────────────────────────────────────────────────────────────────────
// Shared constants
// ──────────────────────────────────────────────────────────────────────────────

export const APP_NAME = "Play Coffee OS";
export const APP_VERSION = "1.0.0";

export const DEFAULT_TAX_RATE = 0;
export const DEFAULT_TIP_PERCENT = 10;
export const DEFAULT_MAX_CHILD_MINUTES = 120;
export const CHILD_WARNING_PERCENT = 85;

export const ORDER_NUMBER_PREFIX = "PC";

// ──────────────────────────────────────────────────────────────────────────────
// Shared enums (mirror backend)
// ──────────────────────────────────────────────────────────────────────────────

export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  CASHIER = "CASHIER",
  WAITER = "WAITER",
  KITCHEN = "KITCHEN",
  CHILD_SUPERVISOR = "CHILD_SUPERVISOR",
}

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  PREPARING = "PREPARING",
  READY = "READY",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
}

export enum TableStatus {
  AVAILABLE = "AVAILABLE",
  OCCUPIED = "OCCUPIED",
  RESERVED = "RESERVED",
  MAINTENANCE = "MAINTENANCE",
  BLOCKED = "BLOCKED",
}

export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  TRANSFER = "TRANSFER",
  QR = "QR",
  MIXED = "MIXED",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export enum ReservationStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  SEATED = "SEATED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
  COMPLETED = "COMPLETED",
}

export enum StockMovementType {
  IN = "IN",
  OUT = "OUT",
  ADJUSTMENT = "ADJUSTMENT",
  WASTE = "WASTE",
}

// ──────────────────────────────────────────────────────────────────────────────
// Shared utility functions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Format a number as currency (MXN by default).
 */
export function formatCurrency(amount: number, currency = "MXN", locale = "es-MX"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generate a short human-readable order number.
 */
export function generateOrderNumber(): string {
  return `${ORDER_NUMBER_PREFIX}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Calculate subtotal from line items.
 */
export function calculateSubtotal(items: Array<{ quantity: number; unitPrice: number }>): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

/**
 * Calculate tax amount.
 */
export function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate * 100) / 100;
}

/**
 * Calculate tip amount.
 */
export function calculateTip(subtotal: number, tipPercent: number): number {
  return Math.round(subtotal * (tipPercent / 100) * 100) / 100;
}

/**
 * Check whether a child has exceeded their allowed time.
 */
export function isChildOvertime(entryTime: Date, maxMinutes: number): boolean {
  const elapsed = (Date.now() - entryTime.getTime()) / 60000;
  return elapsed >= maxMinutes;
}

/**
 * Get elapsed minutes since entry.
 */
export function getElapsedMinutes(entryTime: Date): number {
  return Math.floor((Date.now() - entryTime.getTime()) / 60000);
}

/**
 * Paginate an array.
 */
export function paginate<T>(items: T[], page: number, limit: number): { data: T[]; total: number; page: number; pages: number } {
  const total = items.length;
  const pages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  return { data: items.slice(start, start + limit), total, page, pages };
}
