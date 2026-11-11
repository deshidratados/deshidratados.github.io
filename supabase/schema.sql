-- ============================================================
-- Solaria · Esquema Supabase (Postgres)
-- Pega este archivo completo en: Supabase Dashboard → SQL Editor → New query → Run
-- Se puede ejecutar más de una vez sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- TABLAS
-- ------------------------------------------------------------

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  label       text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  category_id uuid references public.categories(id) on delete set null,
  description text not null default '',
  origin      text not null default '',
  rating      numeric(2,1) not null default 0,
  reviews     int  not null default 0,
  badge       text,
  images      text[] not null default '{}',
  active      boolean not null default true,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  author text not null,
  rating int not null check (rating between 1 and 5),
  comment text not null default '',
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- Suscriptores del boletín (correo del pie de página)
create table if not exists public.subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text not null default 'footer',
  created_at timestamptz not null default now()
);

-- Historial de envíos de boletines (lo escribe la Edge Function send-email)
create table if not exists public.newsletter_history (
  id               uuid primary key default gen_random_uuid(),
  subject          text not null,
  html             text not null,
  sent_at          timestamptz not null default now(),
  recipients_count int not null default 0,
  sent_by          text not null default 'admin'
);

create table if not exists public.presentations (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  weight      text not null default '100',
  label       text not null,
  price       numeric(10,2) not null default 0
);

-- Presentación de venta (rodaja, media lida, polvo…) ligada a cada precio
alter table public.variants
  add column if not exists presentation_id uuid references public.presentations(id) on delete set null;

-- Imagen propia por presentación (opcional)
alter table public.variants
  add column if not exists images text[] not null default '{}';
update public.variants set images = '{}' where images is null;
alter table public.variants alter column images set default '{}';
alter table public.variants alter column images set not null;

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone         text not null default '',
  items         jsonb not null default '[]'::jsonb,
  total         numeric(10,2) not null default 0,
  status        text not null default 'Nuevo',
  status_updated_at timestamptz,
  created_at    timestamptz not null default now(),
  -- Pagos
  payment_method text not null default 'whatsapp',
  payment_status text not null default 'pendiente',
  payment_ref    text,
  payment_url    text,
  paid_at        timestamptz
);

create table if not exists public.settings (
  key   text primary key,
  value text not null default ''
);

-- Indices útiles
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_variants_product on public.variants(product_id);
create index if not exists idx_variants_presentation on public.variants(presentation_id);
create index if not exists idx_orders_created on public.orders(created_at desc);
create unique index if not exists idx_subscribers_email on public.subscribers (lower(trim(email)));
create index if not exists idx_subscribers_created on public.subscribers (created_at desc);

-- ------------------------------------------------------------
-- SEGURIDAD (Row Level Security)
-- Lectura pública del catálogo · Escritura solo admin · Insert de pedidos público
-- ------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.products   enable row level security;
alter table public.presentations enable row level security;
alter table public.variants   enable row level security;
alter table public.settings   enable row level security;
alter table public.orders     enable row level security;
alter table public.reviews    enable row level security;
alter table public.subscribers enable row level security;
alter table public.newsletter_history enable row level security;

-- Catálogo: cualquiera puede leer
drop policy if exists "categories public read" on public.categories;
create policy "categories public read"         on public.categories for select using (true);
drop policy if exists "products public read"   on public.products;
create policy "products public read"           on public.products   for select using (true);
drop policy if exists "presentations public read" on public.presentations;
create policy "presentations public read"      on public.presentations for select using (true);
drop policy if exists "variants public read"   on public.variants;
create policy "variants public read"           on public.variants   for select using (true);
drop policy if exists "settings public read"   on public.settings;
create policy "settings public read"           on public.settings   for select using (true);

-- Catálogo: solo usuarios autenticados (el admin) escriben
drop policy if exists "categories admin write" on public.categories;
create policy "categories admin write"         on public.categories for all to authenticated using (true) with check (true);
drop policy if exists "products admin write"   on public.products;
create policy "products admin write"           on public.products   for all to authenticated using (true) with check (true);
drop policy if exists "presentations admin write" on public.presentations;
create policy "presentations admin write"      on public.presentations for all to authenticated using (true) with check (true);
drop policy if exists "variants admin write"   on public.variants;
create policy "variants admin write"           on public.variants   for all to authenticated using (true) with check (true);
drop policy if exists "settings admin write"   on public.settings;
create policy "settings admin write"           on public.settings   for all to authenticated using (true) with check (true);

-- Pedidos: cualquiera puede crear (checkout), solo el admin los ve o edita
drop policy if exists "orders public insert"   on public.orders;
create policy "orders public insert"           on public.orders for insert with check (true);
drop policy if exists "orders admin manage"    on public.orders;
create policy "orders admin manage"            on public.orders for all to authenticated using (true) with check (true);

-- Reseñas: cualquiera puede leer aprobadas, cualquiera inserta (queda pending), admin gestiona todo
drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews for select using (true);
drop policy if exists "reviews public insert" on public.reviews;
create policy "reviews public insert" on public.reviews for insert with check (true);
drop policy if exists "reviews admin manage" on public.reviews;
create policy "reviews admin manage" on public.reviews for all to authenticated using (true) with check (true);

-- Suscriptores: cualquiera se registra desde el pie de página.
-- Sin política de lectura pública: los correos de los clientes no se exponen.
drop policy if exists "subscribers public insert" on public.subscribers;
create policy "subscribers public insert" on public.subscribers for insert with check (true);
drop policy if exists "subscribers admin manage" on public.subscribers;
create policy "subscribers admin manage" on public.subscribers for all to authenticated using (true) with check (true);

