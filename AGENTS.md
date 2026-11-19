# AGENTS.md — Conference Tracker

Instructies voor iedere developer **en** iedere AI-coding-agent in deze repo.
Lees eerst [HACKATHON_PLAN.md](HACKATHON_PLAN.md); dat is leidend voor scope, schema en API-contract.
Bij tegenstrijdigheid wint `HACKATHON_PLAN.md`, daarna dit bestand.

## 1. Startinstructie voor je agent

> Werk **uitsluitend** aan werkpakket **[A/B/C/D]** uit `HACKATHON_PLAN.md`. Respecteer de bestanden in
> de eigenaarstabel hieronder, het SQL-schema en het API-contract in `src/lib/types.ts`. Bouw de kleinste
> verifieerbare stap, draai `npm run check`, commit op je eigen branch en rapporteer:
> **afgerond / gewijzigde bestanden / getest / blokkades**. Wijzig geen bestanden van andere
> werkpakketten; meld benodigde contractwijzigingen aan de integrator (A).

## 2. Werkpakketten, branches en bestandseigenaarschap

| Pakket                        | Branch               | Mag wijzigen                                                                                                                                                                                                                                                  |
| ----------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** Foundation / integrator | `feat/foundation`    | `src/lib/types.ts`, `src/lib/supabase-admin.ts`, `src/lib/http.ts`, `src/app/api/conferences/**`, `src/app/layout.tsx`, `src/app/globals.css`, `supabase/**`, `.env.example`, `package.json`, `package-lock.json`, configbestanden, `.github/**`, `AGENTS.md` |
| **B** Discovery               | `feat/discovery`     | `src/lib/discovery/**`, `src/app/api/discovery/**`                                                                                                                                                                                                            |
| **C** Explorer                | `feat/explorer`      | `src/app/page.tsx`, `src/components/explorer/**`                                                                                                                                                                                                              |
| **D** Admin & reviews         | `feat/admin-reviews` | `src/app/admin/**`, `src/components/admin/**`, `src/components/reviews/**`, `src/app/api/admin/**`, `src/app/api/reviews/**`                                                                                                                                  |

Iedereen mag regels **toevoegen** aan `ROADMAP.md` (ideeën voor later — niet nu bouwen).

Een bestand buiten je eigen rij nodig? **Niet zelf aanpassen.** Vraag het aan de eigenaar of aan A.
De boilerplate bevat al een stub voor ieder pakket (zoek op `TODO(B)`, `TODO(C)`, `TODO(D)`).

## 3. Git-workflow

```bash
# Eenmalig
git fetch origin
git switch -c feat/<jouw-pakket> origin/main   # of: git switch feat/<jouw-pakket>
npm install
cp .env.example .env.local                      # waarden krijg je van A via een veilig kanaal
npm run dev

# Tijdens het werk — na ieder werkend checkpoint
npm run check
git add <alleen jouw bestanden>
git commit -m "feat(discovery): upsert confs.tech records"
git push -u origin HEAD

# main binnenhalen (doe dit na iedere integratie door A)
git fetch origin
git rebase origin/main          # alleen op je eigen branch; daarna: git push --force-with-lease
```

Regels:

