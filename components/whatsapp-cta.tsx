import { Button } from "@/components/ui/button";

export function WhatsappCta() {
  const numero = process.env.NEXT_PUBLIC_WHATSAPP_OPERADOR;
  const mensaje = encodeURIComponent("Hola, quiero planificar un viaje");
  const href = `https://wa.me/${numero ?? ""}?text=${mensaje}`;

  return (
    <Button asChild className="min-h-11 rounded-full bg-primary text-primary-foreground active:scale-95">
      <a href={href} target="_blank" rel="noopener noreferrer" data-testid="whatsapp-cta">
        Escríbenos por WhatsApp
      </a>
    </Button>
  );
}
