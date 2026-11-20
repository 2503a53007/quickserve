-- ============================================================================
-- QuickServe 003 — Query functions (discovery, expiry, analytics)
-- ============================================================================

-- Providers + companies that offer a service within range of a customer location.
-- Exposes only APPROXIMATE coordinates (~1 km grid) for map display; exact base
-- coordinates never leave the database through this function.
create or replace function nearby_owners(
  p_service_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 15,
  p_min_rating numeric default 0
)
returns table (
  owner_kind text, owner_id uuid, user_id uuid, name text, logo_url text, city text,
  experience_years int, average_rating numeric, total_reviews int, total_jobs int,
  is_online boolean, first_hour_price numeric, additional_hour_price numeric,
  visiting_charge numeric, distance_km double precision,
  approx_lat double precision, approx_lng double precision
)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'provider'::text, pp.id, pp.user_id,
           coalesce(pp.display_name, u.full_name, 'Service Professional'), u.avatar_url, pp.city,
           pp.experience_years, pp.average_rating, pp.total_reviews, pp.total_jobs, pp.is_online,
           sp.first_hour_price, sp.additional_hour_price, sp.visiting_charge,
           distance_km(p_lat, p_lng, pp.latitude, pp.longitude) as d,
           round(pp.latitude::numeric, 2)::double precision, round(pp.longitude::numeric, 2)::double precision
    from provider_profiles pp
    join users u on u.id = pp.user_id and u.is_active
    join service_pricing sp on sp.provider_id = pp.id and sp.service_id = p_service_id and sp.is_active
    where pp.company_id is null and pp.verification_status = 'verified'
      and pp.latitude is not null and pp.longitude is not null
      and pp.average_rating >= p_min_rating
    union all
    select 'company'::text, cp.id, cp.user_id, cp.company_name, cp.logo_url, cp.city,
           0, cp.average_rating, cp.total_reviews, cp.total_jobs, cp.is_online,
           sp.first_hour_price, sp.additional_hour_price, sp.visiting_charge,
           distance_km(p_lat, p_lng, cp.latitude, cp.longitude) as d,
           round(cp.latitude::numeric, 2)::double precision, round(cp.longitude::numeric, 2)::double precision
    from company_profiles cp
    join users u on u.id = cp.user_id and u.is_active
    join service_pricing sp on sp.company_id = cp.id and sp.service_id = p_service_id and sp.is_active
    where cp.verification_status = 'verified'
      and cp.latitude is not null and cp.longitude is not null
      and cp.average_rating >= p_min_rating
      and exists (select 1 from company_employees ce join provider_profiles w on w.id = ce.provider_id
                  where ce.company_id = cp.id and ce.is_active and w.verification_status = 'verified')
  ) t (owner_kind, owner_id, user_id, name, logo_url, city, experience_years, average_rating, total_reviews,
       total_jobs, is_online, first_hour_price, additional_hour_price, visiting_charge, distance_km, approx_lat, approx_lng)
  where t.distance_km <= least(
      p_radius_km,
      coalesce((select pp2.service_radius_km from provider_profiles pp2 where t.owner_kind = 'provider' and pp2.id = t.owner_id),
               (select cp2.service_radius_km from company_profiles cp2 where t.owner_kind = 'company' and cp2.id = t.owner_id),
               15)::double precision)
  order by t.distance_km asc
$$;

-- Providers that did not answer a pending request in time free their slot.
create or replace function expire_stale_bookings() returns setof uuid
language plpgsql security definer set search_path = public as $$
begin
  return query
  with expired as (
    update bookings
       set status = 'rejected', rejection_reason = 'No response from provider', cancelled_at = now()
     where status = 'pending' and provider_ack_deadline is not null and provider_ack_deadline < now()
    returning id
  )
  select id from expired;
end $$;

-- Aggregate dashboard numbers in one round trip (service role only)
create or replace function admin_dashboard_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total_customers',   (select count(*) from users where role = 'customer'),
    'total_providers',   (select count(*) from provider_profiles where company_id is null),
    'total_companies',   (select count(*) from company_profiles),
    'pending_provider_verifications', (select count(*) from provider_profiles where company_id is null and verification_status = 'pending'),
    'pending_company_verifications',  (select count(*) from company_profiles where verification_status = 'pending'),
    'active_bookings',   (select count(*) from bookings where status in ('pending', 'confirmed', 'provider_assigned', 'provider_travelling', 'provider_arrived', 'in_progress')),
    'completed_bookings',(select count(*) from bookings where status = 'completed'),
    'cancelled_bookings',(select count(*) from bookings where status in ('cancelled', 'rejected')),
    'total_revenue',     (select coalesce(sum(amount), 0) from payments where status = 'paid'),
    'platform_commission',(select coalesce(sum(commission_amount), 0) from payments where status = 'paid'),
    'open_refunds',      (select count(*) from refunds where status in ('requested', 'under_review', 'approved', 'processing')),
    'open_tickets',      (select count(*) from support_tickets where status in ('open', 'in_progress')),
    'new_registrations_7d', (select count(*) from users where created_at > now() - interval '7 days')
  )
$$;

-- Daily series for the admin charts
create or replace function admin_daily_series(p_days int default 14) returns table (day date, bookings bigint, revenue numeric, registrations bigint)
language sql stable security definer set search_path = public as $$
  select d::date,
         (select count(*) from bookings b where (b.created_at at time zone 'Asia/Kolkata')::date = d::date),
         (select coalesce(sum(p.amount), 0) from payments p where p.status = 'paid' and (p.paid_at at time zone 'Asia/Kolkata')::date = d::date),
         (select count(*) from users u where (u.created_at at time zone 'Asia/Kolkata')::date = d::date)
  from generate_series((now() at time zone 'Asia/Kolkata')::date - (p_days - 1), (now() at time zone 'Asia/Kolkata')::date, interval '1 day') d
  order by 1
$$;

revoke execute on function nearby_owners(uuid, double precision, double precision, double precision, numeric) from public, anon, authenticated;
revoke execute on function expire_stale_bookings() from public, anon, authenticated;
revoke execute on function admin_dashboard_stats() from public, anon, authenticated;
revoke execute on function admin_daily_series(int) from public, anon, authenticated;
grant execute on function nearby_owners(uuid, double precision, double precision, double precision, numeric) to service_role;
grant execute on function expire_stale_bookings() to service_role;
grant execute on function admin_dashboard_stats() to service_role;
grant execute on function admin_daily_series(int) to service_role;
