# Procedimiento: organizar una reserva

Usa este flujo cuando el dueño proporcione datos de una reserva para ordenar o preparar su registro. No consultes ni modifiques la base de datos salvo que el usuario lo pida expresamente y el entorno de la tarea esté autorizado para ello.

1. Identifica el tipo de servicio: pasaje, hotel, tour o entrada.
2. Ordena los datos proporcionados: cliente o ID interno, servicio, fechas, proveedor, precio/moneda, método de pago, estado del pago, estado de confirmación del proveedor y próxima fecha de seguimiento.
3. Marca como `Pendiente de confirmar` cualquier campo ausente o ambiguo.
4. No infieras que el proveedor confirmó la reserva.
5. No infieras que el pago se recibió a partir de un comprobante, captura o enlace. El pago solo cambia a confirmado cuando el operador indica que lo verificó.
6. Devuelve un resumen interno y las preguntas bloqueantes. Minimiza datos personales en la respuesta.

Formato sugerido:

```text
Tipo de servicio:
Cliente/ID interno:
Servicio y fechas:
Proveedor:
Precio y moneda:
Estado de la reserva:
Pago: método / estado
Próxima fecha de seguimiento:
Pendiente de confirmar:
```
