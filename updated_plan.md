# Conference Tracker — bijgewerkt plan en status

**Peildatum:** 19 november 2026 · **`main`:** na PR #7 en #8 · **Productie:** https://conferentie-tracker.vercel.app
**Basis:** [HACKATHON_PLAN.md](HACKATHON_PLAN.md) (blijft leidend voor scope, schema en API-contract)

---

## 1. Antwoord in één oogopslag

| Vraag                                           | Antwoord                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| **Demo 1 — P0 (absoluut noodzakelijk)**         | ✅ **Klaar.** Alle 6 punten gehaald.                                         |
| **Demo 1 — P1 (zodra P0 werkt)**                | ✅ **3 van 3.** Vergelijken, tweede bron en reviews (met deelnemers) werken. |
| **MVP (product: ontdekken + actueel houden …)** | ❌ **Nog niet.** Zie §5: 3 must-haves open.                                  |

> **Kort:** de demo kan vandaag gegeven worden; alle punten van demo 1 zijn gehaald. Test vóór de
> demo één keer aanmelden en een review plaatsen op productie (§6). Voor een échte MVP zijn
> nog automatische verversing, betrouwbare importstatus en basisbeveiliging nodig.

**Legenda:** ✅ klaar en geverifieerd · 🟡 deels / met kanttekening · ❌ open · 🔍 volgens PR, niet zelf in de browser nagelopen

---

## 2. Definition of Done — demo 1

Geverifieerd op 19-11-2026 tegen productie (`GET /api/conferences`) en de gedeelde Supabase-DB (`GET /api/admin/conferences`).

### P0 — absoluut noodzakelijk

