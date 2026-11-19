# Conference Tracker — hackathonplan (eerste demo binnen 60 minuten)

**Datum:** 19 november 2026  
**Team:** 4 developers, ieder eventueel met een eigen AI-coding-agent  
**Doel van het eerste uur:** vanaf een publiek bereikbare URL echte conferenties automatisch inlezen, tonen, vergelijken en via een eenvoudige beheeromgeving controleren. Ratings/reviews toevoegen zodra de kernketen werkt.

> Dit is het **plan voor de eerste demo**, niet de volledige eind-MVP. De productfocus blijft: automatisch conferenties ontdekken en actueel houden voor development, softwaretesten en testautomatisering, inclusief vergelijking, ratings/reviews en backendadministratie.

## 1. Vaste besluiten — niet opnieuw bediscussiëren tijdens dit uur

| Onderdeel     | Besluit                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Hosting       | **Vercel**; één Next.js-project (App Router, TypeScript, Tailwind)                                  |
| Database      | **Supabase PostgreSQL**, één gedeeld dev-project                                                    |
| Datatoegang   | **Alleen via Next.js API-routes**; Supabase-secret uitsluitend server-side                          |
| Discovery     | Eerst **gestructureerde live JSON** van confs.tech; daarna TestingConferences.org                   |
| AI            | Optioneel voor extractie/classificatie; **geen AI vereist** om de eerste echte records te ontdekken |
| Opslag        | Alle conferenties, import-runs en reviews in PostgreSQL                                             |
| Updates       | **Handmatig triggerbare, idempotente herimport** in het eerste uur; cron later                      |
| Authenticatie | Geen gebruikersaccounts in eerste uur; beheeracties via apart `ADMIN_TOKEN`                         |
| Deployment    | Eén gedeelde Vercel-deployment, gekoppeld aan de `main`-branch                                      |
| Git           | Vier branches, strikt bestandseigenaarschap, één integrator                                         |

**Waarom niet SQLite?** SQLite in het bestandssysteem van een Vercel Function is niet blijvend en niet gedeeld tussen instances. Supabase levert direct één persistente database voor alle vier developers en de Vercel-deployment.

**Hostingvoorbehoud:** Vercel Hobby is beperkt tot persoonlijk/niet-commercieel gebruik. Gebruik bij een bedrijfsproject een geschikt team/Pro-plan of een toegestaan alternatief. Dit verandert de database- en applicatiearchitectuur niet.

**Geen premature complexiteit:** geen ORM, queues, Docker, Supabase Auth, AI-crawling-agent, automatische e-mails, prijsextractie uit willekeurige websites of externe reviewscraper voor demo 1.

## 2. Definition of Done — eerste demo (T+60)

### P0 — absoluut noodzakelijk

- [ ] App is bereikbaar op Vercel (of lokaal als deployment de enige blokkade is).
- [ ] Eén klik op **Discover/Refresh** haalt **echte gegevens** uit minstens één live externe bron.
- [ ] Minstens 5 echte conferenties staan **na een API-call** in Supabase; geen handmatig of fictief ingevulde conferentierecords.
- [ ] De conferenties zijn zichtbaar als kaarten of lijst; naam, datum, locatie, categorie en bronlink.
- [ ] Dezelfde discovery-run opnieuw uitvoeren maakt **geen duplicaten**.
- [ ] Een beheerder kan de import starten, de uitkomst bekijken en een conferentie goedkeuren/afwijzen.

### P1 — toevoegen zodra P0 werkt

- [ ] Selecteer 2 conferenties en vergelijk datum, locatie, categorie, CFP en prijs (onbekend = `Onbekend`).
- [ ] Sla een 1–5-sterrenrating en korte review op, zichtbaar na refresh.
- [ ] Tweede echte bron voor testconferenties werkt: TestingConferences.org.

### Niet nodig voor demo 1

Echte gebruikersauthenticatie, automatisch ontdekken van onbekende websites via zoekmachines, cron, volledige change-history, externe reviews, officiële prijsverificatie, e-mailnotificaties, GDPR-/productiehardening.

**Belangrijk:** prijs en CFP-deadline zijn optioneel. Vul onbekende waarden **niet** aan met verzonnen gegevens. Reviews uit de demo zijn alleen demo-input, nooit voorgesteld als echte onafhankelijke bezoekersbeoordelingen.

## 3. Tijdschema (60 minuten)

