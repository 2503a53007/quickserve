-- ============================================================================
-- QuickServe 004 — Reference data (catalogue, pricing defaults, settings, offers)
-- Contains NO users, providers, locations or bookings: only configuration.
-- ============================================================================

insert into service_categories (name, slug, description, icon, gradient_from, gradient_to, is_emergency, sort_order) values
 ('Electrician',            'electrician',            'Wiring, switches, fans, lights and electrical repairs.',        'Zap',            '#F97316', '#FACC15', true,  1),
 ('Plumbing',               'plumbing',               'Leaks, taps, pipes, drains and bathroom fittings.',             'Droplets',       '#0EA5E9', '#F97316', true,  2),
 ('Home Cleaning',          'home-cleaning',          'Regular cleaning for a fresh, tidy home.',                      'Sparkles',       '#F97316', '#FB923C', false, 3),
 ('Deep Cleaning',          'deep-cleaning',          'Intensive top-to-bottom cleaning and sanitisation.',            'SprayCan',       '#EA580C', '#F59E0B', false, 4),
 ('AC Repair',              'ac-repair',              'AC servicing, gas refill and repairs.',                         'Snowflake',      '#06B6D4', '#F97316', true,  5),
 ('AC Installation',        'ac-installation',        'Split and window AC installation and uninstallation.',          'AirVent',        '#F97316', '#38BDF8', false, 6),
 ('Carpenter',              'carpenter',              'Furniture repair, assembly, doors and woodwork.',               'Hammer',         '#B45309', '#F97316', false, 7),
 ('Painting',               'painting',               'Interior and exterior painting and touch-ups.',                 'PaintRoller',    '#EC4899', '#F97316', false, 8),
 ('Pest Control',           'pest-control',           'Cockroach, termite, bed-bug and rodent control.',               'Bug',            '#16A34A', '#F97316', false, 9),
 ('Refrigerator Repair',    'refrigerator-repair',    'Cooling issues, compressor and door-seal repairs.',             'Refrigerator',   '#3B82F6', '#F97316', false, 10),
 ('Washing Machine Repair', 'washing-machine-repair', 'Top-load and front-load washing machine repairs.',              'WashingMachine', '#8B5CF6', '#F97316', false, 11),
 ('TV Repair',              'tv-repair',              'LED, LCD and smart TV repair and wall mounting.',               'Tv',             '#6366F1', '#F97316', false, 12),
 ('Appliance Repair',       'appliance-repair',       'Microwave, geyser, mixer, chimney and more.',                   'Plug',           '#F59E0B', '#EA580C', false, 13),
 ('Bike Repair',            'bike-repair',            'Doorstep two-wheeler servicing and breakdown help.',            'Bike',           '#EF4444', '#F97316', true,  14),
 ('Car Repair',             'car-repair',             'Doorstep car servicing, battery and minor repairs.',            'Car',            '#475569', '#F97316', true,  15),
 ('Salon at Home',          'salon-at-home',          'Haircuts, grooming, facials and spa at your doorstep.',         'Scissors',       '#DB2777', '#F97316', false, 16),
 ('Gardening',              'gardening',              'Lawn care, plant care and garden maintenance.',                 'Sprout',         '#22C55E', '#F97316', false, 17),
 ('RO Water Purifier Service','ro-water-purifier-service','RO servicing, filter change and installation.',             'Droplet',        '#0891B2', '#F97316', false, 18),
 ('Other Local Services',   'other-local-services',   'Anything else you need a trusted local professional for.',      'Wrench',         '#F97316', '#EA580C', false, 19);