1. **Nooit direct naar `main` pushen.** Alleen A merget naar `main` (integratiemomenten T+30 en T+40).
2. Eén branch per pakket; geen werk op andermans branch. Rebase/force-push alleen op je **eigen** branch, en dan altijd `--force-with-lease`.
3. Kleine PR's naar `main` met het PR-template; titel in Conventional-Commits-vorm.
4. Commitberichten: [Conventional Commits](https://www.conventionalcommits.org/) met pakket-scope:
   `feat(foundation)`, `feat(discovery)`, `feat(explorer)`, `feat(admin)`, `feat(reviews)`, `fix(...)`, `chore(...)`, `docs(...)`.
5. Geen `git add -A` / `git add .` zonder te kijken: commit alleen bestanden uit je eigen rij.
6. Nooit `.env.local`, tokens of keys committen. Controleer `git diff --staged` vóór iedere commit.
7. Na T+50 **feature freeze**: alleen nog fixes, en alleen via A.

## 4. Coding standard

### Tooling (verplicht groen vóór iedere PR)

| Commando            | Doel                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `npm run format`    | Prettier toepassen (single quotes, puntkomma, 100 kolommen, Tailwind-klassen gesorteerd) |
| `npm run lint`      | ESLint (`eslint-config-next`)                                                            |
| `npm run typecheck` | TypeScript strict, zonder build                                                          |
| `npm run check`     | Alles hierboven + `next build` — **dit draait ook in CI**                                |

### TypeScript

- `strict` staat aan. **Geen `any`**; gebruik `unknown` + narrowing. Geen `@ts-ignore`; `@ts-expect-error` alleen met uitleg.
- Domeintypes komen **altijd** uit `@/lib/types` (`Conference`, `Review`, `DiscoveryRunResponse`, …). Definieer nooit een eigen variant van `Conference`.
- Imports via alias `@/…`, niet `../../..`.
- Named exports voor componenten en helpers; `default export` alleen waar Next.js dat eist (`page.tsx`, `layout.tsx`).
- Bestandsnamen: componenten `PascalCase.tsx`, overige modules `kebab-case.ts`.
- Kleine pure functies boven klassen. Geen ORM, geen extra state-library.

### Data & API

- Data-afspraken uit het contract: datums `YYYY-MM-DD`, IDs UUID, onbekend = `null` (nooit `''` en **nooit verzonnen**). In de UI tonen we `null` als `Onbekend`.
- Alle DB-toegang **alleen server-side** via `getSupabaseAdmin()` uit `@/lib/supabase-admin`. Nooit importeren in een `'use client'`-bestand.
- Geen environment variable met `NEXT_PUBLIC_` voor secrets. Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN`.
- Beheer-endpoints beginnen met:
  ```ts
  const denied = await requireAdmin(request);
  if (denied) return denied;
  ```
- Fouten: `jsonError(message, status)` uit `@/lib/http` → `{ "error": "..." }` met passende status (400 validatie, 401 auth, 404 niet gevonden, 500 server, 501 nog niet gebouwd).
- Valideer **alle** request-input server-side (types, lengtes, whitelist van velden). Nooit ongefilterde body naar de DB.
- Discovery: alleen vaste, bekende bron-URL's; nooit een URL uit gebruikersinput fetchen. Upsert op `(canonical_url, start_date)`, nooit blind `insert`.
- Geen fictieve conferenties of reviews seeden. Mocks alleen tijdelijk in je eigen UI-branch en vóór merge verwijderen.

### Next.js 16 / React 19

- App Router. Route handlers in `route.ts` met `export async function GET/POST/PATCH(request: Request, ctx)`.
- Dynamische params zijn een **Promise**: `const { id } = await ctx.params` met `RouteContext<'/api/.../[id]'>`.
- Server Components standaard; `'use client'` alleen waar state/effects/events nodig zijn.
- Styling met Tailwind-utility-classes; geen CSS-modules of UI-library zonder akkoord van A.
- Toegankelijkheid: echte `<button>`/`<label>`/`<a>`, externe links met `rel="noopener noreferrer"`.

### Dependencies

Nieuwe dependency? **Eerst aan A vragen.** A beheert `package.json` en de lockfile. Native `fetch`, HTML en Tailwind zijn bijna altijd genoeg.

## 5. Definition of done per commit/PR

- [ ] `npm run check` is groen (of je meldt expliciet wat faalt en waarom).
- [ ] Alleen bestanden uit je eigen rij gewijzigd.
- [ ] Contract (`src/lib/types.ts`, `supabase/schema.sql`) niet gewijzigd zonder akkoord van alle vier.
- [ ] Geen secrets, geen mockdata, geen `console.log`-ruis in de diff.
- [ ] Handmatig getest (beschrijf in de PR hoe).

## 6. Handige commando's

```bash
curl -s localhost:3000/api/conferences | jq
curl -s -X POST localhost:3000/api/discovery/run \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"source":"confs-tech"}' | jq
```

## Authenticatie na demo 1

Microsoft Entra-login gebruikt de server-side Auth.js-sessie. `requireAdmin(request)` is asynchroon:
altijd `await` gebruiken vóór databasewerk. De gedeelde `ADMIN_TOKEN` geeft geen toegang meer.
User/Admin-rechten komen uit de vaste tenant en toegewezen app-rollen. Bijdragen vereisen
`requireUser(request)`; auteur en user-ID worden server-side bepaald. Zie
[`docs/entra-auth.md`](docs/entra-auth.md) voor contractmigratie, sessiegedrag en tests.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
