/**
 * Canonical QuickServe service catalogue, starter offers, India cities & FAQs.
 * Mirrors supabase/migrations/004_seed.sql so the catalogue renders consistently
 * both when reading from Supabase and before a database is linked.
 * NOTE: Contains ZERO fake providers, ZERO fake GPS locations, and ZERO fake bookings.
 */

export interface CatalogService {
  id: string;
  categorySlug: string;
  name: string;
  slug: string;
  description: string;
  firstHourPrice: number;
  additionalHourPrice: number;
  visitingCharge: number;
  isEmergency: boolean;
}

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  isEmergency: boolean;
  sortOrder: number;
  services: CatalogService[];
}

export interface CatalogCoupon {
  code: string;
  title: string;
  description: string;
  couponType: 'general' | 'first_booking' | 'festival' | 'seasonal' | 'referral';
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  firstBookingOnly: boolean;
  validUntilLabel: string;
}

export interface IndiaCity {
  city: string;
  state: string;
  samplePin: string;
  lat: number;
  lng: number;
  areas: string[];
}

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  {
    id: 'cat-electrician',
    name: 'Electrician',
    slug: 'electrician',
    description: 'Wiring, switches, fans, lights, MCBs, inverters and emergency electrical repairs.',
    icon: 'Zap',
    emoji: '⚡',
    gradientFrom: '#F97316',
    gradientTo: '#FACC15',
    isEmergency: true,
    sortOrder: 1,
    services: [
      { id: 'svc-fan-light', categorySlug: 'electrician', name: 'Fan / Light Repair & Installation', slug: 'fan-light-repair', description: 'Ceiling fan, tube-light, switchboard fitting and fixes.', firstHourPrice: 199, additionalHourPrice: 149, visitingCharge: 50, isEmergency: false },
      { id: 'svc-wiring-mcb', categorySlug: 'electrician', name: 'Wiring & MCB Repair', slug: 'wiring-mcb-repair', description: 'Short-circuit, MCB tripping and wiring repair.', firstHourPrice: 249, additionalHourPrice: 179, visitingCharge: 50, isEmergency: true },
      { id: 'svc-inverter', categorySlug: 'electrician', name: 'Inverter / Stabiliser Service', slug: 'inverter-service', description: 'Inverter, UPS and stabiliser checkup and repair.', firstHourPrice: 299, additionalHourPrice: 199, visitingCharge: 75, isEmergency: false },
    ],
  },
  {
    id: 'cat-plumbing',
    name: 'Plumbing',
    slug: 'plumbing',
    description: 'Leaks, taps, pipes, drains and bathroom fittings.',
    icon: 'Droplets',
    emoji: '🔧',
    gradientFrom: '#0EA5E9',
    gradientTo: '#F97316',
    isEmergency: true,
    sortOrder: 2,
    services: [
      { id: 'svc-tap-mixer', categorySlug: 'plumbing', name: 'Tap / Mixer Repair', slug: 'tap-mixer-repair', description: 'Leaking taps, mixers, flush tanks and showers.', firstHourPrice: 199, additionalHourPrice: 149, visitingCharge: 50, isEmergency: false },
      { id: 'svc-pipe-leak', categorySlug: 'plumbing', name: 'Leakage & Pipe Repair', slug: 'pipe-leak-repair', description: 'Pipe leakage detection and repair.', firstHourPrice: 249, additionalHourPrice: 179, visitingCharge: 50, isEmergency: true },
      { id: 'svc-drain', categorySlug: 'plumbing', name: 'Drain Blockage Clearing', slug: 'drain-blockage', description: 'Kitchen and bathroom drain unblocking.', firstHourPrice: 299, additionalHourPrice: 199, visitingCharge: 75, isEmergency: true },
    ],
  },
  {
    id: 'cat-home-cleaning',
    name: 'Home Cleaning',
    slug: 'home-cleaning',
    description: 'Regular cleaning for a fresh, tidy home.',
    icon: 'Sparkles',
    emoji: '🏠',
    gradientFrom: '#F97316',
    gradientTo: '#FB923C',
    isEmergency: false,
    sortOrder: 3,
    services: [
      { id: 'svc-bath-clean', categorySlug: 'home-cleaning', name: 'Bathroom Cleaning', slug: 'bathroom-cleaning', description: 'Thorough bathroom scrubbing and sanitising.', firstHourPrice: 399, additionalHourPrice: 299, visitingCharge: 0, isEmergency: false },
      { id: 'svc-kitchen-clean', categorySlug: 'home-cleaning', name: 'Kitchen Cleaning', slug: 'kitchen-cleaning', description: 'Counter, chimney exterior, sink and cabinet cleaning.', firstHourPrice: 499, additionalHourPrice: 349, visitingCharge: 0, isEmergency: false },
      { id: 'svc-sweep-mop', categorySlug: 'home-cleaning', name: 'Full Home Sweep & Mop', slug: 'home-sweep-mop', description: 'Regular sweeping, mopping and dusting.', firstHourPrice: 349, additionalHourPrice: 249, visitingCharge: 0, isEmergency: false },
    ],
  },
  {
    id: 'cat-deep-cleaning',
    name: 'Deep Cleaning',
    slug: 'deep-cleaning',
    description: 'Intensive top-to-bottom cleaning and sanitisation.',
    icon: 'SprayCan',
    emoji: '✨',
    gradientFrom: '#EA580C',
    gradientTo: '#F59E0B',
    isEmergency: false,
    sortOrder: 4,
    services: [
      { id: 'svc-full-deep', categorySlug: 'deep-cleaning', name: 'Full Home Deep Cleaning', slug: 'full-home-deep-cleaning', description: 'Complete deep cleaning for 1–3 BHK homes.', firstHourPrice: 899, additionalHourPrice: 599, visitingCharge: 0, isEmergency: false },
      { id: 'svc-sofa-carpet', categorySlug: 'deep-cleaning', name: 'Sofa & Carpet Shampooing', slug: 'sofa-carpet-cleaning', description: 'Shampoo and vacuum clean for sofas and carpets.', firstHourPrice: 599, additionalHourPrice: 399, visitingCharge: 0, isEmergency: false },
    ],
  },
  {
    id: 'cat-ac-repair',
    name: 'AC Repair',
    slug: 'ac-repair',
    description: 'AC servicing, gas refill and repairs.',
    icon: 'Snowflake',
    emoji: '❄️',
    gradientFrom: '#06B6D4',
    gradientTo: '#F97316',
    isEmergency: true,
    sortOrder: 5,
    services: [
      { id: 'svc-ac-service', categorySlug: 'ac-repair', name: 'AC Service (Split / Window)', slug: 'ac-service', description: 'Jet-wash service and performance check.', firstHourPrice: 499, additionalHourPrice: 299, visitingCharge: 100, isEmergency: false },
      { id: 'svc-ac-gas', categorySlug: 'ac-repair', name: 'AC Gas Refill & Leak Fix', slug: 'ac-gas-refill', description: 'Gas top-up and leak repair.', firstHourPrice: 999, additionalHourPrice: 499, visitingCharge: 100, isEmergency: true },
      { id: 'svc-ac-cooling', categorySlug: 'ac-repair', name: 'AC Not Cooling Diagnosis', slug: 'ac-not-cooling', description: 'Diagnose and fix poor cooling.', firstHourPrice: 349, additionalHourPrice: 249, visitingCharge: 100, isEmergency: true },
    ],
  },
  {
    id: 'cat-ac-installation',
    name: 'AC Installation',
    slug: 'ac-installation',
    description: 'Split and window AC installation and uninstallation.',
    icon: 'AirVent',
    emoji: '🌬️',
    gradientFrom: '#F97316',
    gradientTo: '#38BDF8',
    isEmergency: false,
    sortOrder: 6,
    services: [
      { id: 'svc-ac-install', categorySlug: 'ac-installation', name: 'Split AC Installation', slug: 'split-ac-install', description: 'Standard split AC installation with piping check.', firstHourPrice: 899, additionalHourPrice: 499, visitingCharge: 0, isEmergency: false },
      { id: 'svc-ac-uninstall', categorySlug: 'ac-installation', name: 'AC Uninstallation', slug: 'ac-uninstall', description: 'Safe removal of split or window AC.', firstHourPrice: 499, additionalHourPrice: 299, visitingCharge: 0, isEmergency: false },
    ],
  },
  {
    id: 'cat-carpenter',
    name: 'Carpenter',
    slug: 'carpenter',
    description: 'Furniture repair, assembly, doors and woodwork.',
    icon: 'Hammer',
    emoji: '🪚',
    gradientFrom: '#B45309',
    gradientTo: '#F97316',
    isEmergency: false,
    sortOrder: 7,
    services: [
      { id: 'svc-furniture-repair', categorySlug: 'carpenter', name: 'Furniture Repair', slug: 'furniture-repair', description: 'Repair of beds, chairs, tables and wardrobes.', firstHourPrice: 249, additionalHourPrice: 179, visitingCharge: 50, isEmergency: false },
      { id: 'svc-door-lock', categorySlug: 'carpenter', name: 'Door / Lock Repair & Fitting', slug: 'door-lock-repair', description: 'Door alignment, hinges and lock fitting.', firstHourPrice: 249, additionalHourPrice: 179, visitingCharge: 50, isEmergency: false },
      { id: 'svc-furniture-asm', categorySlug: 'carpenter', name: 'Furniture Assembly', slug: 'furniture-assembly', description: 'Flat-pack furniture assembly.', firstHourPrice: 299, additionalHourPrice: 199, visitingCharge: 50, isEmergency: false },
    ],
  },
  {
    id: 'cat-painting',
    name: 'Painting',
    slug: 'painting',
    description: 'Interior and exterior painting and touch-ups.',
    icon: 'PaintRoller',
    emoji: '🎨',
    gradientFrom: '#EC4899',
    gradientTo: '#F97316',
    isEmergency: false,
    sortOrder: 8,
    services: [
      { id: 'svc-room-paint', categorySlug: 'painting', name: 'Room Painting (Labour)', slug: 'room-painting', description: 'Skilled painter hourly service for touch-ups and rooms.', firstHourPrice: 349, additionalHourPrice: 249, visitingCharge: 0, isEmergency: false },
      { id: 'svc-putty', categorySlug: 'painting', name: 'Wall Putty & Waterproofing', slug: 'wall-putty-waterproofing', description: 'Surface preparation and seepage treatment.', firstHourPrice: 399, additionalHourPrice: 279, visitingCharge: 0, isEmergency: false },
    ],
  },
  {
    id: 'cat-pest-control',
    name: 'Pest Control',
    slug: 'pest-control',
    description: 'Cockroach, termite, bed-bug and rodent control.',
    icon: 'Bug',
    emoji: '🐛',
    gradientFrom: '#16A34A',
    gradientTo: '#F97316',
    isEmergency: false,
    sortOrder: 9,
    services: [
      { id: 'svc-pest-gen', categorySlug: 'pest-control', name: 'General Pest Control', slug: 'general-pest-control', description: 'Cockroach, ant and spider treatment.', firstHourPrice: 599, additionalHourPrice: 399, visitingCharge: 0, isEmergency: false },
      { id: 'svc-termite', categorySlug: 'pest-control', name: 'Termite Treatment', slug: 'termite-treatment', description: 'Anti-termite drilling and treatment.', firstHourPrice: 999, additionalHourPrice: 699, visitingCharge: 0, isEmergency: false },
    ],
  },
  {
    id: 'cat-fridge',
    name: 'Refrigerator Repair',
    slug: 'refrigerator-repair',
    description: 'Cooling issues, compressor and door-seal repairs.',
    icon: 'Refrigerator',
    emoji: '🧊',
    gradientFrom: '#3B82F6',
    gradientTo: '#F97316',
    isEmergency: false,
    sortOrder: 10,
    services: [
      { id: 'svc-fridge-cool', categorySlug: 'refrigerator-repair', name: 'Fridge Not Cooling', slug: 'fridge-not-cooling', description: 'Diagnose and repair cooling problems.', firstHourPrice: 349, additionalHourPrice: 249, visitingCharge: 100, isEmergency: false },
      { id: 'svc-fridge-gas', categorySlug: 'refrigerator-repair', name: 'Fridge Gas Refill', slug: 'fridge-gas-refill', description: 'Gas refill and leak repair.', firstHourPrice: 799, additionalHourPrice: 399, visitingCharge: 100, isEmergency: false },
    ],
  },
  {
    id: 'cat-washer',
    name: 'Washing Machine Repair',
    slug: 'washing-machine-repair',
    description: 'Top-load and front-load washing machine repairs.',
    icon: 'WashingMachine',
    emoji: '🫧',
    gradientFrom: '#8B5CF6',
    gradientTo: '#F97316',
    isEmergency: false,
    sortOrder: 11,
    services: [
      { id: 'svc-wm-repair', categorySlug: 'washing-machine-repair', name: 'Washing Machine Repair', slug: 'washing-machine-repair', description: 'Drum, motor, drain and error-code repairs.', firstHourPrice: 349, additionalHourPrice: 249, visitingCharge: 100, isEmergency: false },
      { id: 'svc-wm-install', categorySlug: 'washing-machine-repair', name: 'Washing Machine Installation', slug: 'washing-machine-install', description: 'Installation and demo.', firstHourPrice: 299, additionalHourPrice: 199, visitingCharge: 0, isEmergency: false },
    ],
  },
  {
    id: 'cat-tv',
    name: 'TV Repair',
    slug: 'tv-repair',
    description: 'LED, LCD and smart TV repair and wall mounting.',
    icon: 'Tv',
    emoji: '📺',
    gradientFrom: '#6366F1',
    gradientTo: '#F97316',
    isEmergency: false,
    sortOrder: 12,
    services: [
      { id: 'svc-tv-repair', categorySlug: 'tv-repair', name: 'TV Repair (LED / LCD / Smart)', slug: 'tv-repair-service', description: 'Display, sound and power issues.', firstHourPrice: 349, additionalHourPrice: 249, visitingCharge: 100, isEmergency: false },
      { id: 'svc-tv-mount', categorySlug: 'tv-repair', name: 'TV Wall Mounting', slug: 'tv-wall-mount', description: 'Wall mount bracket fitting.', firstHourPrice: 399, additionalHourPrice: 249, visitingCharge: 0, isEmergency: false },
    ],
  },
  {
    id: 'cat-appliance',
    name: 'Appliance Repair',
    slug: 'appliance-repair',
    description: 'Microwave, geyser, mixer, chimney and more.',
    icon: 'Plug',
    emoji: '⚙️',
    gradientFrom: '#F59E0B',
    gradientTo: '#EA580C',
    isEmergency: false,
    sortOrder: 13,
    services: [
      { id: 'svc-microwave', categorySlug: 'appliance-repair', name: 'Microwave / Oven Repair', slug: 'microwave-repair', description: 'Heating and panel issues.', firstHourPrice: 299, additionalHourPrice: 199, visitingCharge: 75, isEmergency: false },
      { id: 'svc-geyser', categorySlug: 'appliance-repair', name: 'Geyser Repair', slug: 'geyser-repair', description: 'Geyser heating element and thermostat repair.', firstHourPrice: 299, additionalHourPrice: 199, visitingCharge: 75, isEmergency: true },
      { id: 'svc-chimney', categorySlug: 'appliance-repair', name: 'Chimney / Mixer Repair', slug: 'chimney-mixer-repair', description: 'Kitchen appliance repair.', firstHourPrice: 299, additionalHourPrice: 199, visitingCharge: 75, isEmergency: false },
    ],
  },
  {
    id: 'cat-bike',
    name: 'Bike Repair',
    slug: 'bike-repair',
    description: 'Doorstep two-wheeler servicing and breakdown help.',
    icon: 'Bike',
    emoji: '🏍️',
    gradientFrom: '#EF4444',
    gradientTo: '#F97316',
    isEmergency: true,
    sortOrder: 14,
    services: [
      { id: 'svc-bike-gen', categorySlug: 'bike-repair', name: 'Bike General Service', slug: 'bike-general-service', description: 'Doorstep general servicing.', firstHourPrice: 299, additionalHourPrice: 199, visitingCharge: 50, isEmergency: false },
      { id: 'svc-bike-bd', categorySlug: 'bike-repair', name: 'Bike Breakdown Assistance', slug: 'bike-breakdown', description: 'Roadside/home breakdown assistance.', firstHourPrice: 249, additionalHourPrice: 199, visitingCharge: 75, isEmergency: true },
    ],
  },
  {
    id: 'cat-car',
    name: 'Car Repair',
    slug: 'car-repair',
    description: 'Doorstep car servicing, battery and minor repairs.',
    icon: 'Car',
    emoji: '🚗',
    gradientFrom: '#475569',
    gradientTo: '#F97316',
    isEmergency: true,
    sortOrder: 15,
    services: [
      { id: 'svc-car-gen', categorySlug: 'car-repair', name: 'Car General Service', slug: 'car-general-service', description: 'Doorstep periodic service.', firstHourPrice: 799, additionalHourPrice: 499, visitingCharge: 100, isEmergency: false },
      { id: 'svc-car-bat', categorySlug: 'car-repair', name: 'Car Battery Jump-start / Replacement', slug: 'car-battery', description: 'Jump-start or battery replacement.', firstHourPrice: 399, additionalHourPrice: 299, visitingCharge: 100, isEmergency: true },
    ],
  },
  {
    id: 'cat-salon',
    name: 'Salon at Home',
    slug: 'salon-at-home',
    description: 'Haircuts, grooming, facials and spa at your doorstep.',
    icon: 'Scissors',
    emoji: '💇',
    gradientFrom: '#DB2777',
    gradientTo: '#F97316',
    isEmergency: false,
    sortOrder: 16,
    services: [
      { id: 'svc-mens-groom', categorySlug: 'salon-at-home', name: "Men's Haircut & Grooming", slug: 'mens-grooming', description: 'Haircut, shave and head massage.', firstHourPrice: 299, additionalHourPrice: 249, visitingCharge: 0, isEmergency: false },
      { id: 'svc-womens-salon', categorySlug: 'salon-at-home', name: "Women's Salon (Haircut / Facial)", slug: 'womens-salon', description: 'Haircut, facial and threading.', firstHourPrice: 499, additionalHourPrice: 349, visitingCharge: 0, isEmergency: false },
    ],
  },
  {
    id: 'cat-gardening',
    name: 'Gardening',
    slug: 'gardening',
    description: 'Lawn care, plant care and garden maintenance.',
    icon: 'Sprout',
    emoji: '🌱',
    gradientFrom: '#22C55E',
    gradientTo: '#F97316',
    isEmergency: false,
    sortOrder: 17,
    services: [
      { id: 'svc-garden-maint', categorySlug: 'gardening', name: 'Garden Maintenance', slug: 'garden-maintenance', description: 'Pruning, weeding and general upkeep.', firstHourPrice: 299, additionalHourPrice: 199, visitingCharge: 0, isEmergency: false },
      { id: 'svc-lawn', categorySlug: 'gardening', name: 'Lawn Mowing & Plant Care', slug: 'lawn-plant-care', description: 'Lawn mowing and plant care.', firstHourPrice: 349, additionalHourPrice: 249, visitingCharge: 0, isEmergency: false },
    ],
  },
  {
    id: 'cat-ro',
    name: 'RO Water Purifier Service',
    slug: 'ro-water-purifier-service',
    description: 'RO servicing, filter change and installation.',
    icon: 'Droplet',
    emoji: '💧',
    gradientFrom: '#0891B2',
    gradientTo: '#F97316',
    isEmergency: false,
    sortOrder: 18,
    services: [
      { id: 'svc-ro-svc', categorySlug: 'ro-water-purifier-service', name: 'RO Service & Filter Change', slug: 'ro-service', description: 'Annual service and filter replacement.', firstHourPrice: 399, additionalHourPrice: 249, visitingCharge: 50, isEmergency: false },
      { id: 'svc-ro-inst', categorySlug: 'ro-water-purifier-service', name: 'RO Installation', slug: 'ro-install', description: 'New RO purifier installation.', firstHourPrice: 499, additionalHourPrice: 299, visitingCharge: 0, isEmergency: false },
    ],
  },
  {
    id: 'cat-other',
    name: 'Other Local Services',
    slug: 'other-local-services',
    description: 'Anything else you need a trusted local professional for.',
    icon: 'Wrench',
    emoji: '🔨',
    gradientFrom: '#F97316',
    gradientTo: '#EA580C',
    isEmergency: false,
    sortOrder: 19,
    services: [
      { id: 'svc-handyman', categorySlug: 'other-local-services', name: 'General Handyman', slug: 'general-handyman', description: 'Odd jobs: hanging pictures, curtain rods, minor fixes.', firstHourPrice: 249, additionalHourPrice: 179, visitingCharge: 50, isEmergency: false },
      { id: 'svc-shifting', categorySlug: 'other-local-services', name: 'Home Shifting Helper', slug: 'shifting-helper', description: 'Packing and moving help.', firstHourPrice: 399, additionalHourPrice: 299, visitingCharge: 0, isEmergency: false },
    ],
  },
];

