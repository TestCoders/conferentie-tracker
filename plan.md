# Conference Tracker — plan, status en todo's

**Peildatum:** 19 november 2026 · **`main`:** na PR #19 · **Productie:** https://conferentie-tracker.vercel.app
**Werkafspraken, branches en coding standard:** [AGENTS.md](AGENTS.md)

Dit is het enige plandocument. Het vervangt `HACKATHON_PLAN.md`, `updated_plan.md` en `ROADMAP.md`.
Bij tegenstrijdigheid wint dit bestand, daarna `AGENTS.md`.

**Productfocus:** conferenties voor development, softwaretesten en testautomatisering **automatisch
ontdekken en actueel houden**, met **vergelijking**, **ratings/reviews** en **backendadministratie**.

**Scopebewaker:** _eerst echte conferenties automatisch ontdekken, correct opslaan en zichtbaar maken;
pas daarna vergelijken, beoordelen en uitbreiden._

---

## 1. Status in één oogopslag

| Vraag                  | Antwoord                                                                          |
| ---------------------- | --------------------------------------------------------------------------------- |
| **Demo 1 — P0**        | ✅ 6 van 6                                                                        |
| **Demo 1 — P1**        | ✅ 3 van 3                                                                        |
| **Roadmap-ideeën (5)** | ✅ 2 gebouwd · 🟡 1 deels · 🔄 1 in PR (#20) · ❌ 1 open                          |
| **MVP**                | ❌ **Nog niet.** 3 must-haves open: geplande herimport, importstatus, beveiliging |

**Data in productie** (`GET /api/conferences?period=all`, alleen `approved`): **251** conferenties
(107 confs.tech, 144 TestingConferences), waarvan **61** aankomend; 54 met CFP-deadline,
26 online-only, 1 met officiële ticketprijs.

**Legenda:** ✅ klaar · 🟡 deels · 🔄 in review · ❌ open

---

## 2. Vaste besluiten

| Onderdeel     | Besluit                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Hosting       | **Vercel**; één Next.js 16-project (App Router, TypeScript, Tailwind 4), gekoppeld aan `main`        |
| Database      | **Supabase PostgreSQL**, één gedeeld project; RLS aan, geen publieke schrijfpolicies                 |
| Datatoegang   | **Alleen via Next.js API-routes**; Supabase-secret uitsluitend server-side                           |
| Discovery     | Gestructureerde live feeds (confs.tech JSON, TestingConferences YAML) + door admin toegevoegde feeds |
| AI            | Optioneel, alleen voor **verrijking** (OpenRouter); nooit nodig om records te ontdekken              |
| Updates       | Handmatige, idempotente herimport via `/admin`; **geplande herimport nog te bouwen**                 |
| Authenticatie | Beheer via `ADMIN_TOKEN`; Entra-login in PR #20                                                      |
| Git           | Eén branch per pakket, strikt bestandseigenaarschap, één integrator (A) — zie `AGENTS.md`            |

**Waarom niet SQLite?** Het bestandssysteem van een Vercel Function is niet blijvend en niet gedeeld.

**Hostingvoorbehoud:** Vercel Hobby is alleen voor niet-commercieel gebruik; voor bedrijfsgebruik een
team/Pro-plan nemen. De architectuur verandert daar niet door.

### Dataprincipes (niet onderhandelbaar)

- Onbekend = `null`, in de UI `Onbekend`. **Nooit** verzonnen datums, prijzen of CFP's.
- Geen fictieve conferenties of reviews seeden; mocks alleen tijdelijk in een UI-branch.
- Ontdubbelen op `(canonical_url, start_date)` met upsert; herimport laat moderatiestatus,
  ticketvelden en afbeeldingen ongemoeid.
- Herkomst zichtbaar: AI-waarden gemarkeerd (`ai_fields`, `ai_checked_at`, "AI-schatting · datum");
  kosten zijn een **schatting** met aannames, ticketprijs **officieel** met bron-URL.
- Reviews en ervaringen zijn user-generated en worden nooit gepresenteerd als onafhankelijke reviews.
- Elke server-side fetch van een niet-vaste URL (eigen bronnen, websites voor AI/afbeeldingen):
  alleen `https`, publieke host, redirects per stap gecontroleerd, timeout en groottelimiet.

---

## 3. Contract

Bron van waarheid: [src/lib/types.ts](src/lib/types.ts) en [supabase/schema.sql](supabase/schema.sql)

- [supabase/migrations/](supabase/migrations/). Wijzigen alleen met akkoord van alle vier, via A.

Datums `YYYY-MM-DD`, IDs UUID, fouten `{ "error": "..." }` met passende status
(400 validatie, 401 auth, 404, 500, 501).

### Tabellen

| Tabel               | Doel                                                                 | Sinds                        |
| ------------------- | -------------------------------------------------------------------- | ---------------------------- |
| `conferences`       | Conferenties (+ `online_only`, ticketprijs, AI-velden, afbeeldingen) | basis, #10, #15, #16, images |
| `reviews`           | Rating 1–5 + korte review                                            | basis                        |
| `ingestion_runs`    | Logboek van discovery- en AI-runs                                    | basis                        |
| `attendances`       | Geïnteresseerd / bijgewoond per naam                                 | #7                           |
| `experiences`       | Verslagen en foto's (Supabase Storage)                               | #11                          |
| `cost_assumptions`  | Reis/hotel per land en standaard (`*`)                               | #10, #15, #16                |
| `discovery_sources` | Door admin toegevoegde feeds                                         | #19                          |

### Endpoints

| Endpoint                                                        | Auth        | Eigenaar |
| --------------------------------------------------------------- | ----------- | -------- |
| `GET /api/conferences?period=upcoming\|past\|all`               | —           | A        |
| `POST /api/discovery/run` (`{ source }` of `{ sourceId }`)      | admin       | B        |
| `GET /api/admin/conferences`, `PATCH …/:id`                     | admin       | D        |
| `GET/POST /api/admin/sources`, `DELETE …/:id`                   | admin       | B/D      |
| `POST /api/admin/enrich` (`costs` / `conferences`)              | admin       | B/D      |
| `PUT/DELETE /api/admin/cost-assumptions`                        | admin       | D        |
| `DELETE /api/admin/experiences/:id`                             | admin       | D        |
| `GET/POST /api/reviews`                                         | —           | D        |
| `GET/POST /api/attendances`, `GET /api/attendances/summary`     | —           | C        |
| `GET/POST /api/experiences`, `GET /api/experiences/conferences` | —           | C        |
| `POST /api/experiences/:id/photos`                              | bewerktoken | C        |
| `GET /api/cost-assumptions`                                     | —           | C        |

`PATCH /api/admin/conferences/:id` accepteert alleen een whitelist (status, `name`, `city`, `country`,
`cfp_deadline`, ticketvelden); nooit willekeurige kolommen.

---

## 4. Wat er gebouwd is

### Demo 1 — Definition of Done

| #    | Eis                                                         | Status | Bewijs                                            |
| ---- | ----------------------------------------------------------- | ------ | ------------------------------------------------- |
| P0-1 | App bereikbaar op Vercel                                    | ✅     | Productie-URL publiek, deploy van `main` groen    |
| P0-2 | Eén klik haalt echte gegevens uit live bron                 | ✅     | `/admin` → _Run discovery_ (PR #2, #3, #6)        |
| P0-3 | ≥ 5 echte conferenties na API-call in Supabase              | ✅     | 251 records, geen handmatige                      |
| P0-4 | Kaarten/lijst met naam, datum, locatie, categorie, bronlink | ✅     | Lijst-, kaart- en agendaweergave (PR #1, #4, #18) |
| P0-5 | Herhaalde run maakt geen duplicaten                         | ✅     | Upsert + tests; tweede run `inserted = 0`         |
| P0-6 | Admin start import, ziet uitkomst, keurt goed/af            | ✅     | PR #2                                             |
| P1-7 | 2 conferenties vergelijken                                  | ✅     | PR #1; nu ook met kosten, logo's en deelnemers    |
| P1-8 | 1–5 sterren + review, zichtbaar na refresh                  | ✅     | PR #2 + #7                                        |
| P1-9 | Tweede bron: TestingConferences.org                         | ✅     | PR #6                                             |

### Per werkpakket

| Pakket                | Eigenaar      | Opgeleverd                                                                                                                                                                                                                                       |
| --------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A** Foundation      | Yuri Verweij  | Next.js-basis, contract, schema, Supabase-client, `GET /api/conferences` (+ `period`), CI, Vercel.                                                                                                                                               |
| **B** Discovery       | Kevin Groot   | confs.tech + TestingConferences (aankomend en afgelopen 12 maanden, #13), eigen feeds via admin met SSRF-bescherming (#19), online-detectie, idempotente upsert, `ingestion_runs`, logo's/afbeeldingen van officiële websites.                   |
| **C** Explorer        | Tim de Groot  | Lijst/kaarten/agenda, zoeken/filter/sorteren, vergelijken, huisstijl + licht/donker, hoofdmenu, `.ics`, deelnemers (#7), kostenschatting + budgetfilter (#10, #15), archief met periode/jaar (#17), `/ervaringen` met verslagen en foto's (#11). |
| **D** Admin & reviews | Wouter Klaase | `/admin` met discovery-runs, statusfilter, approve/reject, correcties (incl. ticketprijs), eigen bronnen, AI-verrijking (#16), moderatie van ervaringen; reviews-API + component.                                                                |

### Roadmap-ideeën

| #   | Idee                                      | Status | Toelichting                                                                                                                                                                       |
| --- | ----------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Slimme discovery via URL + AI             | 🟡     | AI vult ontbrekende velden aan vanaf de officiële website (#16); admin kan eigen **feeds** toevoegen (#19). Eén losse conferentiewebsite toevoegen als nieuw record kan nog niet. |
| R2  | Inloggen met TestCoders Microsoft-account | 🔄     | PR #20 (Entra-login + accountrechten) en PR #12 (plan) staan open.                                                                                                                |
| R3  | Ervaringen: reviews, foto's, verslagen    | ✅     | PR #11: `/ervaringen`, max. 8 foto's (EXIF verwijderd), bewerktoken, moderatie in admin.                                                                                          |
| R4  | Kosten per conferentie + filter           | ✅     | PR #10, #15, #16: ticket + reis + hotel, standaardaanname, online = € 0, AI-schatting per land.                                                                                   |
| R5  | Persoonlijk overzicht en favorieten       | ❌     | "Geïnteresseerd" (#7) is een eerste stap; echte shortlist vraagt login (R2).                                                                                                      |

---

## 5. Afwijkingen en bekende problemen

### Procesafwijkingen (ter info, A moet nog reviewen)

- Niet alleen A heeft naar `main` gemerged. Voor het vervolg weer één integrator.
- C wijzigde A-bestanden (`globals.css`, `layout.tsx`, `public/`) voor stijl en menu.
- B voegde dependency `yaml` toe.
- Contractuitbreidingen zijn gemerged terwijl de commits "NIET MERGEN zonder akkoord" vermeldden:
  `online_only`, ticketvelden (#15), AI-velden (#16), afbeeldingen, `discovery_sources` (#19).
  Migraties zijn in Supabase gedraaid; akkoord van het team nog formeel vastleggen.
- #19 maakt een bewuste uitzondering op "nooit een URL uit gebruikersinput fetchen" (alleen admin,
  met SSRF-bescherming). `AGENTS.md` hierop aanpassen of de uitzondering expliciet goedkeuren.

### Bekende problemen

| #   | Probleem                                                                                                | Impact                                      | Eigenaar       | Grootte |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------- | ------- |
| K1  | Gedeeltelijke import (bijv. overgeslagen TBA-records) heet `failed`, ook als er records zijn ingelezen. | Admin ziet "failed" bij geslaagde import.   | B (+ A schema) | S       |
| K2  | Reviews en aanmeldingen zonder login of rate limiting; beheer via één gedeeld token.                    | Alleen geschikt voor gecontroleerd gebruik. | D + A          | M       |
| K3  | `npm run format:check` faalt lokaal op Windows door `core.autocrlf`.                                    | `npm run check` lokaal rood; CI groen.      | A              | XS      |
| K4  | Prettier sorteert Tailwind-classes met eigen kleurtokens niet goed.                                     | Alleen cosmetisch.                          | A              | XS      |
| K5  | Preview-deployments staan achter Vercel-login.                                                          | Reviewers kunnen PR-previews niet openen.   | A              | XS      |
| K6  | confs.tech-records krijgen altijd categorie `development`.                                              | Testing in confs.tech-data niet herkend.    | B              | M       |
| K7  | Gratis OpenRouter-modellen zijn traag en wisselend; slechts 1 officiële ticketprijs gevonden.           | Kosten vaak "excl. ticket".                 | B/D            | M       |
| K8  | Geen UI-tests.                                                                                          | Regressies pas zichtbaar in de browser.     | C              | M       |

---

## 6. Todo's

**Grootte:** XS < 15 min · S < 1 uur · M halve dag · L meerdere dagen

### Must — nodig voor de MVP

| #   | Todo                                                                                                                                                            | Eigenaar    | Grootte |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------- |
| M1  | **Geplande herimport:** Vercel Cron (dagelijks) voor alle bronnen, met timeout, retry en logging in `ingestion_runs`; daarna AI-verrijking voor nieuwe records. | B + A       | M       |
| M2  | **Betrouwbare importstatus:** status `partial` of `skipped` los van echte fouten; admin toont het duidelijk (K1).                                               | B + D (+ A) | S       |
| M3  | **Basisbeveiliging:** rate limiting op `POST /api/reviews`, `/api/attendances` en `/api/experiences`; reviewmoderatie in admin.                                 | D + A       | M       |
| M4  | **Login (R2):** PR #20 reviewen en mergen; daarna vrije naam vervangen door account, beheerrechten per persoon, RLS aanscherpen.                                | A + D       | L       |

### Should

| #   | Todo                                                                                                   | Eigenaar | Grootte |
| --- | ------------------------------------------------------------------------------------------------------ | -------- | ------- |
| S1  | A reviewt procesafwijkingen (§5) en legt contractakkoord vast; `AGENTS.md` bijwerken voor admin-feeds. | A        | S       |
| S2  | `.gitattributes` met `* text=auto eol=lf` (K3).                                                        | A        | XS      |
| S3  | Importgeschiedenis (`ingestion_runs`) tonen in `/admin`.                                               | D        | S       |
| S4  | Betere classificatie: testing/test-automation herkennen in confs.tech; extra feeds.                    | B        | M       |
| S5  | Officiële website periodiek opnieuw controleren op datum-, prijs- en CFP-wijzigingen.                  | B        | M       |
| S6  | Losse conferentie-URL toevoegen als `pending` record via AI-extractie (rest van R1).                   | B + D    | M       |
| S7  | Openstaande branches opruimen (`docs/roadmap`, `docs/updated-plan`, gemergde feature-branches).        | A        | XS      |

### Could

| #   | Todo                                                                       | Eigenaar | Grootte |
| --- | -------------------------------------------------------------------------- | -------- | ------- |
| C1  | Persoonlijk overzicht en favorieten met eigen agenda ernaast (R5, na M4).  | C        | M       |
| C2  | UI-tests voor zoeken, vergelijken, reviews, agenda en kosten (K8).         | C        | M       |
| C3  | Preview-deployments openbaar of via deel-link (K5).                        | A        | XS      |
| C4  | Wijzigingsgeschiedenis, bronprioriteit en conflictresolutie bij herimport. | B        | L       |

### Won't (nu)

- Automatisch onbekende websites ontdekken via zoekmachines.
- Externe reviews scrapen (alleen met toestemming, bronvermelding en herleidbaarheid).
- E-mailnotificaties.

---

## 7. Demo-script (± 3 minuten)

1. **Probleem (20 s):** conferenties en CFP-deadlines staan verspreid over veel websites.
2. **Ontdekken (40 s):** `$ beheer` → token → _Run discovery_ voor confs.tech en TestingConferences;
   toon found/inserted/updated. Nogmaals → `inserted: 0`.
3. **Explorer (30 s):** `$ conferenties` → zoek en filter op _Testing_ → logo's, kosten, open de officiële website.
4. **Vergelijken (20 s):** vink 2 conferenties aan → tabel met kosten en `Onbekend` waar niets bekend is.
5. **Kosten (20 s):** budgetfilter, toon "AI-schatting · datum" vs. officiële ticketprijs.
6. **Agenda (20 s):** 📅 Agenda → eigen `.ics` laden → botsingen → _Zet in mijn agenda_.
7. **Deelnemers en ervaringen (30 s):** `👥` → aanmelden; periode _Afgelopen_ → bijgewoond met sterren;
   `/ervaringen` → verslag met foto's.
8. **Beheer (20 s):** wijs een conferentie af; toon eigen bron en AI-verrijking.

**Fallback:** live bron faalt → toon eerder geïmporteerde echte records met `last_checked_at`; doe niet
alsof de herimport slaagde. Vercel faalt → lokaal met Supabase. Nooit fictieve data seeden.

---

## 8. Ideeën toevoegen

Iedereen mag hier een regel toevoegen. Niet meteen bouwen: eerst bespreken en een eigenaar kiezen.

| Idee | Waarde voor de gebruiker | Voorgesteld door |
| ---- | ------------------------ | ---------------- |
|      |                          |                  |

---

## 9. Referenties

- Vercel Function filesystem: https://vercel.com/docs/functions/runtimes
- Vercel Hobby voorwaarden: https://vercel.com/docs/plans/hobby
- Vercel Cron: https://vercel.com/docs/cron-jobs
- Supabase Next.js quickstart: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- confs.tech data: https://github.com/tech-conferences/conference-data
- TestingConferences: https://testingconferences.org/
- OpenRouter: https://openrouter.ai/docs
