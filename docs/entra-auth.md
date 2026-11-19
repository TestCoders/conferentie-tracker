# Microsoft Entra login — Conference Tracker

De applicatie gebruikt Auth.js (`next-auth` 5.0.0-beta.32) met de Microsoft Entra ID-provider.
Microsoft handelt login en MFA af; er is geen SMTP-server of e-mailcodeprovider nodig. Het
Entra-ontwerp vervangt het eerdere e-mailcodevoorstel voor deze implementatie.

## Entra-configuratie

1. Appregistratie in de TestCoders-tenant: **single tenant**, platform **Web**.
2. Registreer exact de callbacks voor de omgevingen waarin je gaat inloggen:

   ```text
   http://localhost:3000/api/auth/callback/microsoft-entra-id
   https://conferentie-tracker.vercel.app/api/auth/callback/microsoft-entra-id
   ```

   Gebruik voor previews een vaste, expliciet geregistreerde URL. Geen impliciete tokenflows
   inschakelen. Een front-channel logout-URL is niet nodig voor lokale applicatielogout.

3. Maak app-rollen voor **Gebruikers/groepen**, ingeschakeld, met exacte waarden:
   - `ConferenceTracker.User`: bijdragen plaatsen.
   - `ConferenceTracker.Admin`: gebruikersrechten plus discovery, moderatie en kostenbeheer.
4. Enterprise application / Bedrijfsapp → Eigenschappen → **Toewijzing vereist? Ja**.
   Wijs accounts toe onder **Gebruikers en groepen**. Groepstoewijzing vereist Entra P1/P2;
   individuele gebruikers kunnen afzonderlijk worden toegewezen.
5. Laat IT eventuele benodigde consent verlenen. Er wordt alleen `openid profile email` gevraagd;
   geen Graph-, mail-, agenda- of directoryleesrechten. Houd de client-secretvervaldatum bij.

De app controleert de geverifieerde `tid`, `oid` en exact toegewezen `roles` uit het ID-token.
Auth.js valideert het OIDC-token en gebruikt PKCE, state en nonce. Een adres eindigend op
`testcoders.nl` verleent op zichzelf geen rechten: Microsoft-emailclaims zijn veranderlijk en
vormen geen stabiele identiteit. Toegang komt uit de vaste tenant en expliciete app-toewijzing.
Entra kan ook gasten bevatten; geef gasten geen app-rol als zij niet mogen inloggen.

Een aanvraag voor beheerderstoestemming staat onder Entra ID → Bedrijfsapps → Activiteit →
Aanvragen voor beheerderstoestemming → Mijn openstaande aanvragen. Een bevoegde Entra-beheerder
kan ook via App-registraties → Conferentie tracker → API-machtigingen de gevraagde rechten
controleren en beheerderstoestemming verlenen. De app-rol Admin geeft geen Entra-beheerdersrechten.
Na goedkeuring opnieuw inloggen. `OAuthCallbackError` met Microsoft-code `AADSTS65004` betekent
dat de consentflow niet is afgerond; `AccessDenied` van de app kan wijzen op ontbrekende app-rollen.

## Environment variables

Zet lokaal in het genegeerde bestand **`.env.local`**, niet `.env.local.txt`:

```dotenv
AUTH_MICROSOFT_ENTRA_ID_ID=<application-client-id>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<client-secret-value>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant-uuid>/v2.0
AUTH_SECRET=<random-session-secret>
```

Genereer een afzonderlijk `AUTH_SECRET` van minimaal 32 willekeurige bytes. Bewaar bestaande
Supabase-instellingen server-side. Voeg de vier Auth-variabelen via Vercel Project Settings →
Environment Variables toe voor Production en voor de vaste testomgeving. Commit geen credentials.
Op Vercel vertrouwt Auth.js de platformhost; buiten Vercel kan achter een vertrouwde proxy
`AUTH_TRUST_HOST=true` nodig zijn. Stel dit niet in achter een willekeurige, onvertrouwde proxy.

## Database vóór de uitrol migreren

Voer in Supabase SQL Editor uit:

```text
supabase/migrations/20261119_entra_identity.sql
```

De bestaande ervaringenmigratie moet al zijn uitgevoerd. De migratie is transactioneel en opnieuw
uitvoerbaar. Zij maakt `app_users` met een lokale UUID en unieke `(tenant_id, entra_object_id)`,
voegt nullable `user_id`-verwijzingen toe aan reviews, deelnemers en ervaringen, en voegt
accountuniciteit toe. De oude naamconstraint blijft tijdelijk bestaan zodat de huidige productiecode
zijn bestaande upsert kan blijven uitvoeren. Oude anonieme bijdragen worden niet automatisch geclaimd.
Deelnemers en ratings worden op user-ID gekoppeld; uitsluitend legacyrecords gebruiken onderling
nog naamkoppeling. In de review-/deelnemersinterface zijn legacybijdragen herkenbaar.

Beide review-schrijfpaden gebruiken dezelfde `record_conference_contribution`-functie. Een
attendance met optionele review wordt atomair opgeslagen. Er is één actuele review en één
attendance per account per conferentie. Herhalen wijzigt de eigen bijdrage zonder dubbelen.
Beoordelen kan pas vanaf de begindatum. Nieuwe verzoeken met `reviewerName`, `personName` of
`authorName` worden geweigerd; de auteur wordt server-side uit de sessie bepaald.