export const ALL_CATALOG_SERVICES: CatalogService[] = CATALOG_CATEGORIES.flatMap((c) => c.services);

export const STARTER_COUPONS: CatalogCoupon[] = [
  { code: 'WELCOME50', title: 'First booking: 50% off', description: '50% off up to ₹150 on your very first booking.', couponType: 'first_booking', discountType: 'percentage', discountValue: 50, minOrderAmount: 199, maxDiscountAmount: 150, firstBookingOnly: true, validUntilLabel: 'Valid for 1 year' },
  { code: 'FLAT100', title: 'Flat ₹100 off', description: 'Flat ₹100 off on bookings above ₹499.', couponType: 'general', discountType: 'fixed', discountValue: 100, minOrderAmount: 499, maxDiscountAmount: null, firstBookingOnly: false, validUntilLabel: 'Valid for 1 year' },
  { code: 'FESTIVE20', title: 'Festive special: 20% off', description: '20% off up to ₹200 during the festive season.', couponType: 'festival', discountType: 'percentage', discountValue: 20, minOrderAmount: 299, maxDiscountAmount: 200, firstBookingOnly: false, validUntilLabel: 'Limited festive offer' },
  { code: 'SEASON15', title: 'Seasonal care: 15% off', description: '15% off up to ₹120 on any seasonal service.', couponType: 'seasonal', discountType: 'percentage', discountValue: 15, minOrderAmount: 249, maxDiscountAmount: 120, firstBookingOnly: false, validUntilLabel: 'Seasonal offer' },
  { code: 'REFER100', title: 'Referral reward: ₹100 off', description: '₹100 off for friends who join with a referral code.', couponType: 'referral', discountType: 'fixed', discountValue: 100, minOrderAmount: 349, maxDiscountAmount: null, firstBookingOnly: true, validUntilLabel: 'Valid on first booking' },
];

