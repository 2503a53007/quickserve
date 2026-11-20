#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
if (!files.length) {
  console.error('No SQL migration files found in supabase/migrations');
  process.exit(1);
}
console.log(`Found ${files.length} migration files:`);
for (const file of files) {
  const size = fs.statSync(path.join(dir, file)).size;
  console.log(`  ✓ ${file} (${size} bytes)`);
}
