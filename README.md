# Conference Tracker

Automatisch ontdekken, vergelijken en beoordelen van conferenties over development, softwaretesten en testautomatisering.

- Plan, status en todo's: [plan.md](plan.md)
- Werkafspraken, branches en coding standard: [AGENTS.md](AGENTS.md)

## Snel starten

```bash
npm install
cp .env.example .env.local   # vul Supabase- en AUTH_MICROSOFT_ENTRA_ID_*-waarden in
npm run dev                  # http://localhost:3000  ·  beheer: /admin
```

Database: draai [supabase/schema.sql](supabase/schema.sql) in de Supabase SQL editor.

Stack: Next.js 16 (App Router, TypeScript, Tailwind 4) · Supabase PostgreSQL · Vercel.