| #   | Eis                                                                       | Status | Bewijs                                                                                                               |
| --- | ------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | App bereikbaar op Vercel                                                  | ✅     | `conferentie-tracker.vercel.app` publiek, HTTP 200; laatste deploy van `main` geslaagd.                              |
| 2   | Eén klik op Discover/Refresh haalt echte gegevens uit live bron           | ✅ 🔍  | `/admin` → _Run discovery_ (PR #2) roept `POST /api/discovery/run` aan (PR #3, #6). Endpoint geeft 401 zonder token. |
| 3   | ≥ 5 echte conferenties na API-call in Supabase                            | ✅     | **57** records (20 confs.tech, 37 TestingConferences), `last_checked_at` 19-11 10:28–10:33. Geen handmatige records. |
| 4   | Zichtbaar als kaarten of lijst: naam, datum, locatie, categorie, bronlink | ✅     | Lijst-, kaart- en agendaweergave (PR #1, #4). Onbekende velden tonen `Onbekend`.                                     |
| 5   | Herhaalde run maakt geen duplicaten                                       | ✅     | 57 rijen = 57 unieke `(canonical_url, start_date)`. Upsert + tests in PR #3/#6 (tweede run `inserted = 0`).          |
| 6   | Beheerder kan import starten, uitkomst zien, goedkeuren/afwijzen          | ✅ 🔍  | PR #2: token in React state, found/inserted/updated/errors, statusfilter, approve/reject, beperkte correcties.       |

### P1 — toevoegen zodra P0 werkt

| #   | Eis                                                                | Status | Toelichting                                                                                                                                         |
| --- | ------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | 2 conferenties vergelijken (datum, locatie, categorie, CFP, prijs) | ✅     | PR #1. Prijs is altijd `Onbekend` (geen bron levert prijs) — conform plan, niets verzonnen.                                                         |
| 8   | 1–5-sterrenrating + korte review, zichtbaar na refresh             | ✅ 🔍  | PR #7: per conferentie een paneel met reviews (component van D), deelnemers en aanmelden. Leesroutes geverifieerd; schrijfpad nog handmatig testen. |
| 9   | Tweede echte bron: TestingConferences.org                          | ✅     | PR #6: 37 records, waarvan 2 `test-automation`; 2 TBA-records overgeslagen en gemeld, geen datums verzonnen.                                        |

---

## 3. Status per werkpakket

| Pakket                | Eigenaar      | PR's           | Status | Opgeleverd                                                                                                                                                                                          |
| --------------------- | ------------- | -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** Foundation      | Yuri Verweij  | basiscommit    | ✅     | Next.js 16-basis, contract (`types.ts`), schema, Supabase-client, `GET /api/conferences`, CI, Vercel-koppeling met env-variabelen.                                                                  |
| **B** Discovery       | Kevin Groot   | #3, #6         | ✅     | confs.tech (2027 JS + DevOps) en TestingConferences (YAML), validatie, URL-normalisatie, idempotente upsert, `ingestion_runs`, 10 tests. Moderatiestatus blijft behouden bij herimport.             |
| **C** Explorer        | Tim de Groot  | #1, #4, #5, #7 | ✅     | Lijst/kaarten/agenda, zoeken, filter, sorteren, vergelijken, TestCoders-huisstijl, licht/donker, hoofdmenu, eigen agenda (.ics) + export, reviews en deelnemers (interesse/bijgewoond met sterren). |
| **D** Admin & reviews | Wouter Klaase | #2             | ✅     | `/admin` met discovery-run, lijst + statusfilter, approve/reject, correcties; `GET/PATCH /api/admin/conferences`; `GET/POST /api/reviews`; `Reviews`-component (in de explorer sinds PR #7).        |

### PR-overzicht

| PR  | Pakket | Titel                                                       | Status    |
| --- | ------ | ----------------------------------------------------------- | --------- |
| #1  | C      | overzicht, vergelijking, lijstweergave en TestCoders-stijl  | ✅ merged |
| #2  | D      | beheeromgeving en ratings/reviews                           | ✅ merged |
| #3  | B      | import and deduplicate live confs.tech records              | ✅ merged |
| #4  | C      | agendaweergave met eigen agenda (.ics) en export            | ✅ merged |
| #5  | C      | hoofdmenu om te wisselen tussen overzicht en beheer         | ✅ merged |
| #6  | B      | TestingConferences YAML adapter                             | ✅ merged |
| #7  | C      | reviews en deelnemers (interesse/bijgewoond) op de homepage | ✅ merged |
| #8  | —      | roadmap uitgewerkt met vijf ideeën voor na demo 1           | ✅ merged |

Alle CI-checks (`check`, Vercel) waren groen bij merge. Ideeën voor later staan in [ROADMAP.md](ROADMAP.md).

### Gebouwd buiten het oorspronkelijke plan

- **Agendaweergave** met drukte per maand, maandkalender, eigen agenda naast de conferenties (`.ics`, alleen in de browser) en `.ics`-export per conferentie.
- **TestCoders-huisstijl** (kleuren, fonts, logo) en **licht/donker-toggle** zonder thema-flits.
- **Hoofdmenu** tussen overzicht en beheer op alle pagina's.
- **Deelnemers:** mensen melden zich met hun naam aan als _geïnteresseerd_ of _bijgewoond_; bij bijgewoond met sterren en review. Per conferentie zie je wie er gaat of was, en met welke rating; ook in de vergelijking.

---

## 4. Afwijkingen en bekende problemen

### Procesafwijkingen (bewust, ter info)

| Afwijking                                                                        | Gevolg / actie                                                        |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Niet alleen A heeft naar `main` gemerged (ook B, C, D).                          | Werkte zonder conflicten; voor vervolg weer één integrator afspreken. |
| C wijzigde A-bestanden (`globals.css`, `layout.tsx`, `public/`) voor stijl/menu. | Met akkoord productowner; A moet dit nog reviewen.                    |
| B voegde dependency `yaml` toe (`package.json`).                                 | Met akkoord productowner; A moet dit nog reviewen.                    |
| C breidde het contract uit: tabel `attendances` + types (PR #7).                 | Met akkoord productowner; migratie is in Supabase gedraaid.           |

### Bekende problemen

| #   | Probleem                                                                                                                        | Impact                                                             | Eigenaar              | Grootte |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------- | ------- |
| P1  | Aanmelden en review plaatsen nog niet end-to-end getest tegen de gedeelde DB (alleen validatie en leesroutes).                  | Kleine kans op fout in de demo.                                    | C (handmatig)         | XS      |
| P1b | Homepage toont alleen aankomende conferenties; _bijgewoond_ kan pas vanaf de begindatum.                                        | Achteraf beoordelen kan pas met een archiefweergave.               | A + C                 | S       |
| P2  | Gedeeltelijke import (bijv. overgeslagen TBA-records) markeert de run als `failed`, ook als er wel records zijn ingelezen.      | Admin ziet "failed" bij een geslaagde import → verwarrend in demo. | B                     | S       |
| P3  | `npm run format:check` faalt lokaal op Windows door `core.autocrlf` (CRLF vs LF).                                               | `npm run check` lokaal rood; CI is groen.                          | A                     | XS      |
| P4  | Prettier sorteert Tailwind-classes met eigen kleurtokens niet goed (`bg-surface` e.d.).                                         | Alleen cosmetisch in de diff.                                      | A                     | XS      |
| P5  | Preview-deployments staan achter Vercel-login.                                                                                  | Reviewers kunnen PR-previews niet openen.                          | A                     | XS      |
| P6  | Bronnen leveren beperkte velden: 5 van 56 hebben een CFP-deadline, 0 een prijs, 5 geen stad; `online` zit niet in het contract. | Veel `Onbekend` in vergelijking.                                   | B (+ A voor contract) | M       |
| P7  | Reviews zonder login of rate limiting; admin alleen via één gedeeld token.                                                      | Alleen geschikt voor een gecontroleerde demo.                      | D (+ A)               | M       |

---

## 5. Wat ontbreekt nog voor de MVP?

**MVP-definitie** (uit de productfocus): conferenties voor development, softwaretesten en
testautomatisering **automatisch ontdekken en actueel houden**, met **vergelijking**,
**ratings/reviews** en **backendadministratie**.

| Onderdeel                      | Nu                                       | Nodig voor MVP                                                                                 | Prio       | Eigenaar                | Grootte |
| ------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- | ----------------------- | ------- |
| Ontdekken                      | ✅ 2 bronnen, 57 records                 | —                                                                                              | —          | —                       | —       |
| Reviews in de UI               | ✅ reviews + deelnemers (PR #7)          | —                                                                                              | —          | —                       | —       |
| Archief afgelopen conferenties | ❌                                       | Afgelopen conferenties tonen, zodat bezoekers achteraf _bijgewoond_ en sterren kunnen geven.   | Should     | A + C                   | S       |
| **Actueel houden**             | 🟡 alleen handmatige herimport           | Geplande herimport (Vercel Cron, dagelijks) met timeout, retry en logging in `ingestion_runs`. | **Must**   | B + A                   | M       |
| **Betrouwbare importstatus**   | 🟡 deels geslaagde run = `failed`        | Status `partial` of fouten splitsen in `skipped` vs. echte fouten; admin toont het duidelijk.  | **Must**   | B + D (+ A voor schema) | S       |
| **Basisbeveiliging**           | 🟡 gedeeld token, open review-POST       | Rate limiting op `POST /api/reviews`, reviewmoderatie in admin, sterker admin-token beheer.    | **Must**   | D + A                   | M       |
| Vergelijken                    | ✅                                       | —                                                                                              | —          | —                       | —       |
| Backendadministratie           | ✅ approve/reject, correcties            | Eventueel: importgeschiedenis (`ingestion_runs`) tonen in `/admin`.                            | Should     | D                       | S       |
| Betere classificatie           | 🟡 confs.tech altijd `development`       | Testing/test-automation herkennen in confs.tech-data; extra feeds (bijv. `testing.json`).      | Should     | B                       | M       |
| Rijkere gegevens               | 🟡 weinig CFP, geen prijs, geen `online` | `online`-veld in contract en UI; CFP/prijs alleen uit betrouwbare bronnen.                     | Could      | A + B + C               | M       |
| Tests UI                       | ❌                                       | UI-tests voor zoeken, vergelijken, reviews en agenda.                                          | Could      | C                       | M       |
| Gebruikersaccounts             | ❌                                       | Pas na MVP (zie HACKATHON_PLAN.md §10).                                                        | Won't (nu) | —                       | L       |

**Grootte:** XS < 15 min · S < 1 uur · M halve dag · L meerdere dagen

---

## 6. Voorgestelde volgende stappen

### Stap 1 — demo 1 afronden (vandaag, ±1 uur)

1. **C:** DoD #8 handmatig testen op productie: aanmelden als geïnteresseerd → zelfde naam als bijgewoond met sterren (bij een lopende conferentie) → refresh → zichtbaar. Testregels daarna verwijderen.
2. **B:** gedeeltelijke import niet meer als `failed` tonen (of in admin duidelijk "x overgeslagen" melden).
3. **A:** review van de stijl-/layoutwijzigingen (C) en de `yaml`-dependency (B); `.gitattributes` met `* text=auto eol=lf` toevoegen.
4. **Iedereen:** demo-script (§7) één keer volledig doorlopen op productie.

### Stap 2 — MVP (na de demo)

1. Geplande herimport via Vercel Cron (B + A).
2. Rate limiting en reviewmoderatie (D + A).
3. Importgeschiedenis in `/admin` (D).
4. Betere classificatie en extra bronnen (B).
5. `online`-veld via contractwijziging, met akkoord van alle vier (A → B, C).

---

## 7. Bijgewerkt demo-script (2–3 minuten)

1. **Probleem (30 s):** conferenties en CFP-deadlines staan verspreid over veel websites.
2. **Ontdekken (40 s):** `$ beheer` in het menu → token invullen → _Run discovery_ voor confs.tech en daarna TestingConferences; toon found/inserted/updated.
3. **Geen dubbelen (20 s):** dezelfde run nogmaals → `inserted: 0`.
4. **Explorer (30 s):** `$ conferenties` → zoek en filter op _Testing_ of _Testautomatisering_ → open de officiële website.
5. **Vergelijken (20 s):** vink 2 conferenties aan → vergelijkingstabel met `Onbekend` bij ontbrekende prijs/CFP.
6. **Agenda (30 s):** 📅 Agenda → drukste maand → eigen `.ics` laden → botsingen in rood → _Zet in mijn agenda_.
7. **Deelnemers en reviews (30 s):** klik op `👥` bij een conferentie → meld je aan als geïnteresseerd; bij een lopende conferentie: bijgewoond met sterren → zie je naam, status en rating in de lijst en in de vergelijking.
8. **Beheer (20 s):** wijs een conferentie af in `/admin`.

**Fallback:** live bron faalt → toon de eerder geïmporteerde echte records met `last_checked_at`; doe niet alsof de herimport slaagde. Geen fictieve data seeden.
