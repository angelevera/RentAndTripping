import { z } from "zod";

/**
 * Esquema compartido por el formulario de invitación de cliente (validación
 * instantánea vía zodResolver) y por la Server Action invitarClienteAction
 * (validación real, ya que un admin sin JavaScript puede enviar cualquier
 * cosa). Un solo esquema evita duplicar reglas en dos lugares.
 */
export const esquemaInvitarCliente = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, { message: "Escribe el nombre del cliente." })
    .max(120, { message: "El nombre es demasiado largo." }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Escribe un correo válido." })
    .max(254, { message: "El correo es demasiado largo." }),
});

export type DatosInvitarCliente = z.infer<typeof esquemaInvitarCliente>;
