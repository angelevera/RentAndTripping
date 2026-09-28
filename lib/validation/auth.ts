import { z } from "zod";

/**
 * Esquema compartido por el formulario de login (validación instantánea en
 * el teléfono, vía zodResolver) y por la Server Action iniciarSesion
 * (validación real, ya que un cliente sin JavaScript puede enviar cualquier
 * cosa). Un solo esquema evita duplicar reglas en dos lugares.
 */
export const esquemaLogin = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Escribe tu correo." })
    .email({ message: "Escribe un correo válido." }),
  password: z
    .string()
    .min(1, { message: "Escribe tu contraseña." })
    .max(72, { message: "La contraseña es demasiado larga." }),
});

export type DatosLogin = z.infer<typeof esquemaLogin>;
