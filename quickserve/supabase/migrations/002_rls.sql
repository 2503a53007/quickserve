-- ============================================================================
-- QuickServe 002 — Row Level Security & grants
--
-- Model:
--   * Every table has RLS enabled.
--   * `anon` / `authenticated` get ONLY the privileges listed here.
--   * All sensitive mutations (bookings, payments, OTPs, verification, pricing
--     snapshots, roles) happen server-side through the service_role key AFTER the
--     API route has authorised the caller. service_role bypasses RLS.
--   * Direct client writes are limited to harmless self-owned rows
--     (addresses, wishlist, push tokens, marking notifications read, profile
--     display fields).
-- ============================================================================

-- Start from nothing: Supabase grants broad defaults on the public schema.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Helpers needed inside policies
grant execute on function is_admin() to anon, authenticated;  -- public catalogue policies call it (false for anon)
grant execute on function my_provider_id(), my_company_id(), is_booking_participant(uuid) to authenticated;
grant execute on function distance_km(double precision, double precision, double precision, double precision) to anon, authenticated;
-- check_rate_limit & friends stay service_role-only (default for new functions in Supabase is public execute; revoked above).

alter table users                  enable row level security;
alter table customer_profiles      enable row level security;
alter table company_profiles       enable row level security;
alter table provider_profiles      enable row level security;
alter table company_employees      enable row level security;
alter table provider_documents     enable row level security;
alter table provider_photos        enable row level security;
alter table provider_availability  enable row level security;
alter table service_categories     enable row level security;
alter table services               enable row level security;
alter table service_pricing        enable row level security;
alter table addresses              enable row level security;
alter table provider_locations     enable row level security;
alter table coupons                enable row level security;
alter table platform_settings      enable row level security;
alter table platform_commissions   enable row level security;
alter table service_areas          enable row level security;
alter table bookings               enable row level security;
alter table booking_photos         enable row level security;
alter table booking_status_history enable row level security;
alter table extra_hour_requests    enable row level security;
alter table otp_verifications      enable row level security;
alter table service_sessions       enable row level security;
alter table provider_payouts       enable row level security;
alter table payments               enable row level security;
alter table webhook_events         enable row level security;
alter table invoices               enable row level security;
alter table refunds                enable row level security;
alter table coupon_usage           enable row level security;
alter table wishlist               enable row level security;
alter table reviews                enable row level security;
alter table review_reports         enable row level security;
alter table notifications          enable row level security;
alter table push_tokens            enable row level security;
alter table support_tickets        enable row level security;
alter table ticket_messages        enable row level security;
alter table rate_limits            enable row level security;
alter table audit_logs             enable row level security;

-- ---------------------------------------------------------------------------
-- users  — read own row / admin reads all. Update only display columns (NOT role).
-- ---------------------------------------------------------------------------
grant select on users to authenticated;
grant update (full_name, avatar_url) on users to authenticated;
create policy users_select_own   on users for select to authenticated using (id = auth.uid() or is_admin());
create policy users_update_own   on users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

