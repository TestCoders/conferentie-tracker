# Conference Tracker — plan, status en todo's

**Peildatum:** 19 november 2026 · **`main`:** na PR #26 · **Productie:** https://conferentie-tracker.vercel.app
**Werkafspraken, branches en coding standard:** [AGENTS.md](AGENTS.md)

Dit is het enige plandocument. Het vervangt `HACKATHON_PLAN.md`, `updated_plan.md` en `ROADMAP.md`.
Bij tegenstrijdigheid wint dit bestand, daarna `AGENTS.md`.

**Productfocus:** conferenties voor development, softwaretesten en testautomatisering **automatisch
ontdekken en actueel houden**, met **vergelijking**, **ratings/reviews** en **backendadministratie**.

**Scopebewaker:** _eerst echte conferenties automatisch ontdekken, correct opslaan en zichtbaar maken;
pas daarna vergelijken, beoordelen en uitbreiden._

---

## 1. Status in één oogopslag

| Vraag                  | Antwoord                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| **Demo 1 — P0**        | ✅ 6 van 6                                                                                         |
| **Demo 1 — P1**        | ✅ 3 van 3                                                                                         |
| **Roadmap-ideeën (6)** | ✅ 4 gebouwd (R1–R4) · 🔄 2 in uitvoering (R5 favorieten, R6 wereldbol)                            |
| **MVP**                | ❌ **Nog niet.** 3 must-haves open: geplande herimport (M1), importstatus (M2), rate limiting (M3) |