export const INDIA_CITIES: IndiaCity[] = [
  {
    city: 'Ananthasagar (Hanumakonda)',
    state: 'Telangana',
    samplePin: '506371',
    lat: 18.0829,
    lng: 79.4718,
    areas: ['Ananthasagar', 'Hasanparthy Mandal', 'Elkathurthy', 'Hanumakonda', 'Kazipet', 'Warangal'],
  },
  { city: 'Bengaluru', state: 'Karnataka', samplePin: '560034', lat: 12.9716, lng: 77.5946, areas: ['Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield', 'Jayanagar'] },
  { city: 'Hyderabad', state: 'Telangana', samplePin: '500081', lat: 17.385, lng: 78.4867, areas: ['Madhapur', 'Gachibowli', 'Banjara Hills', 'Jubilee Hills', 'Kondapur'] },
  { city: 'Mumbai', state: 'Maharashtra', samplePin: '400050', lat: 19.076, lng: 72.8777, areas: ['Bandra West', 'Andheri', 'Powai', 'Lower Parel', 'Thane'] },
  { city: 'Delhi NCR', state: 'Delhi', samplePin: '110001', lat: 28.6139, lng: 77.209, areas: ['Connaught Place', 'Saket', 'Gurugram Cyber City', 'Noida Sector 62', 'Dwarka'] },
  { city: 'Chennai', state: 'Tamil Nadu', samplePin: '600020', lat: 13.0827, lng: 80.2707, areas: ['Adyar', 'Velachery', 'Anna Nagar', 'T. Nagar', 'OMR'] },
  { city: 'Pune', state: 'Maharashtra', samplePin: '411001', lat: 18.5204, lng: 73.8567, areas: ['Koregaon Park', 'Baner', 'Hinjewadi', 'Viman Nagar', 'Kothrud'] },
  { city: 'Kolkata', state: 'West Bengal', samplePin: '700001', lat: 22.5726, lng: 88.3639, areas: ['Salt Lake', 'Park Street', 'New Town', 'Ballygunge', 'Howrah'] },
  { city: 'Ahmedabad', state: 'Gujarat', samplePin: '380015', lat: 23.0225, lng: 72.5714, areas: ['Satellite', 'SG Highway', 'Navrangpura', 'Prahlad Nagar', 'Bopal'] },
  { city: 'Jaipur', state: 'Rajasthan', samplePin: '302001', lat: 26.9124, lng: 75.7873, areas: ['Malviya Nagar', 'Vaishali Nagar', 'C-Scheme', 'Mansarovar'] },
  { city: 'Kochi', state: 'Kerala', samplePin: '682001', lat: 9.9312, lng: 76.2673, areas: ['Edappally', 'Kakkanad', 'MG Road', 'Fort Kochi'] },
];

