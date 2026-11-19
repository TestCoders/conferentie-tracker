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

**Implementatiekeuze (19 november 2026):** Microsoft Entra ID met de vaste TestCoders-tenant en
app-rollen `ConferenceTracker.User` / `ConferenceTracker.Admin`. Dit vervangt voor de huidige
implementatie het later besproken e-mailcode-/SMTP-voorstel. Zie
[de configuratie-, migratie- en testinstructies](docs/entra-auth.md).

**Wat:** inloggen via Microsoft Entra ID (single sign-on) met het TestCoders-account.

**Waarom:** nu kan iedereen elke naam opgeven en is beheer beveiligd met één gedeeld token. Met
login weten we wie een review schrijft of zich aanmeldt, en kunnen we beheerrechten per persoon
toekennen.

**Aandachtspunten:** vervangt de vrije naam bij reviews en aanmeldingen; beheerrollen koppelen aan
groepen in Entra ID; daarna de Supabase-RLS-policies aanscherpen.

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
