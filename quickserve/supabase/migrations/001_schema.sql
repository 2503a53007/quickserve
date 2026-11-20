-- ============================================================================
-- QuickServe 001 — Core schema
-- Tables, enums, constraints, indexes, triggers, helper functions.
-- RLS + grants live in 002_rls.sql. Seed data lives in 004_seed.sql.
-- Requires only built-in Postgres + btree_gist (available on Supabase).
-- ============================================================================

create extension if not exists btree_gist;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type user_role as enum ('customer', 'provider', 'company', 'admin');
create type verification_status as enum ('pending', 'verified', 'rejected', 'suspended');
create type booking_status as enum (
  'pending', 'confirmed', 'provider_assigned', 'provider_travelling',
  'provider_arrived', 'in_progress', 'completed', 'cancelled', 'rejected'
);
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
create type payment_method as enum ('cash', 'upi');
create type refund_status as enum ('requested', 'under_review', 'approved', 'processing', 'completed', 'rejected');
create type otp_purpose as enum ('start_service', 'end_service');
create type ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type notification_type as enum (
  'booking_confirmed', 'provider_accepted', 'provider_assigned', 'provider_travelling',
  'provider_arriving', 'provider_arrived', 'service_started', 'service_completed',
  'payment_received', 'new_offer', 'refund_update', 'booking_cancelled',
  'service_otp', 'extra_hours', 'delay', 'ticket_update', 'verification', 'booking_request', 'general'
);

-- ----------------------------------------------------------------------------
-- Generic helpers
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Great-circle distance in km (no PostGIS dependency)
create or replace function distance_km(lat1 double precision, lng1 double precision,
                                       lat2 double precision, lng2 double precision)
returns double precision language sql immutable parallel safe as $$
  select 6371.0088 * 2 * asin(least(1.0, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))
$$;