-- service rows: (category slug, name, slug, description, first hour, additional hour, visiting, emergency)
with s(cat, name, slug, descr, p1, p2, pv, em) as (values
 ('electrician','Fan / Light Repair & Installation','fan-light-repair','Ceiling fan, tube-light, switchboard fitting and fixes.',199,149,50,false),
 ('electrician','Wiring & MCB Repair','wiring-mcb-repair','Short-circuit, MCB tripping and wiring repair.',249,179,50,true),
 ('electrician','Inverter / Stabiliser Service','inverter-service','Inverter, UPS and stabiliser checkup and repair.',299,199,75,false),
 ('plumbing','Tap / Mixer Repair','tap-mixer-repair','Leaking taps, mixers, flush tanks and showers.',199,149,50,false),
 ('plumbing','Leakage & Pipe Repair','pipe-leak-repair','Pipe leakage detection and repair.',249,179,50,true),
 ('plumbing','Drain Blockage Clearing','drain-blockage','Kitchen and bathroom drain unblocking.',299,199,75,true),
 ('home-cleaning','Bathroom Cleaning','bathroom-cleaning','Thorough bathroom scrubbing and sanitising.',399,299,0,false),
 ('home-cleaning','Kitchen Cleaning','kitchen-cleaning','Counter, chimney exterior, sink and cabinet cleaning.',499,349,0,false),
 ('home-cleaning','Full Home Sweep & Mop','home-sweep-mop','Regular sweeping, mopping and dusting.',349,249,0,false),
 ('deep-cleaning','Full Home Deep Cleaning','full-home-deep-cleaning','Complete deep cleaning for 1–3 BHK homes.',899,599,0,false),
 ('deep-cleaning','Sofa & Carpet Shampooing','sofa-carpet-cleaning','Shampoo and vacuum clean for sofas and carpets.',599,399,0,false),
 ('ac-repair','AC Service (Split / Window)','ac-service','Jet-wash service and performance check.',499,299,100,false),
 ('ac-repair','AC Gas Refill & Leak Fix','ac-gas-refill','Gas top-up and leak repair.',999,499,100,true),
 ('ac-repair','AC Not Cooling Diagnosis','ac-not-cooling','Diagnose and fix poor cooling.',349,249,100,true),
 ('ac-installation','Split AC Installation','split-ac-install','Standard split AC installation with piping check.',899,499,0,false),
 ('ac-installation','AC Uninstallation','ac-uninstall','Safe removal of split or window AC.',499,299,0,false),
 ('carpenter','Furniture Repair','furniture-repair','Repair of beds, chairs, tables and wardrobes.',249,179,50,false),
 ('carpenter','Door / Lock Repair & Fitting','door-lock-repair','Door alignment, hinges and lock fitting.',249,179,50,false),
 ('carpenter','Furniture Assembly','furniture-assembly','Flat-pack furniture assembly.',299,199,50,false),
 ('painting','Room Painting (Labour)','room-painting','Skilled painter hourly service for touch-ups and rooms.',349,249,0,false),
 ('painting','Wall Putty & Waterproofing','wall-putty-waterproofing','Surface preparation and seepage treatment.',399,279,0,false),
 ('pest-control','General Pest Control','general-pest-control','Cockroach, ant and spider treatment.',599,399,0,false),
 ('pest-control','Termite Treatment','termite-treatment','Anti-termite drilling and treatment.',999,699,0,false),
 ('refrigerator-repair','Fridge Not Cooling','fridge-not-cooling','Diagnose and repair cooling problems.',349,249,100,false),
 ('refrigerator-repair','Fridge Gas Refill','fridge-gas-refill','Gas refill and leak repair.',799,399,100,false),
 ('washing-machine-repair','Washing Machine Repair','washing-machine-repair','Drum, motor, drain and error-code repairs.',349,249,100,false),
 ('washing-machine-repair','Washing Machine Installation','washing-machine-install','Installation and demo.',299,199,0,false),
 ('tv-repair','TV Repair (LED / LCD / Smart)','tv-repair-service','Display, sound and power issues.',349,249,100,false),
 ('tv-repair','TV Wall Mounting','tv-wall-mount','Wall mount bracket fitting.',399,249,0,false),
 ('appliance-repair','Microwave / Oven Repair','microwave-repair','Heating and panel issues.',299,199,75,false),
 ('appliance-repair','Geyser Repair','geyser-repair','Geyser heating element and thermostat repair.',299,199,75,true),
 ('appliance-repair','Chimney / Mixer Repair','chimney-mixer-repair','Kitchen appliance repair.',299,199,75,false),
 ('bike-repair','Bike General Service','bike-general-service','Doorstep general servicing.',299,199,50,false),
 ('bike-repair','Bike Breakdown Assistance','bike-breakdown','Roadside/home breakdown assistance.',249,199,75,true),
 ('car-repair','Car General Service','car-general-service','Doorstep periodic service.',799,499,100,false),
 ('car-repair','Car Battery Jump-start / Replacement','car-battery','Jump-start or battery replacement.',399,299,100,true),
 ('salon-at-home','Men''s Haircut & Grooming','mens-grooming','Haircut, shave and head massage.',299,249,0,false),
 ('salon-at-home','Women''s Salon (Haircut / Facial)','womens-salon','Haircut, facial and threading.',499,349,0,false),
 ('gardening','Garden Maintenance','garden-maintenance','Pruning, weeding and general upkeep.',299,199,0,false),
 ('gardening','Lawn Mowing & Plant Care','lawn-plant-care','Lawn mowing and plant care.',349,249,0,false),
 ('ro-water-purifier-service','RO Service & Filter Change','ro-service','Annual service and filter replacement.',399,249,50,false),
 ('ro-water-purifier-service','RO Installation','ro-install','New RO purifier installation.',499,299,0,false),
 ('other-local-services','General Handyman','general-handyman','Odd jobs: hanging pictures, curtain rods, minor fixes.',249,179,50,false),
 ('other-local-services','Home Shifting Helper','shifting-helper','Packing and moving help.',399,299,0,false)
)
insert into services (category_id, name, slug, description, default_first_hour_price, default_additional_hour_price, default_visiting_charge, is_emergency, sort_order)
select c.id, s.name, s.slug, s.descr, s.p1, s.p2, s.pv, s.em, row_number() over (partition by s.cat order by s.slug)
from s join service_categories c on c.slug = s.cat;

