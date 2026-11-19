# Roadmap — ideeën voor ná demo 1

Iedereen mag hier ideeën toevoegen. **Niet bouwen tijdens het hackathon-uur.**
Zie ook [HACKATHON_PLAN.md §10](HACKATHON_PLAN.md).

## Overzicht

| #   | Idee                                         | Waarde voor de gebruiker                                     | Bouwt voort op                 |
| --- | -------------------------------------------- | ------------------------------------------------------------ | ------------------------------ |
| 1   | Slimme discovery via URL + AI                | Elke conferentiewebsite toevoegen, niet alleen vaste bronnen | Discovery (B)                  |
| 2   | Inloggen met TestCoders Microsoft-account    | Betrouwbare identiteit voor reviews, aanmeldingen en beheer  | Auth (nieuw)                   |
| 3   | Ervaringen delen: reviews, foto's, verslagen | Collega's leren van elkaars bezoek                           | Reviews + deelnemers (PR #7)   |
| 4   | Kosten per conferentie, met filter           | Vooraf zien wat een bezoek kost en daarop selecteren         | Explorer (C), datamodel (A)    |
| 5   | Persoonlijk overzicht en favorieten          | Eigen shortlist van conferenties die je wilt bijwonen        | Deelnemers (PR #7), login (#2) |

## 1. Slimme discovery via URL en AI

**Wat:** een beheerder voert de URL van een conferentiewebsite in. Een AI-integratie (bijvoorbeeld via
OpenRouter) leest de pagina en haalt de relevante gegevens eruit: naam, datums, locatie, CFP,
prijs en categorie. Het resultaat wordt in het bestaande datamodel opgeslagen, met de juiste tags.

**Waarom:** nu ontdekken we alleen conferenties uit vaste bronnen (confs.tech en
TestingConferences). Hiermee kan elk relevant evenement worden toegevoegd.

**Aandachtspunten:**

- Alleen voor beheerders, en nieuwe vondsten krijgen status `pending` tot een beheerder ze goedkeurt.
- Beveiliging: het ophalen van een door de gebruiker ingevoerde URL vraagt bescherming tegen SSRF
  (alleen `https`, geen interne adressen, timeouts en limieten op de grootte).
- Geen verzonnen gegevens: wat de AI niet zeker weet, blijft `null` (`Onbekend`); bron-URL en
  tijdstip van extractie worden bewaard.

## 2. Inloggen met TestCoders Microsoft-account

**Wat:** inloggen via Microsoft Entra ID (single sign-on) met het TestCoders-account.

**Waarom:** nu kan iedereen elke naam opgeven en is beheer beveiligd met één gedeeld token. Met
login weten we wie een review schrijft of zich aanmeldt, en kunnen we beheerrechten per persoon
toekennen.

**Aandachtspunten:** vervangt de vrije naam bij reviews en aanmeldingen; beheerrollen koppelen aan
groepen in Entra ID; daarna de Supabase-RLS-policies aanscherpen.

### Bijgewerkt uitvoeringsplan: e-mailcode voor uitsluitend testcoders.nl

**Besluit (19 november 2026):** voor de eerste implementatie gebruiken we Supabase Auth met een
eenmalige e-mailcode. Dit vervangt het Entra-/Microsoft-SSO-voorstel hierboven. Er is geen Entra
appregistratie nodig. Alleen toegang tot een geverifieerde mailbox op exact `testcoders.nl` geeft
toegang; dit bewijst mailboxbezit, niet automatisch een arbeidsrelatie of Entra-groepslidmaatschap.
Microsoft SSO en groepskoppeling kunnen later worden toegevoegd.

**Gebruikersflow:** e-mailadres invoeren → code ontvangen → code invoeren → ingelogd. De
conferentielijst blijft publiek; reviews en aanmeldingen vereisen login. Beheer vereist daarnaast
een expliciet toegekende adminrol. Geen publieke weergave van volledige e-mailadressen.

#### 1. Auth en e-mailbezorging configureren — A / nieuw auth-werkpakket

- Supabase Auth inschakelen voor e-mailcodes; de e-mailtemplate toont de code in plaats van een
  magic link. Andere loginproviders en anonieme login niet inschakelen voor deze eerste versie.
- Productie-e-mailbezorging via eigen SMTP/provider configureren, inclusief afzenderverificatie
  en vereiste DNS-records. Een Microsoft-mailbox mag de code ontvangen; Entra-integratie is niet nodig.
- Codeverval voorstellen op 10 minuten; codes zijn eenmalig. Verzend- en verificatiepogingen
  begrenzen per adres en IP, gedeeld over serverinstances; geen accountbestaan onthullen in fouten.
- Site-URL en toegestane redirects expliciet instellen voor localhost, een vaste testomgeving en
  productie. Benodigde SSR/sessiondependency en environment variables eerst via A afspreken.

#### 2. Domeinrestrictie en sessies bouwen — A / auth

- Alleen een geldig e-mailadres met exact domein `testcoders.nl` accepteren, hoofdletterongevoelig.
  Geen subdomeinen, suffixtrucs zoals `testcoders.nl.example.com` of andere domeinen toelaten.
- Domein server-side controleren vóór codeverzending; een Supabase Before User Created-hook blokkeert
  ook directe registraties buiten het domein. Alleen controle in het formulier is onvoldoende.
- Na codeverificatie en bij iedere beschermde API-aanroep de actuele, door Supabase geverifieerde
  identiteit controleren. Een ontbrekend/onbevestigd e-mailadres, ander domein of gedeactiveerd
  applicatieaccount krijgt geen toegang. Vertrouw geen zelf ingevulde profielmetadata of losse user-ID.
- E-mailwijzigingen eveneens begrenzen: geen toegang met een gewijzigd adres buiten het domein,
  ook niet via directe Auth-aanroepen. Een nieuw adres vereist verificatie; test bestaande sessies.
- Server-side login-, verificatie-, sessie- en logoutafhandeling toevoegen. Sessiecookies, verval,
  refresh, CSRF-bescherming en accountblokkering volgens de gekozen Supabase SSR-integratie uitwerken.
  Codes, sessietokens en service-role keys nooit loggen of in frontendopslag plaatsen.
- Een account heeft een stabiele Supabase Auth-UUID. Een weergavenaam is slechts profielinformatie:
  e-mailverificatie levert geen door Microsoft geverifieerde persoonsnaam op.

#### 3. Rollen veilig opslaan — A / auth

- Een beschermde `user_roles`-tabel voorstellen met `user_id` als FK naar `auth.users`, rol
  `employee`/`admin`, wijzigingstijdstip en uitvoerende beheerder. Nieuwe toegelaten gebruikers
  krijgen employee-rechten; geen automatische promotie op basis van e-mailadres of profielmetadata.
- De eerste admin na diens eerste geverifieerde login via een gecontroleerde databasehandeling
  aanwijzen. Het adres helpt het account te vinden; de rol wordt aan diens UUID gekoppeld.
- Eerste versie: rollen verlenen/intrekken via bevoegde Supabase-beheerders. Een rollenbeheerscherm
  is een aparte vervolgstap, met auditlog en bescherming tegen verwijderen van de laatste admin.
- `requireUser()` en `requireAdmin()` controleren server-side identiteit, accountstatus en actuele rol.
  Rollen niet langdurig uitsluitend in een sessie cachen: intrekken geldt bij de volgende beheeraanroep.
- Accountblokkering vastleggen voor uitdiensttreding; mailboxverlies beëindigt bestaande appsessies
  niet vanzelf. Test blokkering en hergebruik van een e-mailadres door een ander Auth-account.

#### 4. Reviews en deelnemers migreren — A + C + D

- Vooraf één nieuwe contractversie afspreken: `user_id` toevoegen aan reviews en attendances;
  attendance-uniciteit wordt `(conference_id, user_id)`, niet langer `(conference_id, name_key)`.
- Naamvergelijking tussen deelnemers en reviews vervangen door koppeling op user-ID. Voorstel:
  één actuele review per gebruiker per conferentie; beide schrijfpaden werken dezelfde review bij.
  Een gecombineerde attendance/review-wijziging atomair opslaan om halve resultaten te voorkomen.
- `reviewerName` en `personName` niet meer als identiteit uit requestbodies accepteren. De server
  bepaalt de auteur uit de sessie; een eventuele weergavenaam komt uit het gebruikersprofiel.
- Gebruikers mogen uitsluitend hun eigen bijdrage aanpassen. Bestaande anonieme records blijven
  herkenbaar als legacy, met nullable user-ID; nooit automatisch claimen op basis van dezelfde naam.
- Migratie gefaseerd uitvoeren: eerst schema uitbreiden, daarna API/UI omschakelen en oude anonieme
  schrijfpaden sluiten. Pas daarna oude naamconstraints verwijderen; legacygegevens behouden.

#### 5. Beheer, interface en databeveiliging omschakelen — A + B + C + D

- Header: inloggen, ingelogde weergavenaam en uitloggen. Review- en deelnameformulieren tonen een
  loginactie in plaats van vrije auteursnaamvelden. Beheernavigatie alleen voor admins tonen.
- Alle adminroutes en `POST /api/discovery/run` laten autoriseren via `requireAdmin()`;
  de gedeelde `ADMIN_TOKEN` uit menselijke login en admin-UI verwijderen. Eventuele cron-authenticatie
  apart ontwerpen, zonder publieke terugval op de oude beheertoken.
- Zonder login `401`, zonder vereiste rechten `403`; terugkeer na login beperken tot interne paden.
- DB-verkeer blijft via Next.js API-routes lopen. Voor gebruikersacties een server-side Supabase-client
  met gebruikerssessie voorstellen, zodat RLS eigen records en adminrechten kan afdwingen. Dit vereist
  expliciete aanpassing van de huidige afspraak dat alle DB-toegang via `getSupabaseAdmin()` loopt.
- Service-role client alleen behouden voor gecontroleerde systeemtaken. Die omzeilt RLS: zolang een
  route deze client gebruikt, blijven expliciete server-side eigendoms- en rechtenchecks noodzakelijk.
- Profielen en rollen afschermen met RLS/kolomrechten; niemand mag zichzelf promoveren. Publieke
  leesresponses bevatten uitsluitend toegestane conferentie-/review-/deelnemersvelden, geen e-mails
  of rolinformatie. Geen publieke directe schrijftoegang aan Supabase toevoegen.

#### 6. Acceptatie, oplevering en afhankelijkheden

- Tests: geldige TestCoders-mailbox, ander domein, domein-hoofdletters, suffixtrucs, directe
  Auth-aanroepen, ongeldig/verlopen/hergebruikt code, verzend- en verificatielimieten, logout en refresh.
- Tests: ongeverifieerd/gewijzigd adres, gedeactiveerde gebruiker met bestaande sessie, medewerker
  tegenover admin, ingetrokken adminrol, rol-escalatie, author-spoofing en aanpassen van andermans data.
- Beide review-schrijfpaden, herhaalde attendance-updates, legacyrecords en rollback van de migratie
  verifiëren; RLS afzonderlijk testen met anon-, gebruikers- en service-role clients.
- `npm run check` en een volledige login → deelname → review → beheer-test op een vaste preview.
  Productie-e-mailbezorging met echte TestCoders-mailboxen verifiëren vóór de uitrol.
- Opleveren in checkpoints: (1) domeingebonden e-mailcode-login, (2) accountgebonden reviews en
  deelname, (3) adminrollen en tokenverwijdering, (4) RLS en volledige acceptatie vóór productierollout.
- Vooraf nodig: toegang tot Supabase Auth-configuratie, SMTP-/afzenderconfiguratie en eventueel DNS,
  keuze van de eerste admin en akkoord op schema, API-contract, dependencies en nieuw auth-eigenaarschap.
  De vaste A/B/C/D-eigenaarsgrenzen blijven gelden totdat de integrator die expliciet bijwerkt.

## 3. Ervaringen delen: reviews, foto's en verslagen

**Wat:** per conferentie naast sterren en een korte review ook foto's, een uitgebreider verslag en
tips (bijvoorbeeld "beste talks" of "handig hotel") kunnen delen.

**Waarom:** collega's kunnen zien wat anderen aan een conferentie hadden voordat ze zelf gaan.

**Aandachtspunten:** bouwt voort op de reviews en deelnemers uit PR #7. Foto's vragen opslag
(bijvoorbeeld Supabase Storage), limieten op grootte en type, en moderatie. Bij voorkeur pas na
login (#2).

## 4. Kosten per conferentie, met filter

**Wat:** per conferentie een **inschatting** van de totale kosten: ticket, reis (bijvoorbeeld een
vlucht) en hotel, zichtbaar in het overzicht en in de vergelijking. Daarnaast een filter, zoals
"maximaal € 1.500".

**Waarom:** budget is vaak doorslaggevend bij de keuze welke conferentie je bezoekt.

**Aandachtspunten:**

- Duidelijk tonen wat **officieel** is (ticketprijs van de website, met bron) en wat een
  **schatting** is (reis en hotel), met de gebruikte aannames (vertrek vanuit Nederland, aantal
  nachten).
- Geen bedragen verzinnen: zonder betrouwbare bron of berekening blijft het `Onbekend`.
- Vraagt een uitbreiding van het datamodel (nu alleen `price_text`); contractwijziging via A.

## 5. Persoonlijk overzicht en favorieten

**Wat:** een eigen pagina met de conferenties die je als favoriet hebt gemarkeerd of wilt bijwonen,
met je eigen agenda ernaast.

**Waarom:** van "alles wat er is" naar "wat ik wil": een persoonlijke shortlist om te plannen en
te bespreken met je leidinggevende.

**Aandachtspunten:** de "geïnteresseerd"-aanmelding uit PR #7 is een eerste stap. Een echt
persoonlijk overzicht vraagt login (#2); combineren met de agendaweergave en de `.ics`-export.
