-- Generic Items for Stock Manager (suitcases, kitchenware, anything that is not a vehicle or a spare part), whose photo, price and category put it on the
-- website, and the public feed a business's own website reads (All In One Abroad -> allinoneabroad.com).
-- public.website_products(owner) keeps the SAME name, argument and first columns as the old Finance function, so the website
-- only needs its data URL and anon key changed; the item's brand, colour, sizes, warranty, features and all photos come in the same rows. Additive and safe to run more than once.
begin;

create table if not exists stock.items (
  id              varchar(36) primary key default gen_random_uuid()::text,
  company_id      varchar(36) not null,
  name            varchar(255) not null,
  category        varchar(100),
  selling_price   double precision check (selling_price is null or selling_price >= 0),
  original_price  double precision check (original_price is null or original_price >= 0),
  quantity        integer not null default 0 check (quantity >= 0),
  image_url       text,
  description     text,
  brand           varchar(100),
  color           varchar(100),
  item_type       varchar(50),     -- e.g. "Full Set", shown on the product page
  warranty        varchar(100),    -- e.g. "3 Year International Warranty"
  sizes           varchar(255),    -- e.g. "20-inch / 24-inch / 28-inch"
  features        text,            -- key features, one per line
  extra_images    text[] not null default '{}',  -- more photos after the main one (image_url)
  website_category varchar(20) check (website_category in ('luggage', 'kitchen', 'appliances')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_items_company_id on stock.items (company_id);

-- same rule as every other stock table: members of that business with Stock Manager only
alter table stock.items enable row level security;
drop policy if exists portal_member_all on stock.items;
create policy portal_member_all on stock.items for all to authenticated
  using (core.has_service_access(company_id::uuid, 'stock')) with check (core.has_service_access(company_id::uuid, 'stock'));
grant select, insert, update, delete on stock.items to authenticated;

-- Item photos: a public bucket, one folder per business (its id), writable only by that business's Stock members
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists item_photos_select_public on storage.objects;
create policy item_photos_select_public on storage.objects for select using (bucket_id = 'item-photos');

drop policy if exists item_photos_insert_member on storage.objects;
create policy item_photos_insert_member on storage.objects for insert to authenticated with check (
  bucket_id = 'item-photos'
  and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
           then core.has_service_access(((storage.foldername(name))[1])::uuid, 'stock') else false end);

drop policy if exists item_photos_delete_member on storage.objects;
create policy item_photos_delete_member on storage.objects for delete to authenticated using (
  bucket_id = 'item-photos'
  and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
           then core.has_service_access(((storage.foldername(name))[1])::uuid, 'stock') else false end);

-- What the website may read: only the public fields of one business's items - never a cost, SKU or anything
-- from the books. An item with no photo, no website category or no selling price is left out (the site cannot show it).
-- Runs as the function's owner so the site needs no login, only the business id.
create or replace function public.website_products(p_owner uuid)
returns table (
  id uuid, name text, category text, price numeric, original_price numeric, stock integer, image text, description text,
  brand text, color text, item_type text, warranty text, sizes text, features text, images text[]
)
language sql stable security definer set search_path = ''
as $$
  select i.id::uuid, i.name::text, i.website_category::text, i.selling_price::numeric, i.original_price::numeric,
         greatest(i.quantity, 0), i.image_url, left(coalesce(i.description, ''), 255),
         i.brand::text, i.color::text, i.item_type::text, i.warranty::text, i.sizes::text, i.features,
         array_prepend(i.image_url, i.extra_images)
  from stock.items i
  where i.company_id = p_owner::text
    and i.website_category is not null
    and coalesce(i.image_url, '') <> ''
    and i.selling_price > 0
  order by i.created_at, i.id
$$;
revoke all on function public.website_products(uuid) from public;
grant execute on function public.website_products(uuid) to anon, authenticated;

commit;
notify pgrst, 'reload schema';
