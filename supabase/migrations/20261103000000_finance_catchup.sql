-- Catch-up: what the legacy project gained after the 2026-10-30 snapshot. Additive and re-runnable.

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION finance.offer_prizes_public(p_owner uuid) RETURNS TABLE(name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'finance'
    AS $$
  select name from finance.offer_prizes
  where owner_id = p_owner and stock > 0 and weight > 0
  order by created_at, id
$$;

CREATE OR REPLACE FUNCTION finance.record_visit(p_owner uuid, p_visitor text, p_path text, p_referrer text, p_device text, p_view uuid DEFAULT NULL::uuid, p_seconds integer DEFAULT 0) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'finance'
    AS $$
declare
  v_seconds integer := least(greatest(coalesce(p_seconds, 0), 0), 14400);
begin
  if not exists (select 1 from finance.profiles where id = p_owner) then
    return;
  end if;
  insert into finance.site_visits as sv (owner_id, visitor, path, referrer, device, view_id, seconds)
  values (
    p_owner,
    left(coalesce(nullif(btrim(p_visitor), ''), 'unknown'), 64),
    left(coalesce(nullif(btrim(p_path), ''), '/'), 200),
    nullif(left(btrim(coalesce(p_referrer, '')), 120), ''),
    case when p_device in ('mobile', 'tablet') then p_device else 'desktop' end,
    p_view,
    case when p_view is null then 0 else least(v_seconds, 120) end
  )
  on conflict (owner_id, view_id) where view_id is not null do update
    set seconds = greatest(sv.seconds, least(v_seconds, extract(epoch from now() - sv.created_at)::integer + 5));
end $$;

CREATE OR REPLACE FUNCTION finance.spin_wheel(p_owner uuid, p_name text, p_phone text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'finance'
    AS $$
declare
  v_name  text := left(btrim(coalesce(p_name, '')), 80);
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_total numeric;
  v_pick  numeric;
  v_acc   numeric := 0;
  v_prize record;
begin
  if length(v_name) < 2 or length(v_phone) < 7 or length(v_phone) > 15 then
    return jsonb_build_object('ok', false, 'message', 'Enter your name and mobile number.');
  end if;
  if not exists (select 1 from finance.profiles where id = p_owner) then
    return jsonb_build_object('ok', false, 'message', 'This offer is not available.');
  end if;
  if exists (select 1 from finance.offer_spins where owner_id = p_owner and phone = v_phone) then
    return jsonb_build_object('ok', false, 'message', 'This number has already spun the wheel.');
  end if;

  -- Lock the prizes in stock so concurrent spins queue up instead of both taking the last one.
  select coalesce(sum(weight), 0) into v_total
    from (select weight from finance.offer_prizes where owner_id = p_owner and stock > 0 and weight > 0 for update) t;
  if v_total <= 0 then
    return jsonb_build_object('ok', false, 'message', 'All the prizes have been won. Thank you!');
  end if;

  v_pick := random() * v_total;
  for v_prize in
    select id, name, weight from finance.offer_prizes
    where owner_id = p_owner and stock > 0 and weight > 0 order by created_at, id
  loop
    v_acc := v_acc + v_prize.weight;
    if v_pick < v_acc then
      update finance.offer_prizes set stock = stock - 1 where id = v_prize.id;
      insert into finance.offer_spins (owner_id, name, phone, prize) values (p_owner, v_name, v_phone, v_prize.name);
      return jsonb_build_object('ok', true, 'prize', v_prize.name);
    end if;
  end loop;
  return jsonb_build_object('ok', false, 'message', 'Please try again.');
exception when unique_violation then
  return jsonb_build_object('ok', false, 'message', 'This number has already spun the wheel.');
end $$;

CREATE OR REPLACE FUNCTION finance.visits_list(p_from timestamp with time zone, p_to timestamp with time zone, p_limit integer DEFAULT 100) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'finance'
    AS $$
  with v as (
    select id, visitor, path, referrer, device, created_at, seconds,
           lag(created_at + seconds * interval '1 second') over (partition by visitor order by created_at, id) as prev_end
      from finance.site_visits
     where owner_id = finance.finance_current_owner() and created_at >= p_from and created_at < p_to
  ),
  s as (
    select *,
           sum(case when prev_end is null or created_at - prev_end > interval '30 minutes' then 1 else 0 end)
             over (partition by visitor order by created_at, id) as n
      from v
  ),
  g as (
    select visitor, n,
           min(created_at) as started_at,
           sum(seconds)::integer as seconds,
           (array_agg(device order by created_at, id))[1] as device,
           (array_agg(referrer order by created_at, id))[1] as referrer,
           jsonb_agg(jsonb_build_object('path', path, 'at', created_at, 'seconds', seconds) order by created_at, id) as pages
      from s
     group by visitor, n
  )
  select jsonb_build_object(
    'sessions', (select count(*) from g),
    'avg_seconds', coalesce((select round(avg(seconds)) from g where seconds > 0), 0),
    'visits', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.started_at desc)
        from (select visitor, started_at, seconds, device, referrer, pages
                from g order by started_at desc
               limit greatest(1, least(coalesce(p_limit, 100), 500))) t
    ), '[]'::jsonb)
  )
