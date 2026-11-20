-- Generic Items for Stock Manager. Every business defines its OWN item categories, and each category defines the extra fields
-- its items ask for (a luggage shop: Sizes, Colour, Warranty; a pharmacy: Strength, Expiry; anything else). Nothing here knows
-- what a business sells.
--
-- An item with a photo, a selling price and a category is also published on the business's own website through
-- public.website_products(owner): the business id in, that business's items out. Its first columns match the old Finance
-- function (id, name, category, price, original_price, stock, image, description) so an existing site keeps working with only
-- its data URL changed; the rest (details, images) are extra. Additive and safe to run more than once.
begin;

-- One row per category a business has made. website_key is the short word a website filters on (e.g. luggage); fields is the
-- list of extra inputs for that category's items: [{"key": "sizes", "label": "Sizes", "long": false}, ...]
create table if not exists stock.item_categories (
  id          varchar(36) primary key default gen_random_uuid()::text,
  company_id  varchar(36) not null,
  name        varchar(100) not null,
  website_key varchar(60) not null,
  fields      jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  unique (company_id, website_key)
);

create table if not exists stock.items (
  id             varchar(36) primary key default gen_random_uuid()::text,
  company_id     varchar(36) not null,
  category_id    varchar(36) not null references stock.item_categories(id) on delete restrict,
  name           varchar(255) not null,
  selling_price  double precision check (selling_price is null or selling_price >= 0),
  original_price double precision check (original_price is null or original_price >= 0),
  quantity       integer not null default 0 check (quantity >= 0),
  image_url      text,                              -- the main photo
  extra_images   text[] not null default '{}',      -- more photos after it
  description    text,
  attributes     jsonb not null default '{}',       -- values for the category's fields, keyed by field key
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_items_company_id on stock.items (company_id);
create index if not exists idx_item_categories_company_id on stock.item_categories (company_id);

-- same rule as every other stock table: members of that business with Stock Manager only
do $$
declare t text;
begin
  foreach t in array array['item_categories', 'items'] loop
    execute format('alter table stock.%I enable row level security', t);
    execute format('drop policy if exists portal_member_all on stock.%I', t);
    execute format($p$create policy portal_member_all on stock.%I for all to authenticated
      using (core.has_service_access(company_id::uuid, 'stock')) with check (core.has_service_access(company_id::uuid, 'stock'))$p$, t);
    execute format('grant select, insert, update, delete on stock.%I to authenticated', t);
  end loop;
end $$;

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

-- What a website may read: only the public fields of one business's items - never a cost, SKU or anything from the books.
-- An item with no photo or no selling price is left out (a site cannot show it); it appears by itself once it has both.
-- details is the item's filled-in fields in the category's order, as [{"label": "Sizes", "value": "20-inch"}, ...];
-- images is every photo, the main one first. Runs as the function's owner so the site needs no login, only the business id.
create or replace function public.website_products(p_owner uuid)
returns table (
  id uuid, name text, category text, price numeric, original_price numeric, stock integer, image text, description text,
  category_name text, details jsonb, images text[]
)
language sql stable security definer set search_path = ''
as $$
  select i.id::uuid, i.name::text, c.website_key::text, i.selling_price::numeric, i.original_price::numeric,
         greatest(i.quantity, 0), i.image_url, left(coalesce(i.description, ''), 255),
         c.name::text,
         coalesce((
           select jsonb_agg(jsonb_build_object('label', f.field ->> 'label', 'value', i.attributes ->> (f.field ->> 'key')) order by f.ord)
           from jsonb_array_elements(c.fields) with ordinality as f(field, ord)
           where coalesce(i.attributes ->> (f.field ->> 'key'), '') <> ''
         ), '[]'::jsonb),
         array_prepend(i.image_url, i.extra_images)
  from stock.items i
  join stock.item_categories c on c.id = i.category_id
  where i.company_id = p_owner::text
    and coalesce(i.image_url, '') <> ''
    and i.selling_price > 0
  order by i.created_at, i.id
$$;
revoke all on function public.website_products(uuid) from public;
grant execute on function public.website_products(uuid) to anon, authenticated;

commit;
notify pgrst, 'reload schema';