| Tijd      | Gezamenlijk doel                                                                                        | Concrete checkpoint                                  |
| --------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **00–05** | Keuzes vastzetten; eigenaar A maakt repo/app-basis en deelt API-contract.                               | Iedereen kent zijn eigen bestanden.                  |
| **05–15** | A maakt Supabase-schema + gedeelde types en `.env.example`; B/C/D werken met contract/mocks.            | De app bouwt; database bestaat; branches actief.     |
| **15–30** | B levert eerste echte import; A levert `GET /api/conferences`; C levert lijst; D levert minimale admin. | End-to-end lokaal: live bron → DB → scherm.          |
| **30–40** | Integratie op `main`; eerste Vercel-deploy. B herhaalt import; C vergelijking; D ratings of moderatie.  | Publieke demo-URL en 5+ echte records.               |
| **40–50** | Tweede integratie; gerichte fixes; end-to-end controle.                                                 | Import opnieuw zonder duplicaten; admin + UI werken. |
| **50–60** | **Feature freeze** (geen nieuwe features). Demo voorbereiden en uitvoeren.                              | Live demo van 2–3 minuten met fallback.              |

**Stopregel:** ligt de keten _live bron → opslag → lijst_ op T+30 niet op schema, dan stoppen C en D met polish en helpen gericht op integratie. P0 gaat altijd voor P1.

## 4. Vier geïsoleerde werkpakketten

### A — Foundation, database, basis-API en deployment (integrator)

