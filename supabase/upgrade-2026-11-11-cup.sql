-- Upgrade: moneda base de la tienda en CUP
-- Fecha: 2026-11-11
-- Idempotente: seguro para ejecutar varias veces.
--
-- Los precios del catálogo YA están escritos en CUP, así que este cambio solo
-- corrige la configuración: no hay que convertir precios ni el envío gratis.
--
-- Ejecutar en Supabase → SQL Editor. Después, revisa en /admin → Configuración
-- que «Moneda de los precios» sea CUP.

insert into public.settings (key, value)
values ('currencyBase', 'CUP')
on conflict (key) do update set value = excluded.value;
