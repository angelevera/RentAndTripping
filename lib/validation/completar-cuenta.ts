import { z } from "zod";

/**
 * Esquema compartido por el formulario de completar cuenta (validación
 * instantánea vía zodResolver) y por la Server Action guardarContrasena
 * (validación real, ya que un cliente sin JavaScript puede enviar cualquier
 * cosa). Un solo esquema evita duplicar reglas en dos lugares.
 */
export const esquemaCompletarCuenta = z
  .object({
    password: z
      .string()
      .min(6, { message: "La contraseña debe tener al menos 6 caracteres." })
      .max(72, { message: "La contraseña es demasiado larga." }),
    confirmarPassword: z.string().min(1, { message: "Confirma tu contraseña." }),
  })
  .superRefine((datos, contexto) => {
    if (datos.password !== datos.confirmarPassword) {
      contexto.addIssue({
        code: "custom",
        message: "Las contraseñas no coinciden.",
        path: ["confirmarPassword"],
      });
    }
  });

export type DatosCompletarCuenta = z.infer<typeof esquemaCompletarCuenta>;
