-- Upgrade: moneda base de la tienda en CUP
-- Fecha: 2026-11-11
-- Idempotente: seguro para ejecutar varias veces.
--
-- Ejecutar en Supabase → SQL Editor. Después, revisa en /admin → Configuración
-- que «Moneda de los precios» sea CUP y ajusta «Envío gratis a partir de».

-- 1) La tienda pasa a interpretar los precios del catálogo como CUP.
insert into public.settings (key, value)
values ('currencyBase', 'CUP')
on conflict (key) do update set value = excluded.value;

-- 2) IMPORTANTE: los precios de `variants` y el umbral `freeShip` se
-- interpretan en la moneda base. Si YA estaban escritos en CUP, no hagas nada
-- más. Si estaban en USD y quieres convertirlos a CUP, descomenta este bloque
-- ANTES de abrir la tienda con la nueva configuración:
--
-- do $$
-- declare r numeric;
-- begin
--   select value::numeric into r from public.settings where key = 'rateCUP';
--   if r is null or r <= 0 then
--     raise exception 'Configura rateCUP antes de convertir los precios';
--   end if;
--   update public.variants set price = round(price * r, 2);
--   update public.settings
--      set value = (value::numeric * r)::text
--    where key = 'freeShip';
-- end $$;