-- ----------------------------------------------------------------------------
-- users  (1:1 with auth.users). `role` is authoritative HERE, never in JWT metadata.
-- ----------------------------------------------------------------------------
create table users (
  id                uuid primary key references auth.users (id) on delete cascade,
  role              user_role not null default 'customer',
  full_name         text check (full_name is null or char_length(full_name) between 2 and 100),
  mobile            text unique check (mobile is null or mobile ~ '^\+[1-9][0-9]{7,14}$'),
  email             text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  avatar_url        text,
  is_active         boolean not null default true,
  profile_completed boolean not null default false,
  signup_intent     text check (signup_intent in ('customer', 'provider', 'company')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_users_role on users (role);
create index idx_users_email on users (lower(email));
create trigger trg_users_updated before update on users for each row execute function set_updated_at();

create table customer_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references users (id) on delete cascade,
  referral_code   text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  referred_by     uuid references users (id) on delete set null,
  preferred_city  text,
  preferred_pin   text,
  preferred_lat   double precision check (preferred_lat is null or preferred_lat between -90 and 90),
  preferred_lng   double precision check (preferred_lng is null or preferred_lng between -180 and 180),
  total_bookings  int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_customer_profiles_updated before update on customer_profiles for each row execute function set_updated_at();

-- Companies first (providers reference them as workers)
create table company_profiles (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references users (id) on delete cascade,
  company_name         text not null check (char_length(company_name) between 2 and 120),
  owner_name           text,
  logo_url             text,
  description          text,
  business_reg_number  text,
  gstin                text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  contact_email        text,
  contact_phone        text,
  address              text,
  city                 text,
  state                text,
  pin_code             text check (pin_code is null or pin_code ~ '^[1-9][0-9]{5}$'),
  latitude             double precision check (latitude is null or latitude between -90 and 90),
  longitude            double precision check (longitude is null or longitude between -180 and 180),
  service_radius_km    numeric(5,1) not null default 15 check (service_radius_km between 1 and 100),
  service_locations    text[] not null default '{}',
  team_size            int not null default 1 check (team_size >= 1),
  working_days         int[] not null default '{1,2,3,4,5,6}',
  working_start        time not null default '08:00',
  working_end          time not null default '20:00',
  is_online            boolean not null default true,
  verification_status  verification_status not null default 'pending',
  verification_notes   text,
  average_rating       numeric(3,2) not null default 0 check (average_rating between 0 and 5),
  total_reviews        int not null default 0,
  total_jobs           int not null default 0,
  bank_account_name    text,
  bank_account_number  text,
  bank_ifsc            text check (bank_ifsc is null or bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  upi_id               text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_company_city_status on company_profiles (city, verification_status);
create index idx_company_geo on company_profiles (latitude, longitude);
create trigger trg_company_updated before update on company_profiles for each row execute function set_updated_at();

create table provider_profiles (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references users (id) on delete cascade,
  company_id           uuid references company_profiles (id) on delete cascade, -- non-null => company worker
  display_name         text,
  bio                  text,
  skills               text[] not null default '{}',
  experience_years     int not null default 0 check (experience_years between 0 and 60),
  govt_id_type         text check (govt_id_type in ('aadhaar', 'pan', 'driving_license', 'voter_id', 'passport')),
  govt_id_last4        text check (govt_id_last4 is null or govt_id_last4 ~ '^[0-9A-Za-z]{4}$'),
  address              text,
  city                 text,
  state                text,
  pin_code             text check (pin_code is null or pin_code ~ '^[1-9][0-9]{5}$'),
  latitude             double precision check (latitude is null or latitude between -90 and 90),
  longitude            double precision check (longitude is null or longitude between -180 and 180),
  service_radius_km    numeric(5,1) not null default 15 check (service_radius_km between 1 and 100),
  is_online            boolean not null default false,
  hourly_rate          numeric(10,2) check (hourly_rate is null or hourly_rate >= 0),
  visiting_charge      numeric(10,2) not null default 0 check (visiting_charge >= 0),
  verification_status  verification_status not null default 'pending',
  verification_notes   text,
  average_rating       numeric(3,2) not null default 0 check (average_rating between 0 and 5),
  total_reviews        int not null default 0,
  total_jobs           int not null default 0,
  bank_account_name    text,
  bank_account_number  text,
  bank_ifsc            text check (bank_ifsc is null or bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  upi_id               text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_provider_company on provider_profiles (company_id);
create index idx_provider_discovery on provider_profiles (verification_status, is_online, city);
create index idx_provider_geo on provider_profiles (latitude, longitude);
create trigger trg_provider_updated before update on provider_profiles for each row execute function set_updated_at();

create table company_employees (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company_profiles (id) on delete cascade,
  provider_id uuid not null unique references provider_profiles (id) on delete cascade,
  job_title   text not null default 'Technician',
  employee_code text,
  is_active   boolean not null default true,
  joined_at   timestamptz not null default now(),
  unique (company_id, employee_code)
);
create index idx_company_employees_company on company_employees (company_id);

create table provider_documents (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid references provider_profiles (id) on delete cascade,
  company_id   uuid references company_profiles (id) on delete cascade,
  doc_type     text not null check (doc_type in ('government_id', 'address_proof', 'business_registration', 'gst_certificate', 'trade_license', 'other')),
  storage_path text not null,           -- private bucket path; access via signed URL only
  status       verification_status not null default 'pending',
  reviewed_by  uuid references users (id) on delete set null,
  review_notes text,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  check ((provider_id is not null) <> (company_id is not null))
);
create index idx_provider_documents_provider on provider_documents (provider_id);
create index idx_provider_documents_company on provider_documents (company_id);

create table provider_photos (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid references provider_profiles (id) on delete cascade,
  company_id  uuid references company_profiles (id) on delete cascade,
  url         text not null,
  caption     text,
  created_at  timestamptz not null default now(),
  check ((provider_id is not null) <> (company_id is not null))
);
create index idx_provider_photos_provider on provider_photos (provider_id);
create index idx_provider_photos_company on provider_photos (company_id);

create table provider_availability (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles (id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time  time not null,
  end_time    time not null,
  is_working  boolean not null default true,
  unique (provider_id, day_of_week),
  check (end_time > start_time)
);

-- ----------------------------------------------------------------------------
-- Catalogue
-- ----------------------------------------------------------------------------
create table service_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description text,
  icon        text not null default 'Wrench',        -- lucide icon name
  gradient_from text not null default '#F97316',
  gradient_to   text not null default '#EA580C',
  image_url   text,
  is_emergency boolean not null default false,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_categories_active on service_categories (is_active, sort_order);
create trigger trg_categories_updated before update on service_categories for each row execute function set_updated_at();

create table services (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references service_categories (id) on delete cascade,
  name          text not null,
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description   text,
  default_first_hour_price      numeric(10,2) not null check (default_first_hour_price >= 0),
  default_additional_hour_price numeric(10,2) not null check (default_additional_hour_price >= 0),
  default_visiting_charge       numeric(10,2) not null default 0 check (default_visiting_charge >= 0),
  is_emergency  boolean not null default false,
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_services_category on services (category_id, is_active, sort_order);
create trigger trg_services_updated before update on services for each row execute function set_updated_at();

-- Per-provider / per-company pricing for a given service
create table service_pricing (
  id                    uuid primary key default gen_random_uuid(),
  service_id            uuid not null references services (id) on delete cascade,
  provider_id           uuid references provider_profiles (id) on delete cascade,
  company_id            uuid references company_profiles (id) on delete cascade,
  first_hour_price      numeric(10,2) not null check (first_hour_price >= 0),
  additional_hour_price numeric(10,2) not null check (additional_hour_price >= 0),
  visiting_charge       numeric(10,2) not null default 0 check (visiting_charge >= 0),
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check ((provider_id is not null) <> (company_id is not null))
);
create unique index uq_pricing_provider on service_pricing (service_id, provider_id) where provider_id is not null;
create unique index uq_pricing_company on service_pricing (service_id, company_id) where company_id is not null;
create index idx_pricing_service on service_pricing (service_id) where is_active;
create trigger trg_pricing_updated before update on service_pricing for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Addresses & live location
-- ----------------------------------------------------------------------------
create table addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  label      text not null default 'Home' check (label in ('Home', 'Office', 'Other')),
  line1      text not null check (char_length(line1) between 3 and 200),
  line2      text,
  landmark   text,
  city       text not null,
  state      text not null,
  pin_code   text not null check (pin_code ~ '^[1-9][0-9]{5}$'),
  latitude   double precision check (latitude is null or latitude between -90 and 90),
  longitude  double precision check (longitude is null or longitude between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_addresses_user on addresses (user_id);
create unique index uq_addresses_default on addresses (user_id) where is_default;
create trigger trg_addresses_updated before update on addresses for each row execute function set_updated_at();

-- One current row per provider; deleted when job ends (privacy)
create table provider_locations (
  provider_id uuid primary key references provider_profiles (id) on delete cascade,
  booking_id  uuid,
  latitude    double precision not null check (latitude between -90 and 90),
  longitude   double precision not null check (longitude between -180 and 180),
  heading     numeric(5,2),
  speed_kmph  numeric(6,2),
  accuracy_m  numeric(8,2),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Coupons / settings / areas
-- ----------------------------------------------------------------------------
create table coupons (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,20}$'),
  title                 text not null,
  description           text,
  coupon_type           text not null default 'general' check (coupon_type in ('general', 'first_booking', 'festival', 'seasonal', 'referral')),
  discount_type         text not null check (discount_type in ('percentage', 'fixed')),
  discount_value        numeric(10,2) not null check (discount_value > 0),
  min_order_amount      numeric(10,2) not null default 0,
  max_discount_amount   numeric(10,2),
  usage_limit           int check (usage_limit is null or usage_limit > 0),
  per_user_limit        int not null default 1 check (per_user_limit > 0),
  usage_count           int not null default 0,
  valid_from            timestamptz not null default now(),
  valid_until           timestamptz not null,
  is_active             boolean not null default true,
  first_booking_only    boolean not null default false,
  applicable_category_ids uuid[],
  restricted_user_id    uuid references users (id) on delete cascade,
  created_by            uuid references users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (discount_type <> 'percentage' or discount_value <= 100),
  check (valid_until > valid_from)
);
create index idx_coupons_active on coupons (is_active, valid_until);
create trigger trg_coupons_updated before update on coupons for each row execute function set_updated_at();

create table platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table platform_commissions (
  id                 uuid primary key default gen_random_uuid(),
  category_id        uuid references service_categories (id) on delete cascade, -- null => platform default
  commission_percent numeric(5,2) not null check (commission_percent between 0 and 60),
  is_active          boolean not null default true,
  created_by         uuid references users (id) on delete set null,
  created_at         timestamptz not null default now()
);
create unique index uq_commission_category on platform_commissions (category_id) where category_id is not null and is_active;
create unique index uq_commission_default on platform_commissions ((true)) where category_id is null and is_active;

-- Admin-configurable arrival commitments per service area
create table service_areas (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  city               text not null,
  state              text,
  pin_prefixes       text[] not null default '{}',        -- e.g. {'5600','5601'}
  center_lat         double precision not null check (center_lat between -90 and 90),
  center_lng         double precision not null check (center_lng between -180 and 180),
  radius_km          numeric(6,1) not null default 25 check (radius_km > 0),
  avg_speed_kmph     numeric(5,1) not null default 22 check (avg_speed_kmph between 5 and 80),
  prep_minutes       int not null default 5 check (prep_minutes >= 0),
  buffer_minutes     int not null default 10 check (buffer_minutes >= 0),
  min_lead_minutes   int not null default 45 check (min_lead_minutes >= 0),
  max_arrival_minutes int not null default 90 check (max_arrival_minutes > 0),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_service_areas_active on service_areas (is_active, city);
create trigger trg_service_areas_updated before update on service_areas for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Bookings
-- ----------------------------------------------------------------------------
create sequence booking_code_seq start 1000;
create sequence invoice_number_seq start 1;
create sequence ticket_number_seq start 1000;

create table bookings (
  id               uuid primary key default gen_random_uuid(),
  booking_code     text not null unique default ('QS' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || lpad(nextval('booking_code_seq')::text, 5, '0')),
  customer_id      uuid not null references users (id),
  provider_id      uuid references provider_profiles (id) on delete set null,
  company_id       uuid references company_profiles (id) on delete set null,
  service_id       uuid not null references services (id),
  category_id      uuid not null references service_categories (id),
  status           booking_status not null default 'pending',
  booking_mode     text not null default 'scheduled' check (booking_mode in ('asap', 'scheduled')),

  scheduled_start  timestamptz not null,
  scheduled_end    timestamptz not null,
  estimated_hours  numeric(4,1) not null check (estimated_hours between 1 and 12),
  extra_hours_approved numeric(4,1) not null default 0 check (extra_hours_approved >= 0),
  actual_hours     numeric(5,2),
  billed_hours     numeric(4,1),
  slot             tstzrange generated always as (tstzrange(scheduled_start, scheduled_end)) stored,

  issue_description text check (issue_description is null or char_length(issue_description) <= 2000),
  address_id       uuid references addresses (id) on delete set null,
  address_line     text not null,
  address_city     text not null,
  address_state    text,
  address_pin      text not null check (address_pin ~ '^[1-9][0-9]{5}$'),
  address_lat      double precision check (address_lat is null or address_lat between -90 and 90),
  address_lng      double precision check (address_lng is null or address_lng between -180 and 180),

  -- price snapshot (server-calculated; provider price changes never alter an existing booking)
  first_hour_price      numeric(10,2) not null,
  additional_hour_price numeric(10,2) not null,
  visiting_charge       numeric(10,2) not null default 0,
  gst_percent           numeric(5,2) not null default 18,
  commission_percent    numeric(5,2) not null default 15,
  coupon_id        uuid references coupons (id) on delete set null,
  coupon_code      text,

  estimated_base      numeric(12,2) not null,
  estimated_discount  numeric(12,2) not null default 0,
  estimated_tax       numeric(12,2) not null,
  estimated_total     numeric(12,2) not null,

  material_cost       numeric(12,2) not null default 0 check (material_cost >= 0),
  spare_parts_cost    numeric(12,2) not null default 0 check (spare_parts_cost >= 0),
  final_base          numeric(12,2),
  final_discount      numeric(12,2),
  final_tax           numeric(12,2),
  final_total         numeric(12,2),
  commission_amount   numeric(12,2),
  provider_earning    numeric(12,2),

  -- ETA commitment
  eta_at              timestamptz,
  eta_latest_at       timestamptz,
  eta_distance_km     numeric(7,2),
  delay_notified_at   timestamptz,

  payment_method      payment_method not null default 'cash',
  payment_status      payment_status not null default 'pending',

  -- lifecycle timestamps
  confirmed_at   timestamptz,
  assigned_at    timestamptz,
  travelling_at  timestamptz,
  arrived_at     timestamptz,
  started_at     timestamptz,
  completed_at   timestamptz,
  cancelled_at   timestamptz,
  cancelled_by   uuid references users (id) on delete set null,
  cancellation_reason text,
  cancellation_fee    numeric(10,2) not null default 0,
  rejection_reason    text,
  provider_ack_deadline timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  check (scheduled_end > scheduled_start),
  check (provider_id is not null or company_id is not null),
  -- Hard guarantee: a provider can never hold overlapping live bookings.
  constraint no_provider_double_booking exclude using gist (provider_id with =, slot with &&)
    where (provider_id is not null and status in
      ('pending', 'confirmed', 'provider_assigned', 'provider_travelling', 'provider_arrived', 'in_progress'))
);
create index idx_bookings_customer on bookings (customer_id, created_at desc);
create index idx_bookings_provider on bookings (provider_id, scheduled_start);
create index idx_bookings_company on bookings (company_id, scheduled_start);
create index idx_bookings_status on bookings (status, scheduled_start);
create index idx_bookings_service on bookings (service_id);
create index idx_bookings_payment on bookings (payment_status);
create trigger trg_bookings_updated before update on bookings for each row execute function set_updated_at();

alter table provider_locations
  add constraint fk_provider_locations_booking foreign key (booking_id) references bookings (id) on delete set null;

-- Valid status transitions enforced at DB level (defence-in-depth; API also checks)
create or replace function enforce_booking_transition() returns trigger
language plpgsql as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if not (
    (old.status = 'pending'             and new.status in ('confirmed', 'provider_assigned', 'rejected', 'cancelled')) or
    (old.status = 'confirmed'           and new.status in ('provider_assigned', 'cancelled')) or
    (old.status = 'provider_assigned'   and new.status in ('provider_travelling', 'confirmed', 'cancelled')) or
    (old.status = 'provider_travelling' and new.status in ('provider_arrived', 'cancelled')) or
    (old.status = 'provider_arrived'    and new.status in ('in_progress', 'cancelled')) or
    (old.status = 'in_progress'         and new.status = 'completed')
  ) then
    raise exception 'INVALID_TRANSITION: % -> %', old.status, new.status using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_bookings_transition before update of status on bookings
  for each row execute function enforce_booking_transition();

-- Company capacity: concurrent live bookings can't exceed active, verified workers
create or replace function enforce_company_capacity() returns trigger
language plpgsql as $$
declare
  capacity int;
  busy int;
begin
  if new.company_id is null or new.status in ('cancelled', 'rejected', 'completed') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext(new.company_id::text));
  select count(*) into capacity from provider_profiles pp
    join company_employees ce on ce.provider_id = pp.id
   where ce.company_id = new.company_id and ce.is_active and pp.verification_status = 'verified';
  select count(*) into busy from bookings b
   where b.company_id = new.company_id and b.id <> new.id
     and b.status in ('pending', 'confirmed', 'provider_assigned', 'provider_travelling', 'provider_arrived', 'in_progress')
     and b.slot && new.slot;
  if busy >= capacity then
    raise exception 'COMPANY_CAPACITY: no free worker for this slot' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_bookings_company_capacity before insert on bookings
  for each row execute function enforce_company_capacity();

create table booking_photos (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings (id) on delete cascade,
  uploaded_by uuid not null references users (id),
  url         text not null,
  kind        text not null default 'issue' check (kind in ('issue', 'before', 'after')),
  created_at  timestamptz not null default now()
);
create index idx_booking_photos_booking on booking_photos (booking_id);

create table booking_status_history (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  status     booking_status not null,
  changed_by uuid references users (id) on delete set null,
  note       text,
  created_at timestamptz not null default now()
);
create index idx_booking_history_booking on booking_status_history (booking_id, created_at);

create table extra_hour_requests (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references bookings (id) on delete cascade,
  requested_by uuid not null references users (id),
  hours        numeric(3,1) not null check (hours between 0.5 and 8),
  reason       text not null check (char_length(reason) between 3 and 500),
  extra_amount numeric(12,2) not null,             -- incl. tax, shown to customer
  status       text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'expired')),
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index idx_extra_hours_booking on extra_hour_requests (booking_id, status);
create unique index uq_extra_hours_open on extra_hour_requests (booking_id) where status = 'requested';

-- ----------------------------------------------------------------------------
-- Service OTPs (start / end). Only a keyed hash is used for verification; an
-- AES-GCM encrypted copy lets the *customer* (only) view their own code.
-- ----------------------------------------------------------------------------
create table otp_verifications (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references bookings (id) on delete cascade,
  purpose       otp_purpose not null,
  customer_id   uuid not null references users (id),
  code_hash     text not null,
  code_enc      text not null,
  expires_at    timestamptz not null,
  attempts      int not null default 0,
  max_attempts  int not null default 5,
  resend_count  int not null default 0,
  verified_at   timestamptz,
  verified_by   uuid references users (id),
  created_at    timestamptz not null default now(),
  unique (booking_id, purpose)
);
create index idx_otp_expires on otp_verifications (expires_at);

create table service_sessions (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null unique references bookings (id) on delete cascade,
  started_at     timestamptz,
  ended_at       timestamptz,
  actual_minutes int,
  start_verified_by uuid references users (id),
  end_verified_by   uuid references users (id),
  provider_notes text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_service_sessions_updated before update on service_sessions for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Payments / invoices / refunds / payouts
-- ----------------------------------------------------------------------------
create table provider_payouts (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid references provider_profiles (id) on delete set null,
  company_id    uuid references company_profiles (id) on delete set null,
  period_start  date not null,
  period_end    date not null,
  gross_amount  numeric(12,2) not null,
  commission_amount numeric(12,2) not null,
  cash_adjustment numeric(12,2) not null default 0,  -- cash collected by provider (owed to platform)
  net_amount    numeric(12,2) not null,
  status        text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed')),
  bank_reference text,
  processed_by  uuid references users (id) on delete set null,
  processed_at  timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  check ((provider_id is not null) <> (company_id is not null))
);
create index idx_payouts_provider on provider_payouts (provider_id);
create index idx_payouts_company on provider_payouts (company_id);

create table payments (
  id                   uuid primary key default gen_random_uuid(),
  booking_id           uuid not null references bookings (id),
  customer_id          uuid not null references users (id),
  provider_id          uuid references provider_profiles (id) on delete set null,
  company_id           uuid references company_profiles (id) on delete set null,
  method               payment_method not null,
  status               payment_status not null default 'pending',
  amount               numeric(12,2) not null check (amount > 0),
  currency             text not null default 'INR',
  razorpay_order_id    text unique,
  razorpay_payment_id  text unique,
  razorpay_signature   text,
  transaction_id       text,
  failure_reason       text,
  paid_at              timestamptz,
  commission_amount    numeric(12,2) not null default 0,
  provider_earning     numeric(12,2) not null default 0,
  payout_id            uuid references provider_payouts (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_payments_booking on payments (booking_id);
create index idx_payments_customer on payments (customer_id, created_at desc);
create index idx_payments_status on payments (status);
create index idx_payments_payout on payments (payout_id);
create unique index uq_payments_one_paid on payments (booking_id) where status = 'paid';
create trigger trg_payments_updated before update on payments for each row execute function set_updated_at();

create table webhook_events (
  id           text primary key,     -- provider event id => idempotency
  source       text not null,
  event_type   text not null,
  payload      jsonb not null,
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);

create table invoices (
  id               uuid primary key default gen_random_uuid(),
  invoice_number   text not null unique default ('INV-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 6, '0')),
  booking_id       uuid not null unique references bookings (id),
  customer_id      uuid not null references users (id),
  provider_id      uuid references provider_profiles (id) on delete set null,
  company_id       uuid references company_profiles (id) on delete set null,
  customer_name    text,
  customer_mobile  text,
  customer_email   text,
  customer_address text,
  provider_name    text,
  company_name     text,
  service_name     text not null,
  service_description text,
  service_date     date not null,
  start_time       timestamptz not null,
  end_time         timestamptz not null,
  actual_hours     numeric(5,2) not null,
  billed_hours     numeric(4,1) not null,
  line_items       jsonb not null default '[]',
  base_amount      numeric(12,2) not null,
  material_cost    numeric(12,2) not null default 0,
  spare_parts_cost numeric(12,2) not null default 0,
  visiting_charge  numeric(10,2) not null default 0,
  discount_amount  numeric(12,2) not null default 0,
  tax_percent      numeric(5,2) not null,
  tax_amount       numeric(12,2) not null,
  total_amount     numeric(12,2) not null,
  payment_status   payment_status not null default 'pending',
  payment_method   payment_method,
  created_at       timestamptz not null default now()
);
create index idx_invoices_customer on invoices (customer_id, created_at desc);
create index idx_invoices_provider on invoices (provider_id);
create index idx_invoices_company on invoices (company_id);

create table refunds (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references bookings (id),
  payment_id         uuid not null references payments (id),
  customer_id        uuid not null references users (id),
  reason             text not null check (char_length(reason) between 5 and 1000),
  amount             numeric(12,2) not null check (amount > 0),
  status             refund_status not null default 'requested',
  admin_notes        text,
  razorpay_refund_id text unique,
  reviewed_by        uuid references users (id) on delete set null,
  reviewed_at        timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_refunds_customer on refunds (customer_id, created_at desc);
create index idx_refunds_status on refunds (status);
create index idx_refunds_booking on refunds (booking_id);
-- at most one open refund per payment
create unique index uq_refunds_open on refunds (payment_id) where status in ('requested', 'under_review', 'approved', 'processing');
create trigger trg_refunds_updated before update on refunds for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Coupons usage, wishlist, reviews
-- ----------------------------------------------------------------------------
create table coupon_usage (
  id               uuid primary key default gen_random_uuid(),
  coupon_id        uuid not null references coupons (id) on delete cascade,
  user_id          uuid not null references users (id) on delete cascade,
  booking_id       uuid not null unique references bookings (id) on delete cascade,
  discount_applied numeric(12,2) not null,
  used_at          timestamptz not null default now()
);
create index idx_coupon_usage_coupon_user on coupon_usage (coupon_id, user_id);

create or replace function sync_coupon_usage_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update coupons set usage_count = usage_count + 1 where id = new.coupon_id;
  else
    update coupons set usage_count = greatest(0, usage_count - 1) where id = old.coupon_id;
  end if;
  return null;
end $$;
create trigger trg_coupon_usage_count after insert or delete on coupon_usage
  for each row execute function sync_coupon_usage_count();

create table wishlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  service_id  uuid references services (id) on delete cascade,
  provider_id uuid references provider_profiles (id) on delete cascade,
  company_id  uuid references company_profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  check (((service_id is not null)::int + (provider_id is not null)::int + (company_id is not null)::int) = 1)
);
create unique index uq_wishlist_service on wishlist (user_id, service_id) where service_id is not null;
create unique index uq_wishlist_provider on wishlist (user_id, provider_id) where provider_id is not null;
create unique index uq_wishlist_company on wishlist (user_id, company_id) where company_id is not null;
create index idx_wishlist_user on wishlist (user_id, created_at desc);

create table reviews (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null unique references bookings (id),
  customer_id  uuid not null references users (id),
  provider_id  uuid references provider_profiles (id) on delete set null,
  company_id   uuid references company_profiles (id) on delete set null,
  rating       int not null check (rating between 1 and 5),
  comment      text check (comment is null or char_length(comment) <= 2000),
  photos       text[] not null default '{}',
  is_published boolean not null default true,
  report_count int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_reviews_provider on reviews (provider_id, created_at desc) where is_published;
create index idx_reviews_company on reviews (company_id, created_at desc) where is_published;
create index idx_reviews_published on reviews (is_published, created_at desc);
create trigger trg_reviews_updated before update on reviews for each row execute function set_updated_at();

create table review_reports (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references reviews (id) on delete cascade,
  reporter_id uuid not null references users (id) on delete cascade,
  reason      text not null check (char_length(reason) between 3 and 500),
  status      text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at  timestamptz not null default now(),
  unique (review_id, reporter_id)
);

create or replace function refresh_review_aggregates() returns trigger
language plpgsql as $$
declare
  r record;
begin
  r := coalesce(new, old);
  if r.provider_id is not null then
    update provider_profiles set
      average_rating = coalesce((select round(avg(rating)::numeric, 2) from reviews where provider_id = r.provider_id and is_published), 0),
      total_reviews  = (select count(*) from reviews where provider_id = r.provider_id and is_published)
    where id = r.provider_id;
  end if;
  if r.company_id is not null then
    update company_profiles set
      average_rating = coalesce((select round(avg(rating)::numeric, 2) from reviews where company_id = r.company_id and is_published), 0),
      total_reviews  = (select count(*) from reviews where company_id = r.company_id and is_published)
    where id = r.company_id;
  end if;
  return null;
end $$;
create trigger trg_reviews_aggregate after insert or update or delete on reviews
  for each row execute function refresh_review_aggregates();

-- ----------------------------------------------------------------------------
-- Notifications, push tokens, support
-- ----------------------------------------------------------------------------
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  type       notification_type not null,
  title      text not null,
  body       text not null,
  data       jsonb not null default '{}',
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications (user_id, created_at desc);
create index idx_notifications_unread on notifications (user_id) where not is_read;

create table push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  token      text not null unique,
  platform   text not null default 'web',
  last_seen  timestamptz not null default now()
);
create index idx_push_tokens_user on push_tokens (user_id);

create table support_tickets (
  id            uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default ('TKT-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' || lpad(nextval('ticket_number_seq')::text, 5, '0')),
  user_id       uuid not null references users (id) on delete cascade,
  booking_id    uuid references bookings (id) on delete set null,
  category      text not null default 'other' check (category in ('booking', 'payment', 'refund', 'provider', 'account', 'other')),
  subject       text not null check (char_length(subject) between 3 and 150),
  description   text not null check (char_length(description) between 5 and 4000),
  status        ticket_status not null default 'open',
  priority      text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_to   uuid references users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_tickets_user on support_tickets (user_id, created_at desc);
create index idx_tickets_status on support_tickets (status, priority);
create trigger trg_tickets_updated before update on support_tickets for each row execute function set_updated_at();

create table ticket_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references support_tickets (id) on delete cascade,
  sender_id  uuid not null references users (id),
  is_staff   boolean not null default false,
  message    text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index idx_ticket_messages_ticket on ticket_messages (ticket_id, created_at);

-- ----------------------------------------------------------------------------
-- Security plumbing: rate limits + audit log
-- ----------------------------------------------------------------------------
create table rate_limits (
  key          text primary key,
  hits         int not null default 0,
  window_start timestamptz not null default now()
);

-- Atomic fixed-window limiter. Returns true when the call is ALLOWED.
create or replace function check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_hits int;
begin
  insert into rate_limits as r (key, hits, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

create table audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid references users (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  metadata   jsonb not null default '{}',
  ip         text,
  created_at timestamptz not null default now()
);
create index idx_audit_entity on audit_logs (entity, entity_id);
create index idx_audit_actor on audit_logs (actor_id, created_at desc);
create index idx_audit_created on audit_logs (created_at desc);

-- ----------------------------------------------------------------------------
-- Auth bootstrap: every auth.users row gets a public.users row.
-- The role is ALWAYS 'customer' here. Provider/company roles are granted by the
-- server after registration is submitted; admins only via scripts/create-admin.mjs.
-- Client-supplied metadata is used for display + UX hints only.
-- ----------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_intent text := new.raw_user_meta_data ->> 'signup_intent';
  v_name   text := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100), '');
  v_ref    uuid;
begin
  if v_name is not null and char_length(v_name) < 2 then v_name := null; end if;
  insert into users (id, role, full_name, mobile, email, signup_intent)
  values (
    new.id, 'customer', v_name,
    case when coalesce(new.phone, '') <> '' then
      case when left(new.phone, 1) = '+' then new.phone else '+' || new.phone end
    end,
    nullif(new.email, ''),
    case when v_intent in ('customer', 'provider', 'company') then v_intent else 'customer' end
  )
  on conflict (id) do nothing;

  begin
    select cp.user_id into v_ref from customer_profiles cp
      where cp.referral_code = upper(nullif(new.raw_user_meta_data ->> 'referral_code', ''));
  exception when others then v_ref := null;
  end;

  insert into customer_profiles (user_id, referred_by) values (new.id, v_ref)
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Keep users.mobile / email in sync when auth credentials change
create or replace function sync_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update users set
    mobile = case when coalesce(new.phone, '') <> '' then
               case when left(new.phone, 1) = '+' then new.phone else '+' || new.phone end
             else mobile end,
    email = coalesce(nullif(new.email, ''), email)
  where id = new.id;
  return new;
end $$;
create trigger on_auth_user_updated after update of phone, email on auth.users
  for each row execute function sync_auth_user();

-- ----------------------------------------------------------------------------
-- RLS helper predicates (SECURITY DEFINER => no policy recursion)
-- ----------------------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and role = 'admin' and is_active)
$$;

create or replace function my_provider_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from provider_profiles where user_id = auth.uid()
$$;

create or replace function my_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from company_profiles where user_id = auth.uid()
$$;

-- Is the caller a participant (customer / assigned provider / owning company) of the booking?
create or replace function is_booking_participant(p_booking uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings b
    where b.id = p_booking and (
      b.customer_id = auth.uid()
      or b.provider_id = my_provider_id()
      or b.company_id = my_company_id()
    )
  )
$$;
