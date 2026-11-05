"use client";
import { Button } from '@/components/ui/button';
export function OrderPaneSwitcher({ value, onChange, count }: { value: 'products' | 'ticket'; onChange: (value: 'products' | 'ticket') => void; count: number }) {
  return <div role="group" aria-label="Vista del pedido" className="grid shrink-0 grid-cols-2 gap-2 lg:hidden">
    <Button type="button" aria-pressed={value === 'products'} variant={value === 'products' ? 'default' : 'outline'} onClick={() => onChange('products')}>Productos</Button>
    <Button type="button" aria-pressed={value === 'ticket'} variant={value === 'ticket' ? 'default' : 'outline'} onClick={() => onChange('ticket')}>Comanda{count > 0 ? ` (${count})` : ''}</Button>
  </div>;
}