$$;

CREATE OR REPLACE FUNCTION finance.visits_summary(p_from timestamp with time zone, p_to timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'finance'
    AS $$
  with v as (
    select * from finance.site_visits
    where owner_id = finance.finance_current_owner() and created_at >= p_from and created_at < p_to
  )
  select jsonb_build_object(
    'visits', (select count(*) from v),
    'visitors', (select count(distinct visitor) from v),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('name', path, 'count', n) order by n desc)
      from (select path, count(*) n from v group by path order by n desc limit 8) t), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(jsonb_build_object('name', r, 'count', n) order by n desc)
      from (select coalesce(referrer, 'Direct') r, count(*) n from v group by 1 order by n desc limit 8) t), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('name', device, 'count', n) order by n desc)
      from (select device, count(*) n from v group by device) t), '[]'::jsonb),
    'days', coalesce((select jsonb_agg(jsonb_build_object('name', d::text, 'count', n) order by d)
      from (select (created_at at time zone 'Asia/Kathmandu')::date d, count(*) n from v group by 1) t), '[]'::jsonb)
  )
$$;

CREATE OR REPLACE FUNCTION finance.website_products(p_owner uuid) RETURNS TABLE(id uuid, name text, category text, price numeric, original_price numeric, stock integer, image text, description text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'finance'
    AS $$
  select
    p.id,
    p.name,
    p.website_category,
    p.price,
    p.original_price,
    greatest(floor(p.stock_level), 0)::integer,
    p.image_url,
    left(coalesce(p.description, ''), 255)
  from finance.products p
  where p.owner_id = p_owner
    and p.is_active
    and p.show_on_website
    and p.website_category is not null
    and coalesce(p.image_url, '') <> ''
    and p.price > 0
  order by p.created_at, p.id
$$;

CREATE TABLE IF NOT EXISTS finance.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    phone text,
    address text,
    source text DEFAULT 'walk_in'::text NOT NULL,
    source_note text,
    interested_in text,
    status text DEFAULT 'new'::text NOT NULL,
    follow_up_on date,
    history jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_id uuid,
    CONSTRAINT leads_source_check CHECK ((source = ANY (ARRAY['walk_in'::text, 'website'::text, 'facebook'::text, 'tiktok'::text, 'referral'::text, 'other'::text]))),
    CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'interested'::text, 'converted'::text, 'lost'::text])))
);

CREATE TABLE IF NOT EXISTS finance.offer_prizes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    weight numeric DEFAULT 1 NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT offer_prizes_stock_check CHECK ((stock >= 0)),
    CONSTRAINT offer_prizes_weight_check CHECK ((weight >= (0)::numeric))
);

CREATE TABLE IF NOT EXISTS finance.offer_spins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    prize text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

alter table finance.products add column if not exists show_on_website boolean DEFAULT false NOT NULL;

alter table finance.products add column if not exists website_category text;

alter table finance.products add column if not exists image_url text;

alter table finance.products add column if not exists description text;

alter table finance.products add column if not exists original_price numeric;

CREATE TABLE IF NOT EXISTS finance.site_visits (
    id bigint NOT NULL,
    owner_id uuid NOT NULL,
    visitor text NOT NULL,
    path text NOT NULL,
    referrer text,
    device text DEFAULT 'desktop'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    view_id uuid,
    seconds integer DEFAULT 0 NOT NULL,
    CONSTRAINT site_visits_device_check CHECK ((device = ANY (ARRAY['mobile'::text, 'tablet'::text, 'desktop'::text]))),
    CONSTRAINT site_visits_seconds_check CHECK ((seconds >= 0))
);

