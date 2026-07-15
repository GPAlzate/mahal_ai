/**
 * Send a test push to stored subscriptions. Dev utility.
 *
 * Usage:
 *   node scripts/send-test-push.mjs                    # all subscriptions
 *   node scripts/send-test-push.mjs --user user_abc    # one Clerk user's devices
 *   node scripts/send-test-push.mjs --participant 123  # one participant's devices
 *   node scripts/send-test-push.mjs --list             # just list subscriptions
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const { neon } = require('@neondatabase/serverless');
const webpush = require('web-push');

const env = readFileSync(join(root, '.env'), 'utf8');
const get = (name) => env.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim();

const sql = neon(get('DATABASE_URL'));
webpush.setVapidDetails(
  get('VAPID_SUBJECT'),
  get('NEXT_PUBLIC_VAPID_PUBLIC_KEY'),
  get('VAPID_PRIVATE_KEY')
);

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};

const userId = flag('--user');
const participantId = flag('--participant');

let rows;
if (userId) {
  rows = await sql`SELECT * FROM push_subscriptions WHERE user_id = ${userId}`;
} else if (participantId) {
  rows = await sql`SELECT * FROM push_subscriptions WHERE participant_id = ${Number(participantId)}`;
} else {
  rows = await sql`SELECT * FROM push_subscriptions ORDER BY created_at DESC`;
}

if (rows.length === 0) {
  console.log('No subscriptions found. Subscribe a device first (Settings → Notifications).');
  process.exit(0);
}

for (const row of rows) {
  console.log(`- id=${row.id} user=${row.user_id ?? '—'} participant=${row.participant_id ?? '—'} ${row.endpoint.slice(0, 60)}...`);
}

if (args.includes('--list')) {
  process.exit(0);
}

const payload = JSON.stringify({
  title: 'Test push 🧾',
  body: `Sent ${new Date().toLocaleTimeString('en-PH')} from send-test-push.mjs`,
  url: '/',
  tag: 'test-push',
});

for (const row of rows) {
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      payload,
      { TTL: 300 }
    );
    console.log(`sent → id=${row.id}`);
  } catch (error) {
    console.error(`FAILED → id=${row.id}: ${error.statusCode ?? ''} ${error.message}`);
  }
}