**Branch:** `feat/foundation`  
**Eigen bestanden:** `src/lib/types.ts`, `src/lib/supabase-admin.ts`, `src/app/api/conferences/route.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `supabase/schema.sql`, `.env.example`, `package.json`, configbestanden.

**Taken**

1. Maak een eenvoudige Next.js App Router-app met TypeScript en Tailwind, commit de basis **uiterlijk T+05** en laat iedereen hiervandaan branchen.
2. Maak één Supabase-project, draai het SQL-schema uit sectie 5 en deel de **niet-geheime** projectinformatie. Zet secrets alleen in lokale `.env.local` en Vercel Environment Variables.
3. Implementeer één server-side databaseclient in `src/lib/supabase-admin.ts`.
4. Definieer de types uit sectie 6 en `GET /api/conferences` (alleen goedgekeurde conferenties, gesorteerd op startdatum).
5. Koppel Vercel aan `main`, stel environment variables in, doe vroeg een deploy.
6. Integreer branches met korte merges. **A is de enige die `main` beheert.**

**Acceptatie:** `GET /api/conferences` geeft `{ "items": [] }` terug zonder records en daarna de echte geïmporteerde records; build/deploy slaagt.

**Niet doen:** discoveryparser, reviewformulier, volledige admin-UI of vergelijking bouwen.

### B — Discovery-engine en idempotente import

**Branch:** `feat/discovery`  
**Eigen bestanden:** `src/lib/discovery/**`, `src/app/api/discovery/run/route.ts`.

**Taken**

1. Maak `importConfsTech()` die **live JSON** ophaalt en valideert van:
   - `https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2027/javascript.json`
   - `https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2027/devops.json`
   - Optioneel: `.../2027/python.json`
2. Zet records om naar het `Conference`-datamodel. Gebruik broncategorie `development`; testautomatisering krijgt niet automatisch deze categorie zonder bewijs.
3. Normaliseer de **officiële URL** (o.a. trackingparameters, trailing slash) en gebruik `(canonical_url, start_date)` voor ontdubbelen. Doe `upsert`, geen blind `insert`.
4. Registreer elke run in `ingestion_runs`, inclusief `found`, `inserted`, `updated` en fouten. `last_checked_at` wordt bijgewerkt.
5. Implementeer `POST /api/discovery/run`, beveiligd met `Authorization: Bearer <ADMIN_TOKEN>`.
6. **Pas nadat de eerste bron werkt:** bouw een adapter voor `https://testingconferences.org/` om expliciet echte testing- en testautomationconferenties te ontdekken.

**Acceptatie:** na eerste run ≥5 echte records in database; tweede run geeft 0 nieuwe duplicaten; API rapporteert aantallen.

**Niet doen:** frontend, database-schema wijzigen, eigen DTO-velden verzinnen, LLM-aanroepen toevoegen vóór werkende deterministische import.

### C — Publiek conferentieoverzicht en vergelijking

**Branch:** `feat/explorer`  
**Eigen bestanden:** `src/app/page.tsx`, `src/components/explorer/**`.

**Taken**

1. Ontwerp één aantrekkelijke responsive pagina met titel, korte uitleg en conferentielijst.
2. Lees `GET /api/conferences` volgens sectie 6. Start eventueel met **lokale mockdata die exact hetzelfde type hebben**, en verwijder ze zodra API bestaat.
3. Toon naam, datum, stad/land, categorie, CFP-deadline (of `Onbekend`), officiële link en bron.
4. Zoek op naam; filter op development/testing/test-automation; sorteer op begindatum.
5. Voeg checkboxen toe om **2 conferenties** naast elkaar te vergelijken; toon `Onbekend` voor missende velden.
6. Toon reviews alleen als de API van D tijdig beschikbaar is; blokkeer de lijst er niet op.

**Acceptatie:** C kan zijn UI lokaal tonen met een `Conference[]` mock; na integratie verschijnen echte Supabase-records zonder codewijzigingen aan het datamodel.

**Niet doen:** API-routes, DB-client, discovery, globale layout of `package.json` aanpassen.

### D — Beheeromgeving en ratings/reviews

**Branch:** `feat/admin-reviews`  
**Eigen bestanden:** `src/app/admin/page.tsx`, `src/components/admin/**`, `src/components/reviews/**`, `src/app/api/admin/**`, `src/app/api/reviews/route.ts`.

**Taken — in deze volgorde**

1. Bouw `/admin` met een invoerveld voor een tijdelijk admin-token (alleen in **React state**, niet in source code, URL of browseropslag) en een **Run discovery**-knop die `POST /api/discovery/run` aanroept.
2. Toon de uitkomst (`found/inserted/updated/errors`) en een beheerbare lijst met conferenties.
3. Implementeer `GET /api/admin/conferences` en `PATCH /api/admin/conferences/[id]` voor status `approved` / `rejected` en beperkte correcties. Beide controleren server-side het admin-token.
4. Bouw `GET /api/reviews?conferenceId=...` en `POST /api/reviews` met rating 1–5, naam en optionele reviewtekst. Beperk tekstlengte; valideer server-side.
5. Maak een compacte reviewcomponent en bespreek met C waar die komt; raak C's bestanden niet aan. C kan de component later importeren.

**Acceptatie:** beheerder kan een discovery-run triggeren en één conferentie afwijzen; indien tijd: review opslaan en na refresh terugzien.

**Niet doen:** discovery-engine, basistypes, globale layout of `GET /api/conferences` aanpassen.

## 5. Gezamenlijk datamodel (A legt dit binnen 10 minuten vast)

Een minimale, bruikbare start voor `supabase/schema.sql`:

```sql
create table if not exists public.conferences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  official_url text not null,
  canonical_url text not null,
  source_name text not null,
  source_url text not null,
  start_date date not null,
  end_date date,
  city text,
  country text,
  category text not null default 'development'
    check (category in ('development', 'testing', 'test-automation')),
  cfp_url text,
  cfp_deadline date,
  price_text text,
  status text not null default 'approved'
    check (status in ('pending', 'approved', 'rejected')),
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canonical_url, start_date)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences(id) on delete cascade,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  status text not null check (status in ('running', 'success', 'failed')),
  found_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Publieke clients praten uitsluitend met de Next.js API, niet direct
-- met Supabase. De server gebruikt een geheime server-side sleutel.
alter table public.conferences enable row level security;
alter table public.reviews enable row level security;
alter table public.ingestion_runs enable row level security;
-- Maak voor deze demo GEEN publieke schrijfpolicies.
```

**Belangrijke nuances:**

- `price_text` mag leeg zijn; prijsvergelijking is dan mogelijk met `Onbekend`, maar er wordt geen prijs geraden.
- Eén `category` is bewust simpeler dan een volledige taxonomie. Multi-category tags zijn voor later.
- `status = approved` is toegestaan voor betrouwbaar, gestructureerd bronmateriaal zodat de eerste demo direct records toont. Onzekere vondsten kunnen `pending` krijgen; admin kan altijd afwijzen.
- `source_url` wijst naar de gebruikte dataset/pagina; `official_url` naar de website van het evenement.
- Reviews zijn **user-generated**; reviewdata wordt nooit geïmporteerd alsof het onafhankelijke echte reviews zijn.

## 6. Vast API-contract — niet wijzigen zonder expliciet akkoord van alle vier

Alle datumvelden: `YYYY-MM-DD`; IDs: UUID; optionele velden: `null`, **niet** verzonnen of lege strings; foutrespons: `{ "error": "..." }` met passende HTTP-status.

### `GET /api/conferences` — A

Antwoord: `{ "items": Conference[] }`; alleen `approved` en toekomstig/aankomend, oplopend op `start_date`.

```ts
type Category = 'development' | 'testing' | 'test-automation';
type ConferenceStatus = 'pending' | 'approved' | 'rejected';

type Conference = {
  id: string;
  name: string;
  official_url: string;
  canonical_url: string;
  source_name: string;
  source_url: string;
  start_date: string;
  end_date: string | null;
  city: string | null;
  country: string | null;
  category: Category;
  cfp_url: string | null;
  cfp_deadline: string | null;
  price_text: string | null;
  status: ConferenceStatus;
  last_checked_at: string;
};
```

A plaatst dit type in `src/lib/types.ts`; B/C/D importeren het.

### `POST /api/discovery/run` — B

Header: `Authorization: Bearer <ADMIN_TOKEN>`; zonder geldige token `401`.

Optionele body: `{ "source": "confs-tech" }`; zonder body wordt de beschikbare basisbron gebruikt. Geen onbeperkte URL-fetch van gebruikersinput toestaan.

Succesresponse:

```json
{ "source": "confs-tech", "found": 15, "inserted": 15, "updated": 0, "errors": [] }
```

Aantallen zijn **voorbeeld van het responseformaat**, niet beloofde of gesimuleerde resultaten. De echte API berekent de echte aantallen. `inserted` moet bij een ongewijzigde tweede run 0 zijn. Voor demo 1 is een synchrone import met kleine bronbestanden voldoende.

### `GET /api/admin/conferences` en `PATCH /api/admin/conferences/:id` — D

Beide vereisen dezelfde admin-header. GET geeft `{ "items": Conference[] }`, inclusief pending/rejected. PATCH accepteert bijvoorbeeld `{ "status": "rejected" }` en voor correcties een beperkte whitelist van velden (`name`, `city`, `country`, `cfp_deadline`); nooit willekeurige kolommen wijzigen.

### `GET /api/reviews?conferenceId=<uuid>` en `POST /api/reviews` — D

GET:

```json
{ "items": [], "averageRating": null, "count": 0 }
```

POST:

```json
{
  "conferenceId": "<uuid>",
  "reviewerName": "Demo-gebruiker",
  "rating": 4,
  "comment": "Voorbeeldreview voor de demo"
}
```

Gebruik voor publieke review-POST een **gevalideerde Next.js API-route**; geen directe anonieme DB-schrijfrechten. Zonder login is er nog geen betrouwbare gebruikersidentiteit of antispambeveiliging; reviews zijn in dit stadium alleen geschikt voor een gecontroleerde demo.

## 7. Git- en AI-agentregels

1. **A commit basis meteen**; B, C en D branchen pas daarna vanaf exact dezelfde commit.
2. Elk werkpakket heeft een eigen branch; **geen gedeelde bestanden aanpassen** behalve na afspraak.
3. Gebruik `src/lib/types.ts` als contract; niet lokaal nieuwe varianten van `Conference` definiëren.
4. Nieuwe dependencies? Eerst aan A melden. A beheert `package.json` en lockfile; vermijd dependencies als native `fetch` en standaard HTML/CSS volstaan.
5. Commit na ieder werkend checkpoint; maak kleine PR's naar `main`; A integreert op T+30 en T+40.
6. Iedere agent doet minimaal een typecheck/build of meldt expliciet wat nog niet werkt. Geen ongeteste wijziging aan `main` vlak vóór de demo.
7. Vondsten over toekomstige features in `ROADMAP.md` zetten, **niet** tijdens dit uur bouwen.
8. Als een API nog ontbreekt, gebruik tijdelijke lokale mocks **uitsluitend in de UI-ontwikkelbranch**. Mocks mogen niet als echte conferenties in productie of de demo verschijnen.

### Korte startinstructie voor iedere AI-coding-agent

> Werk **uitsluitend** aan werkpakket **[A/B/C/D]** zoals beschreven in `HACKATHON_PLAN.md`. Respecteer de toegewezen bestanden, het SQL-schema en het API-contract. Het doel is een werkende integratie binnen 60 minuten, niet de volledige productroadmap. Bouw de kleinste verifieerbare stap, test die, commit en rapporteer: afgerond / gewijzigde bestanden / getest / blokkades. Wijzig geen bestanden van andere werkpakketten; meld benodigde contractwijzigingen aan de integrator.

## 8. Opstartchecklist (eerste 5–10 minuten)

**A (integrator)**

```bash
# In een NIEUWE repo, indien nog geen Next.js-project aanwezig:
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --use-npm
npm install @supabase/supabase-js
# Commit onmiddellijk en laat de rest branchen.
```

Server-side environment variables in `.env.local` en Vercel (geen secrets committen):

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-secret>
ADMIN_TOKEN=<zelf-gegenereerd-sterk-token>
```

Server gebruikt bijv. `createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)` uitsluitend in servercode. Nooit `NEXT_PUBLIC_` gebruiken voor `SUPABASE_SERVICE_ROLE_KEY` of `ADMIN_TOKEN`. Gebruik voor beheer de apart ingevoerde `ADMIN_TOKEN`, **niet** de Supabase-sleutel.

**B/C/D**

```bash
git fetch origin
git switch -c feat/<eigen-werkpakket> origin/main
npm install
npm run dev
```

A vervangt `<project-ref>` en tokens, deelt ze via een veilig kanaal met wie ze nodig heeft en stelt ze in op Vercel. Vermijd tokens in logs, screenshots en commits. Als er al een repo is: **geen nieuwe scaffold over bestaande bestanden heen uitvoeren**.

## 9. Eerste demo: script (2–3 minuten)

1. **30 sec — Probleem:** relevante conferenties zijn verspreid over verschillende websites; informatie en CFP-deadlines veranderen.
2. **40 sec — Automatische ontdekking:** open `/admin`, start een live import uit de publieke confs.tech JSON-feed. Toon `found/inserted/updated` en eventueel `last_checked_at`.
3. **30 sec — Geen dubbelen:** start dezelfde import opnieuw; toon **0 nieuw ingevoegde records**.
4. **30 sec — Explorer:** open de conferentielijst, filter/zoek, klik naar de officiële bron van een werkelijk bestaand evenement.
5. **30 sec — Vergelijken:** vergelijk twee echte conferenties; ontbrekende prijzen/CFP's zijn zichtbaar als `Onbekend`.
6. **20 sec — Administratie en reviews:** wijs een conferentie af of voeg een **expliciet gemarkeerde demo-review** toe, afhankelijk van wat klaar is.

**Fallback wanneer live bron tijdelijk faalt:** toon de **eerder door de live importer verzamelde echte records** met bijbehorende bron- en importtijd. Doe niet alsof de mislukte herimport succesvol was. Als Vercel niet werkt, demonstreer dezelfde app lokaal met Supabase. Geen fictieve conferenties seed-en om de demo te redden.

## 10. Vervolg na demo 1 (niet tijdens dit uur)

- Tweede bron volledig automatiseren; ook development/testing/test-automation beter classificeren.
- Per conferentie officiële website opnieuw controleren op datum, prijs en CFP-wijzigingen.
- Echte importplanning via Vercel Cron of externe scheduler; bij voorkeur dagelijkse/batch updates, met retries, timeout en logs.
- Bronprioriteit, conflictresolutie, moderatie en wijzigingsgeschiedenis uitbreiden.
- Gebruikersauthenticatie, reviewmoderatie/rate limiting en juiste RLS-policies vóór publiek gebruik.
- Reacties/ratings transparant voorzien van aantallen; onafhankelijke externe reviews alleen met passende toestemming, bronvermelding en herleidbaarheid.
- UI-tests voor zoeken, vergelijken en beoordelen; importtests met echte HTTP-contractfixtures en een idempotentietest.

## 11. Geraadpleegde technische referenties en eerste bronnen

- Vercel Function filesystem: https://vercel.com/docs/functions/runtimes
- Vercel Hobby gebruiksvoorwaarden: https://vercel.com/docs/plans/hobby
- Supabase Next.js quickstart: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Supabase Free-projectinformatie: https://supabase.com/kb/faqs/platform/free-postgres-for-side-projects
- confs.tech datamodel: https://github.com/tech-conferences/conference-data
- Echte JSON-bron 2027 JavaScript: https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2027/javascript.json
- Echte JSON-bron 2027 DevOps: https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2027/devops.json
- Testing-conferenties: https://testingconferences.org/

---

**Eén zin als scopebewaker:** _Eerst echte conferenties automatisch ontdekken, correct opslaan en zichtbaar maken; pas daarna vergelijken, beoordelen en uitbreiden._