**Na de deployment:** voer `supabase/migrations/20261119_entra_after_deploy.sql` uit zodra alle
anonieme schrijfpaden zijn vervangen door de nieuwe versie. Dit verwijdert pas dan de oude
naamconstraint. Tot deze tweede stap weigert de bijdragefunctie accountgebonden reviews/attendance
expliciet met een melding over de overgang; login en beheer kunnen al worden gecontroleerd. Zo
kunnen de oude anonieme schrijver en nieuwe geverifieerde bijdragen niet door elkaar lopen. Voor
een afzonderlijke test-DB kunnen beide migraties na elkaar worden uitgevoerd.

Als de eerste versie van de identiteitsmigratie al is uitgevoerd, voer de bijgewerkte
`20261119_entra_identity.sql` nogmaals uit om de oude conflictconstraint tijdelijk terug te zetten.

De nieuwe tabellen hebben RLS aan en geen publieke gebruikerspolicies. Alle DB-toegang loopt via
server-side API-routes en de service-role client. Die client omzeilt RLS: de server controleert
identiteit, rechten en eigendom vóór iedere beschermde actie. De bijdragefunctie is uitsluitend
uitvoerbaar door `service_role`. Er wordt geen Supabase Auth-gebruiker of Entra-beheerdersrol in
user-editable profielmetadata aangemaakt.

## Sessies en toegangsbeheer

- Sessies zijn versleutelde Auth.js-cookies; geen provider-/refreshtokens in browseropslag.
- Entra-autorisatie verloopt na maximaal één uur na login, onafhankelijk van sessierefresh.
  Wijzigingen in Entra-rollen worden bij nieuwe login gecontroleerd en kunnen tot die tijd nog
  volgens de oude sessie gelden. Er wordt geen ongeteste Graph-synchronisatie toegepast.
- Voor onmiddellijke blokkering van applicatie-API's zet een bevoegde DB-beheerder
  `app_users.disabled_at`. Dit wordt bij iedere beschermde API-aanroep gecontroleerd.
- Admin erft in applicatiecode ook User-rechten. Het gedeelde `ADMIN_TOKEN` geeft geen toegang meer.
  Een toekomstige cronintegratie vereist een afzonderlijk ontworpen authenticatiepad.
- Login/logout gebruikt de ingebouwde Auth.js-bescherming. Eigen muterende API's vereisen een
  exact overeenkomende `Origin`, naast de geverifieerde sessie. Zonder sessie `401`, zonder rol,
  bij een geblokkeerd account of bij verkeerde origin `403`.
- Publieke conferentie- en bijdrageleesroutes blijven beschikbaar. Publieke responses bevatten
  geen e-mailadressen, Entra-object-ID's of accountstatus. Foto-upload vereist zowel eigendom via
  sessie als het bestaande tijdelijke bewerktoken; oude anonieme verslagen worden niet geclaimd.
- Uitloggen beëindigt de applicatiesessie; de Microsoft-browsersessie kan blijven bestaan.

## Verificatie

```powershell
node --experimental-strip-types --test src/lib/auth-policy.test.mjs src/lib/auth-access.test.mjs src/lib/discovery/discovery.test.mjs
npm run check
```

Gebruik Node >=22.15 voor de native TypeScript-tests. Tests injecteren uitsluitend aan de grens
met Auth.js een sessie; de applicatie heeft geen test-loginprovider, bearerfallback of auth-bypass.
Controleer daarnaast met echte toegewezen accounts:

1. Homepage blijft publiek; inloggen leidt naar de juiste Microsoft-tenant en keert terug.
2. User kan een eigen review/attendance plaatsen en actualiseren; gelijknamige collega's blijven
   verschillende personen. Geen mogelijkheid om een auteursnaam of user-ID in een body te vervalsen.
3. Admin kan discovery starten, conferenties modereren, kosten bewerken en ervaringen verwijderen;
   User en anoniem kunnen dat niet, ook niet via directe API-calls of het oude token.
4. Niet-toegewezen en externe accounts worden geweigerd; ontbrekende app-rollen ook.
5. Cross-origin writes, verlopen sessies en geblokkeerde gebruikers worden geweigerd.
6. Logout, sessie-expiry, legacyrecords en eigenaarcontrole voor foto-upload werken.

Bewaar geen codes, cookies, tokens of client-secretwaarden in testlogs/screenshots. Rol bij fouten
de applicatiedeployment terug zonder de bestaande bijdragegegevens te verwijderen; de toegevoegde
nullable identiteitskolommen kunnen blijven staan. Na de tweede migratie werkt de oude naamgebaseerde
upsert niet meer; rol dan geen anoniem schrijfpad terug zonder expliciet herstel-/toegangsplan.

## Communitygegevens alleen na inloggen

Reviews, deelnemers, communitytellingen en ervaringen zijn uitsluitend beschikbaar voor actieve
TestCoders-accounts (User of Admin). De lees-API's controleren dezelfde sessie en accountstatus
als de schrijf-API's en geven `Cache-Control: private, no-store` terug. De interface vraagt bezoekers
om in te loggen en laadt deze gegevens pas daarna. Conferenties zoeken en vergelijken blijft openbaar.

Ervaringsfoto's lopen via `/api/experience-photos/[id]`, met een accountcontrole per download.
Voer bij uitrol `supabase/migrations/20261119_private_community_photos.sql` uit om de bestaande
`experience-photos`-bucket privé te maken. Daarmee werken oude openbare opslaglinks niet langer.
Eerder gedownloade bestanden of reeds gecachte kopieën kunnen niet worden teruggehaald.
