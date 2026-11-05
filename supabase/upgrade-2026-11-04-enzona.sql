-- Upgrade: Añadir soporte para pagos con Enzona
-- Idempotente: seguro para ejecutar múltiples veces
-- Fecha: 2026-11-04

-- Campos de pago en pedidos
alter table public.orders add column if not exists payment_method text default 'whatsapp';
alter table public.orders add column if not exists payment_status text default 'pendiente';
alter table public.orders add column if not exists payment_ref text;
alter table public.orders add column if not exists payment_url text;
alter table public.orders add column if not exists paid_at timestamptz;

-- Valores por defecto para pedidos existentes
update public.orders set payment_method = 'whatsapp' where payment_method is null;
update public.orders set payment_status = 'pendiente' where payment_status is null;

-- Índices útiles
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_payment_method on public.orders(payment_method);

-- Comentarios para claridad
comment on column public.orders.payment_method is 'Método de pago: whatsapp | enzona';
comment on column public.orders.payment_status is 'Estado de pago: pendiente | pagado | fallido | cancelado | expirado';
comment on column public.orders.payment_ref is 'Referencia/ID de transacción de la pasarela';
comment on column public.orders.paid_at is 'Fecha/hora en que se confirmó el pago';