-- Historial de boletines: solo el administrador autenticado lo lee/gestiona.
-- (NADA de auth.role(): está deprecado en Supabase y tumba el script.)
drop policy if exists "newsletter_history admin manage" on public.newsletter_history;
create policy "newsletter_history admin manage" on public.newsletter_history for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- STORAGE · Bucket de imágenes de productos
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "images public read"   on storage.objects;
drop policy if exists "images admin write"   on storage.objects;
drop policy if exists "images admin update"  on storage.objects;
drop policy if exists "images admin delete"  on storage.objects;

create policy "images public read"  on storage.objects for select using (bucket_id = 'product-images');
create policy "images admin write"  on storage.objects for insert to authenticated with check (bucket_id = 'product-images');
create policy "images admin update" on storage.objects for update to authenticated using (bucket_id = 'product-images');
create policy "images admin delete" on storage.objects for delete to authenticated using (bucket_id = 'product-images');

-- ------------------------------------------------------------
-- SEMILLA · Categorías, productos y config iniciales
-- (coinciden con los datos que hoy trae la tienda por código)
-- Nota: las imágenes quedan como placeholder; cámbialas desde /admin
-- ------------------------------------------------------------

insert into public.categories (slug, label, sort_order) values
  ('frutas',   'Frutas',   1),
  ('verduras', 'Verduras', 2),
  ('mixes',    'Mixes',    3)
on conflict (slug) do nothing;

insert into public.presentations (slug, name, sort_order) values
  ('rodaja',    'Rodaja',    1),
  ('media-lida','Media lida',2),
  ('polvo',     'Polvo',     3)
on conflict (slug) do nothing;

insert into public.settings (key, value) values
  ('shopName', 'Salud & Vida'),
  ('whatsapp', '5354410057'),
  ('freeShip', '100'),
  ('email',     'hola@solaria.cu'),
  ('instagram', '@solaria.seca'),
  ('hours',     E'Lun – Vie · 9:00 – 18:00\nSábado · 9:00 – 14:00\nDomingo · el sol descansa'),
  ('heroPromo', ''),
  ('heroPromo', ''),
  ('currencyBase', 'CUP'),
  ('rateCUP',      '250'),
  ('rateEUR',      '0.92'),
  -- Remitente de los emails. Se lee SIEMPRE desde aquí dentro de la
  -- Edge Function, nunca desde el navegador. Debe ser una dirección
  -- VERIFICADA en Brevo (SMTP & API → Senders). Si cambias el remitente,
  -- verifica la nueva dirección en Brevo antes de enviar (NEWSLETTER_SETUP.md).
  ('newsletter_from', 'solaria024@gmail.com')
on conflict (key) do nothing;

insert into public.products
  (slug, name, category_id, description, origin, rating, reviews, badge, image, active, sort_order)
values
  ('mango',
   'Mango Ataulfo',
   (select id from public.categories where slug = 'frutas'),
   'Láminas dulces y chiclosas, sin azúcar añadida. El favorito de la casa.',
   'Nayarit', 4.9, 312, 'Más vendido', 'https://picsum.photos/seed/mango-seco/600/600', true, 1),
  ('pina',
   'Piña Golden',
   (select id from public.categories where slug = 'frutas'),
   'Trozos con acidez brillante, perfectos para snack y repostería.',
   'Veracruz', 4.7, 198, null, 'https://picsum.photos/seed/pina-seca/600/600', true, 2),
  ('manzana',
   'Manzana y Canela',
   (select id from public.categories where slug = 'frutas'),
   'Láminas crujientes espolvoreadas con canela de verdad.',
   'Chihuahua', 4.8, 251, null, 'https://picsum.photos/seed/manzana-seca/600/600', true, 3),
  ('tomate',
   'Tomate Seco',
   (select id from public.categories where slug = 'verduras'),
   'Mitades intensas para pastas, antipasti y aceites aromatizados.',
   'Sinaloa', 4.9, 289, 'Favorito', 'https://picsum.photos/seed/tomate-seco/600/600', true, 4),
  ('chile',
   'Chile Ancho',
   (select id from public.categories where slug = 'verduras'),
   'Secado tradicional para guisos, moles y salsas con cuerpo.',
   'Zacatecas', 4.7, 122, null, 'https://picsum.photos/seed/chile-ancho/600/600', true, 5),
  ('mix',
   'Mix Senderista',
   (select id from public.categories where slug = 'mixes'),
   'Mango, arándano, almendra y pepita. Energía de montaña.',
   'Casa Solaria', 4.9, 341, 'Nuevo', 'https://picsum.photos/seed/trail-mix/600/600', true, 6)
on conflict (slug) do nothing;

insert into public.variants (product_id, weight, label, price)
select p.id, v.weight, v.label, v.price
from (values
  ('mango',   '50',  '50 g',   27),
  ('mango',   '100', '100 g',  45),
  ('mango',   '250', '250 g',  99),
  ('pina',    '50',  '50 g',   25),
  ('pina',    '100', '100 g',  42),
  ('pina',    '250', '250 g',  92),
  ('manzana', '50',  '50 g',   23),
  ('manzana', '100', '100 g',  38),
  ('manzana', '250', '250 g',  84),
  ('tomate',  '50',  '50 g',   33),
  ('tomate',  '100', '100 g',  55),
  ('tomate',  '250', '250 g',  121),
  ('chile',   '50',  '50 g',   24),
  ('chile',   '100', '100 g',  40),
  ('chile',   '250', '250 g',  88),
  ('mix',     '50',  '50 g',   37),
  ('mix',     '100', '100 g',  62),
  ('mix',     '250', '250 g',  136)
) as v(product_slug, weight, label, price)
join public.products p on p.slug = v.product_slug;