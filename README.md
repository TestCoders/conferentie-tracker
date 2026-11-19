# Conference Tracker

Automatisch ontdekken, vergelijken en beoordelen van conferenties over development, softwaretesten en testautomatisering.

- Plan, status en todo's: [plan.md](plan.md)
- Werkafspraken, branches en coding standard: [AGENTS.md](AGENTS.md)

## Snel starten

```bash
npm install
cp .env.example .env.local   # vul SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_TOKEN in
npm run dev                  # http://localhost:3000  ·  beheer: /admin
```

Database: draai [supabase/schema.sql](supabase/schema.sql) in de Supabase SQL editor.

Stack: Next.js 16 (App Router, TypeScript, Tailwind 4) · Supabase PostgreSQL · Vercel.