grant select on customer_profiles to authenticated;
create policy customer_profiles_select on customer_profiles for select to authenticated using (user_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- Provider / company profiles: owner + admin read directly.
-- Public discovery is served by the API (service role) which strips private fields.
-- ---------------------------------------------------------------------------
grant select on provider_profiles, company_profiles, company_employees to authenticated;
create policy provider_profiles_select on provider_profiles for select to authenticated using (
  user_id = auth.uid() or is_admin()
  or company_id = my_company_id()
  or exists (select 1 from bookings b where b.provider_id = provider_profiles.id and b.customer_id = auth.uid()
             and b.status in ('provider_assigned', 'provider_travelling', 'provider_arrived', 'in_progress', 'completed'))
);
create policy company_profiles_select on company_profiles for select to authenticated using (
  user_id = auth.uid() or is_admin()
  or exists (select 1 from bookings b where b.company_id = company_profiles.id and b.customer_id = auth.uid())
);
create policy company_employees_select on company_employees for select to authenticated using (
  company_id = my_company_id() or provider_id = my_provider_id() or is_admin()
);

grant select on provider_documents to authenticated;
create policy provider_documents_select on provider_documents for select to authenticated using (
  provider_id = my_provider_id() or company_id = my_company_id() or is_admin()
);

-- Portfolio photos & availability are public marketing data
grant select on provider_photos, provider_availability to anon, authenticated;
create policy provider_photos_select on provider_photos for select to anon, authenticated using (true);
create policy provider_availability_select on provider_availability for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Catalogue (public read of ACTIVE rows)
-- ---------------------------------------------------------------------------
grant select on service_categories, services, service_pricing, service_areas to anon, authenticated;
create policy categories_select on service_categories for select to anon, authenticated using (is_active or is_admin());
create policy services_select   on services           for select to anon, authenticated using (is_active or is_admin());
create policy pricing_select    on service_pricing    for select to anon, authenticated using (is_active or is_admin());
create policy areas_select      on service_areas      for select to anon, authenticated using (is_active or is_admin());

-- Coupons: public offers page lists non-restricted, active, unexpired coupons.
grant select on coupons to anon, authenticated;
create policy coupons_select on coupons for select to anon, authenticated using (
  is_admin() or (is_active and valid_until > now() and valid_from <= now()
                 and (restricted_user_id is null or restricted_user_id = auth.uid()))
);

grant select on platform_settings to anon, authenticated;
create policy settings_select on platform_settings for select to anon, authenticated using (
  key in ('gst_percent', 'cancellation_policy', 'arrival_defaults', 'support_contact') or is_admin()
);
grant select on platform_commissions to authenticated;
create policy commissions_select on platform_commissions for select to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- Addresses: full self-service (validated by table constraints)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on addresses to authenticated;
create policy addresses_all on addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Live provider location: provider writes via API only; customer may read ONLY
-- while an active (travelling/arrived/in-progress) booking exists. Row is deleted
-- when the job completes/cancels.
-- ---------------------------------------------------------------------------
grant select on provider_locations to authenticated;
create policy provider_locations_select on provider_locations for select to authenticated using (
  provider_id = my_provider_id() or is_admin()
  or exists (select 1 from bookings b where b.provider_id = provider_locations.provider_id
             and b.customer_id = auth.uid() and b.status in ('provider_travelling', 'provider_arrived', 'in_progress'))
);

-- ---------------------------------------------------------------------------
-- Bookings & children: participants read; ALL writes go through the API
-- ---------------------------------------------------------------------------
grant select on bookings to authenticated;
create policy bookings_select on bookings for select to authenticated using (
  customer_id = auth.uid() or provider_id = my_provider_id() or company_id = my_company_id() or is_admin()
);

grant select on booking_photos, booking_status_history, extra_hour_requests, service_sessions to authenticated;
create policy booking_photos_select on booking_photos for select to authenticated using (is_booking_participant(booking_id) or is_admin());
create policy booking_history_select on booking_status_history for select to authenticated using (is_booking_participant(booking_id) or is_admin());
create policy extra_hours_select on extra_hour_requests for select to authenticated using (is_booking_participant(booking_id) or is_admin());
create policy sessions_select on service_sessions for select to authenticated using (is_booking_participant(booking_id) or is_admin());

-- OTP tables: NO client access at all (service role only). The customer reads their
-- own code through an authenticated API route which decrypts server-side.
-- (RLS enabled + no grants/policies => fully closed.)

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------
grant select on payments, invoices, refunds, provider_payouts to authenticated;
create policy payments_select on payments for select to authenticated using (
  customer_id = auth.uid() or provider_id = my_provider_id() or company_id = my_company_id() or is_admin()
);
create policy invoices_select on invoices for select to authenticated using (
  customer_id = auth.uid() or provider_id = my_provider_id() or company_id = my_company_id() or is_admin()
);
create policy refunds_select on refunds for select to authenticated using (customer_id = auth.uid() or is_admin());
create policy payouts_select on provider_payouts for select to authenticated using (
  provider_id = my_provider_id() or company_id = my_company_id() or is_admin()
);
-- webhook_events, rate_limits: closed (service role only)

grant select on coupon_usage to authenticated;
create policy coupon_usage_select on coupon_usage for select to authenticated using (user_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- Wishlist: self-service
-- ---------------------------------------------------------------------------
grant select, insert, delete on wishlist to authenticated;
create policy wishlist_all on wishlist for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Reviews: published ones are public; writes via API (verifies completed booking)
-- ---------------------------------------------------------------------------
grant select on reviews to anon, authenticated;
create policy reviews_select on reviews for select to anon, authenticated using (is_published or customer_id = auth.uid() or is_admin());
grant select on review_reports to authenticated;
create policy review_reports_select on review_reports for select to authenticated using (reporter_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- Notifications & push tokens
-- ---------------------------------------------------------------------------
grant select on notifications to authenticated;
grant update (is_read) on notifications to authenticated;
create policy notifications_select on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on push_tokens to authenticated;
create policy push_tokens_all on push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Support
-- ---------------------------------------------------------------------------
grant select on support_tickets, ticket_messages to authenticated;
create policy tickets_select on support_tickets for select to authenticated using (user_id = auth.uid() or is_admin());
create policy ticket_messages_select on ticket_messages for select to authenticated using (
  is_admin() or exists (select 1 from support_tickets t where t.id = ticket_messages.ticket_id and t.user_id = auth.uid())
);

-- audit_logs: admin read only
grant select on audit_logs to authenticated;
create policy audit_select on audit_logs for select to authenticated using (is_admin());

-- Service role keeps full access (it bypasses RLS but still needs table privileges)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Realtime (guarded: publication only exists on Supabase)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table notifications, bookings, provider_locations;
  end if;
end $$;
