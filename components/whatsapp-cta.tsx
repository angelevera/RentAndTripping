import { Button } from "@/components/ui/button";

function obtenerNumeroWhatsapp() {
  return process.env.NEXT_PUBLIC_WHATSAPP_OPERADOR;
}

export function WhatsappCta() {
  const numero = obtenerNumeroWhatsapp();
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

export function WhatsappFlotante() {
  const numero = obtenerNumeroWhatsapp();
  const mensaje = encodeURIComponent("Hola, quiero pedir una cotización para un nuevo viaje");
  const href = `https://wa.me/${numero ?? ""}?text=${mensaje}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Pedir una cotización por WhatsApp"
      data-testid="whatsapp-cta-flotante"
      className="fixed z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128C7E]"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))", right: "calc(1rem + env(safe-area-inset-right))" }}
    >
      <svg viewBox="0 0 32 32" className="size-7 fill-current" aria-hidden="true">
        <path d="M16.02 3.2c-7.05 0-12.78 5.72-12.78 12.76 0 2.25.59 4.45 1.71 6.4L3.14 28.8l6.6-1.73a12.8 12.8 0 0 0 6.27 1.6h.01c7.04 0 12.77-5.73 12.78-12.77a12.7 12.7 0 0 0-3.75-9.04 12.7 12.7 0 0 0-9.03-3.75Zm0 23.31h-.01a10.6 10.6 0 0 1-5.4-1.48l-.39-.23-3.92 1.03 1.05-3.82-.25-.4a10.56 10.56 0 0 1-1.62-5.65c0-5.84 4.76-10.59 10.6-10.59 2.83 0 5.49 1.1 7.49 3.1a10.52 10.52 0 0 1 3.1 7.5c0 5.84-4.76 10.6-10.6 10.6Zm5.82-7.94c-.32-.16-1.9-.94-2.2-1.05-.3-.1-.51-.16-.73.16-.21.32-.83 1.05-1.02 1.27-.19.21-.38.24-.7.08-.32-.16-1.35-.5-2.58-1.59-.95-.84-1.59-1.88-1.78-2.2-.19-.32-.02-.5.14-.66.15-.14.32-.38.48-.56.16-.19.21-.32.32-.54.1-.21.05-.4-.03-.56-.08-.16-.73-1.75-1-2.39-.27-.62-.54-.54-.73-.55h-.62c-.22 0-.57.08-.86.4-.3.32-1.13 1.1-1.13 2.68s1.16 3.11 1.32 3.33c.16.21 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.25 1.47.21 2.02.13.62-.09 1.9-.78 2.17-1.53.27-.76.27-1.4.19-1.53-.08-.14-.3-.22-.62-.38Z" />
      </svg>
    </a>
  );
}