**Data in productie** (`GET /api/conferences?period=all`, alleen `approved`): **251** conferenties
(107 confs.tech, 144 TestingConferences), waarvan **61** aankomend; 107 development, 131 testing,
13 test-automation. De nieuwe confs.tech-`testing.json`-feeds (#24) zijn nog **niet** ingelezen:
eerst een discovery-run in `/admin` (zie A1).

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
| Authenticatie | Microsoft Entra-login; beheer via Entra-app-rol Admin (geen `ADMIN_TOKEN`)                           |
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

Bron van waarheid: [src/lib/types.ts](src/lib/types.ts), [supabase/schema.sql](supabase/schema.sql) en
[supabase/migrations/](supabase/migrations/). Wijzigen alleen met akkoord van alle vier, via A.

Datums `YYYY-MM-DD`, IDs UUID, fouten `{ "error": "..." }` met passende status
(400 validatie, 401 auth, 404, 500, 501).

### Tabellen

| Tabel               | Doel                                                                 | Sinds                        |
| ------------------- | -------------------------------------------------------------------- | ---------------------------- |
| `conferences`       | Conferenties (+ `online_only`, ticketprijs, AI-velden, afbeeldingen) | basis, #10, #15, #16, images |
| `reviews`           | Rating 1–5 + korte review                                            | basis                        |
| `ingestion_runs`    | Logboek van discovery- en AI-runs                                    | basis                        |
| `attendances`       | Geïnteresseerd / bijgewoond, gekoppeld aan account                   | #7, #20                      |
| `experiences`       | Verslagen en foto's (Supabase Storage)                               | #11                          |
| `cost_assumptions`  | Reis/hotel per land en standaard (`*`)                               | #10, #15, #16                |
| `discovery_sources` | Door admin toegevoegde bronnen, formaat automatisch herkend          | #19, #23                     |
| `app_users`         | Entra-accounts (tenant, account-ID, rollen)                          | #20                          |

### Endpoints

| Endpoint                                                        | Auth    | Eigenaar |
| --------------------------------------------------------------- | ------- | -------- |
| `GET /api/conferences?period=upcoming\|past\|all`               | —       | A        |
| `POST /api/discovery/run` (`{ source }` of `{ sourceId }`)      | admin   | B        |
| `GET /api/admin/conferences`, `PATCH …/:id`                     | admin   | D        |
| `GET/POST /api/admin/sources`, `POST …/analyze`, `DELETE …/:id` | admin   | B/D      |
| `POST /api/admin/enrich` (`costs` / `conferences`)              | admin   | B/D      |
| `PUT/DELETE /api/admin/cost-assumptions`                        | admin   | D        |
| `DELETE /api/admin/experiences/:id`                             | admin   | D        |
| `GET /api/reviews`, `POST` (ingelogd)                           | account | D        |
| `GET /api/attendances`, `POST` (ingelogd), `GET …/summary`      | account | C        |
| `GET /api/experiences`, `POST` + `POST …/:id/photos` (ingelogd) | account | C        |
| `GET /api/cost-assumptions`, `GET /api/experiences/conferences` | —       | C        |
| `/api/auth/*` (Auth.js, Microsoft Entra)                        | —       | A        |

**Auth:** _admin_ = Entra-sessie met app-rol `ConferenceTracker.Admin`; _account_ = Entra-sessie met
`ConferenceTracker.User`. Lezen blijft publiek. Er is geen `ADMIN_TOKEN` meer (#26).

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

| Pakket                | Eigenaar      | Opgeleverd                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** Foundation      | Yuri Verweij  | Next.js-basis, contract, schema, Supabase-client, `GET /api/conferences` (+ `period`), CI, Vercel, Entra-login met app-rollen (#20, #26), `.gitattributes` (#22).                                                                                                                                                                                                       |
| **B** Discovery       | Kevin Groot   | confs.tech + TestingConferences (aankomend en afgelopen 12 maanden, #13), eigen bronnen via admin met SSRF-bescherming en automatische formaatherkenning (JSON-LD, iCal, AI; #19, #23), classificatie testing/test-automation incl. confs.tech `testing.json` (#24), online-detectie, idempotente upsert, `ingestion_runs`, logo's/afbeeldingen van officiële websites. |
| **C** Explorer        | Tim de Groot  | Lijst/kaarten/agenda, zoeken/filter/sorteren, vergelijken, huisstijl + licht/donker, hoofdmenu, `.ics`, deelnemers (#7), kostenschatting + budgetfilter (#10, #15), archief met periode/jaar (#17), `/ervaringen` met verslagen en foto's (#11), favorieten (#25).                                                                                                      |
| **D** Admin & reviews | Wouter Klaase | `/admin` met discovery-runs, statusfilter, approve/reject, correcties (incl. ticketprijs), eigen bronnen, AI-verrijking (#16), moderatie van ervaringen; reviews-API + component.                                                                                                                                                                                       |

### Roadmap-ideeën

| #   | Idee                                      | Status | Toelichting                                                                                                                                            |
| --- | ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Slimme discovery via URL + AI             | ✅     | AI-verrijking vanaf de officiële website (#16), eigen bronnen (#19) en automatische formaatherkenning per URL, met AI-extractie als `pending` (#23).   |
| R2  | Inloggen met TestCoders Microsoft-account | ✅     | #20 + #26: Entra-login, app-rollen User/Admin, geverifieerde auteur bij reviews, deelname en ervaringen; `ADMIN_TOKEN` verwijderd.                     |
| R3  | Ervaringen: reviews, foto's, verslagen    | ✅     | PR #11: `/ervaringen`, max. 8 foto's (EXIF verwijderd), moderatie in admin; schrijven sinds #20 alleen ingelogd.                                       |
| R4  | Kosten per conferentie + filter           | ✅     | PR #10, #15, #16: ticket + reis + hotel, standaardaanname, online = € 0, AI-schatting per land.                                                        |
| R5  | Persoonlijk overzicht en favorieten       | 🔄     | Basis in #25: ster, filter "Alleen favorieten", `.ics`-export, opslag per browser. **Tim** werkt verder (o.a. koppeling aan account, uitlijning ster). |
| R6  | Wereldbol met conferenties                | 🔄     | Conferenties op een interactieve wereldbol tonen. Wordt gebouwd door een teamlid.                                                                      |

---

## 5. Afwijkingen en bekende problemen

### Procesafwijkingen (ter info, A moet nog reviewen)

- Niet alleen A heeft naar `main` gemerged. Voor het vervolg weer één integrator.
- C wijzigde A-bestanden (`globals.css`, `layout.tsx`, `public/`) voor stijl en menu.
- B voegde dependency `yaml` toe.
- Contractuitbreidingen zijn gemerged terwijl de commits "NIET MERGEN zonder akkoord" vermeldden:
  `online_only`, ticketvelden (#15), AI-velden (#16), afbeeldingen, `discovery_sources` (#19).
  Migraties zijn in Supabase gedraaid; akkoord van het team nog formeel vastleggen.
- ✅ #19 haalt door een beheerder ingevoerde feeds op. `AGENTS.md` §4 beschrijft nu wanneer dat mag:
  alleen admin, alleen via een SSRF-veilige helper.

### Bekende problemen

| #   | Probleem                                                                                                            | Impact                                       | Eigenaar       | Grootte |
| --- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------- | ------- |
| K1  | Gedeeltelijke import (bijv. overgeslagen TBA-records) heet `failed`, ook als er records zijn ingelezen.             | Admin ziet "failed" bij geslaagde import.    | B (+ A schema) | S       |
| K2  | Schrijven vraagt nu login (#20), maar er is geen rate limiting en geen reviewmoderatie in admin.                    | Ingelogde gebruiker kan nog spammen.         | D + A          | M       |
| K3  | ✅ Opgelost met `.gitattributes` (`eol=lf`). Bestaande clone: eenmalig `git rm -r --cached . && git reset --hard`.  | —                                            | A              | XS      |
| K4  | Prettier sorteert Tailwind-classes met eigen kleurtokens niet goed.                                                 | Alleen cosmetisch.                           | A              | XS      |
| K5  | Preview-deployments staan achter Vercel-login.                                                                      | Reviewers kunnen PR-previews niet openen.    | A              | XS      |
| K6  | ✅ Opgelost in #24; wordt pas zichtbaar na een nieuwe discovery-run (A1).                                           | —                                            | B              | M       |
| K7  | Gratis OpenRouter-modellen zijn traag en wisselend; slechts 1 officiële ticketprijs gevonden.                       | Kosten vaak "excl. ticket".                  | B/D            | M       |
| K8  | Geen UI-tests.                                                                                                      | Regressies pas zichtbaar in de browser.      | C              | M       |
| K9  | CI draait de Node-tests (47 stuks, discovery + auth) niet; ze braken na #20/#23 ongemerkt (gerepareerd in #24/#26). | Regressies in import of auth vallen niet op. | A              | XS      |

---

## 6. Todo's

**Grootte:** XS < 15 min · S < 1 uur · M halve dag · L meerdere dagen

### Must — nodig voor de MVP

| #   | Todo                                                                                                                                                                                                        | Eigenaar    | Grootte |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------- |
| M1  | **Geplande herimport:** Vercel Cron (dagelijks) voor alle bronnen, met timeout, retry en logging in `ingestion_runs`; daarna AI-verrijking voor nieuwe records. Vraagt een cron-secret i.p.v. Entra-sessie. | B + A       | M       |
| M2  | **Betrouwbare importstatus:** status `partial` of `skipped` los van echte fouten; admin toont het duidelijk (K1).                                                                                           | B + D (+ A) | S       |
| M3  | **Basisbeveiliging:** rate limiting op `POST /api/reviews`, `/api/attendances` en `/api/experiences`; reviewmoderatie in admin (K2).                                                                        | D + A       | M       |
| M4  | ✅ **Login (R2):** Entra-login en rechten (#20, #26).                                                                                                                                                       | A + D       | L       |

### Acties direct na deze merges

| #   | Actie                                                                                                                                          | Wie      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A1  | In `/admin` (als Admin ingelogd) discovery draaien voor `confs-tech` en `confs-tech-past`: leest de testing-feeds in en werkt categorieën bij. | admin    |
| A2  | Controleren dat `20261119_entra_after_deploy.sql` is uitgevoerd (zie `docs/entra-auth.md`).                                                    | A        |
| A3  | Bestaande clones: eenmalig `git rm -r --cached . && git reset --hard` (schone working tree) voor LF.                                           | iedereen |

### Should

| #   | Todo                                                                                                                 | Eigenaar | Grootte |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| S1  | A reviewt procesafwijkingen (§5) en legt contractakkoord vast. (`AGENTS.md` voor admin-feeds: ✅)                    | A        | S       |
| S2  | ✅ `.gitattributes` met `* text=auto eol=lf` (K3).                                                                   | A        | XS      |
| S3  | Importgeschiedenis (`ingestion_runs`) tonen in `/admin`.                                                             | D        | S       |
| S4  | ✅ Betere classificatie: testing/test-automation herkennen, confs.tech `testing.json` (#24).                         | B        | M       |
| S5  | Officiële website periodiek opnieuw controleren op datum-, prijs- en CFP-wijzigingen.                                | B        | M       |
| S6  | ✅ URL toevoegen met automatische formaatherkenning, AI-extractie als `pending` (#23).                               | B + D    | M       |
| S7  | ✅ Gemergde branches opgeruimd; pakketbranches en branches van open PR's blijven.                                    | A        | XS      |
| S8  | Drie SSRF-implementaties samenvoegen tot één helper (`discovery/fetch-source`, `discovery/images`, `ai/safe-fetch`). | A + B    | S       |
| S9  | `npm test` toevoegen en in CI draaien (K9).                                                                          | A        | XS      |

### Could

| #   | Todo                                                                                    | Eigenaar | Grootte |
| --- | --------------------------------------------------------------------------------------- | -------- | ------- |
| C1  | 🔄 Favorieten (R5): basis in #25; koppeling aan account en verdere uitwerking door Tim. | C        | M       |
| C5  | 🔄 Wereldbol met conferenties (R6), door een teamlid.                                   | C        | M       |
| C2  | UI-tests voor zoeken, vergelijken, reviews, agenda en kosten (K8).                      | C        | M       |
| C3  | Preview-deployments openbaar of via deel-link (K5).                                     | A        | XS      |
| C4  | Wijzigingsgeschiedenis, bronprioriteit en conflictresolutie bij herimport.              | B        | L       |

### Won't (nu)

- Automatisch onbekende websites ontdekken via zoekmachines.
- Externe reviews scrapen (alleen met toestemming, bronvermelding en herleidbaarheid).
- E-mailnotificaties.

---

## 7. Demo-script (± 3 minuten)

1. **Probleem (20 s):** conferenties en CFP-deadlines staan verspreid over veel websites.
2. **Ontdekken (40 s):** inloggen met Microsoft (Admin) → `$ beheer` → _Run discovery_ voor confs.tech en TestingConferences;
   toon found/inserted/updated. Nogmaals → `inserted: 0`.
3. **Explorer (30 s):** `$ conferenties` → zoek en filter op _Testing_ → logo's, kosten, open de officiële website.
4. **Vergelijken (20 s):** vink 2 conferenties aan → tabel met kosten en `Onbekend` waar niets bekend is.
5. **Kosten (20 s):** budgetfilter, toon "AI-schatting · datum" vs. officiële ticketprijs.
6. **Agenda (20 s):** 📅 Agenda → eigen `.ics` laden → botsingen → _Zet in mijn agenda_.
7. **Favorieten (15 s):** ☆ bij twee conferenties → _Alleen favorieten_ → in één keer als `.ics`.
8. **Deelnemers en ervaringen (30 s):** ingelogd `👥` → aanmelden; periode _Afgelopen_ → bijgewoond met sterren;
   `/ervaringen` → verslag met foto's.
9. **Beheer (20 s):** wijs een conferentie af; voeg een bron-URL toe (formaat automatisch herkend).

**Fallback:** live bron faalt → toon eerder geïmporteerde echte records met `last_checked_at`; doe niet
alsof de herimport slaagde. Vercel faalt → lokaal met Supabase. Nooit fictieve data seeden.

---

## 8. Ideeën toevoegen

Iedereen mag hier een regel toevoegen. Niet meteen bouwen: eerst bespreken en een eigenaar kiezen.

| Idee              | Waarde voor de gebruiker            | Voorgesteld door |
| ----------------- | ----------------------------------- | ---------------- |
| Wereldbol (nu R6) | Visueel zien waar conferenties zijn | team             |

---

## 9. Referenties

- Vercel Function filesystem: https://vercel.com/docs/functions/runtimes
- Vercel Hobby voorwaarden: https://vercel.com/docs/plans/hobby
- Vercel Cron: https://vercel.com/docs/cron-jobs
- Supabase Next.js quickstart: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- confs.tech data: https://github.com/tech-conferences/conference-data
- TestingConferences: https://testingconferences.org/
- OpenRouter: https://openrouter.ai/docs