ALTER TABLE finance.site_visits ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finance.site_visits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE ONLY finance.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY finance.offer_prizes
    ADD CONSTRAINT offer_prizes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY finance.offer_spins
    ADD CONSTRAINT offer_spins_owner_id_phone_key UNIQUE (owner_id, phone);

ALTER TABLE ONLY finance.offer_spins
    ADD CONSTRAINT offer_spins_pkey PRIMARY KEY (id);

ALTER TABLE ONLY finance.site_visits
    ADD CONSTRAINT site_visits_pkey PRIMARY KEY (id);

CREATE INDEX IF NOT EXISTS leads_owner_status_idx ON finance.leads USING btree (owner_id, status);

CREATE INDEX IF NOT EXISTS site_visits_owner_time_idx ON finance.site_visits USING btree (owner_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS site_visits_view_idx ON finance.site_visits USING btree (owner_id, view_id) WHERE (view_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS site_visits_visitor_idx ON finance.site_visits USING btree (owner_id, visitor, created_at);

DROP TRIGGER IF EXISTS leads_stamp_owner ON finance.leads;
CREATE TRIGGER leads_stamp_owner BEFORE INSERT ON finance.leads FOR EACH ROW EXECUTE FUNCTION finance.finance_stamp_owner();

DROP TRIGGER IF EXISTS leads_touch ON finance.leads;
CREATE TRIGGER leads_touch BEFORE UPDATE ON finance.leads FOR EACH ROW EXECUTE FUNCTION finance.finance_touch_updated_at();

DROP TRIGGER IF EXISTS offer_prizes_stamp_owner ON finance.offer_prizes;
CREATE TRIGGER offer_prizes_stamp_owner BEFORE INSERT ON finance.offer_prizes FOR EACH ROW EXECUTE FUNCTION finance.finance_stamp_owner();

DROP TRIGGER IF EXISTS offer_prizes_touch ON finance.offer_prizes;
CREATE TRIGGER offer_prizes_touch BEFORE UPDATE ON finance.offer_prizes FOR EACH ROW EXECUTE FUNCTION finance.finance_touch_updated_at();

ALTER TABLE ONLY finance.leads
    ADD CONSTRAINT leads_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES finance.customers(id) ON DELETE SET NULL;

ALTER TABLE ONLY finance.leads
    ADD CONSTRAINT leads_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES core.organizations(id);

ALTER TABLE ONLY finance.offer_prizes
    ADD CONSTRAINT offer_prizes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES core.organizations(id);

ALTER TABLE ONLY finance.offer_spins
    ADD CONSTRAINT offer_spins_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES core.organizations(id);

ALTER TABLE ONLY finance.site_visits
    ADD CONSTRAINT site_visits_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES core.organizations(id);

ALTER TABLE finance.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_owner ON finance.leads;
CREATE POLICY leads_owner ON finance.leads USING ((owner_id = finance.finance_current_owner())) WITH CHECK ((owner_id = finance.finance_current_owner()));

ALTER TABLE finance.offer_prizes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS offer_prizes_owner ON finance.offer_prizes;
CREATE POLICY offer_prizes_owner ON finance.offer_prizes USING ((owner_id = finance.finance_current_owner())) WITH CHECK ((owner_id = finance.finance_current_owner()));

ALTER TABLE finance.offer_spins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS offer_spins_owner_delete ON finance.offer_spins;
CREATE POLICY offer_spins_owner_delete ON finance.offer_spins FOR DELETE USING ((owner_id = finance.finance_current_owner()));

DROP POLICY IF EXISTS offer_spins_owner_read ON finance.offer_spins;
CREATE POLICY offer_spins_owner_read ON finance.offer_spins FOR SELECT USING ((owner_id = finance.finance_current_owner()));

ALTER TABLE finance.site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_visits_owner_read ON finance.site_visits;
CREATE POLICY site_visits_owner_read ON finance.site_visits FOR SELECT USING ((owner_id = finance.finance_current_owner()));
