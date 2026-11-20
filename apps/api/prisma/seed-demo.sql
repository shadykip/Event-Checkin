INSERT INTO events (id, name, slug, venue, starts_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Nairobi Developer Meetup',
  'nairobi-developer-meetup',
  'Demo Hall, Nairobi',
  '2026-12-05 10:00:00+03',
  now(),
  now()
)
ON CONFLICT (slug) DO NOTHING;