export const SUPPORT_FAQS = [
  {
    q: 'How does the Start & End Service OTP work?',
    a: 'When your professional arrives, you receive a 6-digit Start OTP. Share it only when they begin work so your timer starts accurately. Once work finishes, a separate End OTP locks the final duration and generates your itemized bill.',
  },
  {
    q: 'How is the maximum promised arrival time calculated?',
    a: 'Inspired by Zepto-style transparency, QuickServe calculates your arrival window using live distance, road travel estimates, provider preparation time, and configured service-area buffers. We never promise a window without availability data.',
  },
  {
    q: 'Can I pay by Cash on Delivery or UPI?',
    a: 'Yes! Choose Cash on Delivery (pay your professional after completion) or secure UPI checkout via Razorpay with server-side signature verification.',
  },
  {
    q: 'What if the work takes longer than the booked hours?',
    a: 'Your professional can submit an Extra Hours request directly from their app. You see the exact additional cost upfront and must approve it before extra time can be billed.',
  },
  {
    q: 'How do cancellations and refunds work?',
    a: 'Free cancellation is available up to 60 minutes before the scheduled start. Later cancellations incur a transparent fee per policy. Eligible UPI refunds are reviewed by admins and processed directly back through Razorpay.',
  },
  {
    q: 'How are individual professionals and service companies verified?',
    a: 'Every professional and registered company submits government ID / business registration documents and bank/payout details. Admin review and approval is mandatory before they can accept bookings.',
  },
];
