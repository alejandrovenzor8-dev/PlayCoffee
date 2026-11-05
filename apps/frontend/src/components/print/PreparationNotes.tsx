"use client";
import { Textarea } from '@/components/ui/textarea';
export function PreparationNotes({ name, quantity, value, disabled, onChange }: {
  name: string; quantity: number; value?: string; disabled?: boolean; onChange: (notes: string) => void;
}) {
  return <label className="mt-2 block space-y-1 text-xs">
    <span className="font-medium">Comentarios de preparación</span>
    <Textarea aria-label={`Notas de ${name}`} placeholder="Ej. bien cocidos, tiernitos, sin cebolla..." rows={2} maxLength={1000} value={value ?? ''} disabled={disabled} onChange={event => onChange(event.target.value)} className="min-h-16 text-base lg:text-sm" />
    {quantity > 1 && <span className="block text-muted-foreground">Aplica a las {quantity} porciones. Usa Separar 1 si una lleva otra preparación.</span>}
  </label>;
}
