-- Bucket privado 'comprobantes' + políticas de storage.objects para las
-- pruebas de pago (Zelle/Binance/Payoneer/efectivo). El bucket nunca es
-- público (regla fija del stack): la URL pública de un objeto no debe servir
-- el archivo, solo una URL firmada de corta duración generada por el admin.
--
-- Convención de ruta: {auth.uid}/{reserva_id}-{timestamp}.{ext}
-- El primer segmento de la ruta es el uid del cliente dueño del comprobante;
-- storage.foldername(name))[1] lo extrae para las políticas de abajo.
-- createSignedUrl() solo necesita la política de SELECT (no hace falta una
-- política separada sobre la tabla buckets).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

-- El cliente puede subir a su propia carpeta (nombrada con su auth.uid()).
create policy "comprobantes: el cliente sube a su carpeta"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- El cliente solo puede leer los objetos de su propia carpeta.
create policy "comprobantes: el cliente ve su carpeta"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Deliberadamente no existe una política de UPDATE ni DELETE para el
-- cliente: una vez subido, un comprobante no se puede sobrescribir ni
-- borrar desde su propia cuenta (es evidencia en caso de disputa). Esto es
-- más estricto que la política "for all" que proponía RESEARCH.md.

-- El admin gestiona todos los comprobantes (leer, subir, actualizar, borrar).
create policy "comprobantes: el admin gestiona todos"
on storage.objects
for all
to authenticated
using ( bucket_id = 'comprobantes' and (select private.is_admin()) )
with check ( bucket_id = 'comprobantes' and (select private.is_admin()) );