insert into platform_commissions (category_id, commission_percent) values (null, 15);

insert into platform_settings (key, value) values
 ('gst_percent',          '18'::jsonb),
 ('cancellation_policy',  '{"free_before_minutes": 60, "late_fee": 50, "travelling_fee_uses_visiting_charge": true}'::jsonb),
 ('arrival_defaults',     '{"avg_speed_kmph": 22, "prep_minutes": 5, "buffer_minutes": 10, "min_lead_minutes": 45, "max_arrival_minutes": 90, "provider_ack_minutes": 10, "max_radius_km": 25}'::jsonb),
 ('support_contact',      '{"email": "support@quickserve.example", "phone": "", "hours": "8 AM – 10 PM IST"}'::jsonb),
 ('otp_policy',           '{"ttl_minutes": 10, "max_attempts": 5, "max_resends": 3}'::jsonb);

-- Starter offers (admin can edit/disable). Dates are relative to migration time.
insert into coupons (code, title, description, coupon_type, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, per_user_limit, valid_from, valid_until, first_booking_only) values
 ('WELCOME50', 'First booking: 50% off',      '50% off up to ₹150 on your very first booking.',      'first_booking', 'percentage', 50, 199, 150, null, 1, now(), now() + interval '1 year', true),
 ('FLAT100',   'Flat ₹100 off',               'Flat ₹100 off on bookings above ₹499.',               'general',       'fixed',     100, 499, null, null, 3, now(), now() + interval '1 year', false),
 ('FESTIVE20', 'Festive special: 20% off',    '20% off up to ₹200 during the festive season.',       'festival',      'percentage', 20, 299, 200, null, 2, now(), now() + interval '90 days', false),
 ('SEASON15',  'Seasonal care: 15% off',      '15% off up to ₹120 on any seasonal service.',         'seasonal',      'percentage', 15, 249, 120, null, 2, now(), now() + interval '120 days', false),
 ('REFER100',  'Referral reward: ₹100 off',   '₹100 off for friends who join with a referral code.', 'referral',      'fixed',     100, 349, null, null, 1, now(), now() + interval '1 year', true);
