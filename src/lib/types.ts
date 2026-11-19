/**
 * Gedeeld contract (eigenaar: A). Zie plan.md §3.
 * NIET lokaal varianten van deze types definiëren; wijzigingen alleen via A
 * met akkoord van alle vier.
 */

export const CATEGORIES = ['development', 'testing', 'test-automation'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CONFERENCE_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ConferenceStatus = (typeof CONFERENCE_STATUSES)[number];

/** Datums: 'YYYY-MM-DD'. Onbekende optionele velden: null (nooit '' of verzonnen). */
export type Conference = {
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
  /** Alleen online (geen fysieke locatie): geen reis- of hotelkosten. Gezet door discovery. */
  online_only: boolean;
  /** Officiële ticketprijs per persoon in hele euro's, ingevuld door een beheerder. */
  ticket_price_eur: number | null;
  /** Bron van de ticketprijs (https). */
  ticket_price_url: string | null;
  /** Afbeelding (og:image) van de officiële website, alleen https; anders null. */
  image_url: string | null;
  /** Logo/icoon (apple-touch-icon, icon) van de officiële website, alleen https; anders null. */
  icon_url: string | null;
  /** Laatste keer dat de AI-verrijking deze conferentie controleerde. */
  ai_checked_at: string | null;
  /** Velden die door de AI-verrijking zijn ingevuld (bijv. 'ticket_price_eur', 'country'). */
  ai_fields: AiField[];
  status: ConferenceStatus;
  last_checked_at: string;
};

/** Velden die de AI-verrijking mag invullen. */
export const AI_FIELDS = [
  'city',
  'country',
  'online_only',
  'ticket_price_eur',
  'ticket_price_url',
  'cfp_deadline',
  'cfp_url',
] as const;
export type AiField = (typeof AI_FIELDS)[number];

/**
 * Rij zoals de discovery-engine hem aanlevert voor een upsert (zonder DB-velden).
 * Zonder ticket-, AI- en afbeeldingsvelden: een herimport mag die niet overschrijven.
 */
export type ConferenceInput = Omit<
  Conference,
  | 'id'
  | 'status'
  | 'last_checked_at'
  | 'ticket_price_eur'
  | 'ticket_price_url'
  | 'image_url'
  | 'icon_url'
  | 'ai_checked_at'
  | 'ai_fields'
> & {
  status?: ConferenceStatus;
};

export type ListResponse<T> = { items: T[] };

export type ErrorResponse = { error: string };

export type AppUser = { id: string; display_name: string; disabled_at: string | null };

/** '-past': historische bronnen, conferenties vanaf 12 maanden geleden. */
export const DISCOVERY_SOURCES = [
  'confs-tech',
  'testing-conferences',
  'confs-tech-past',
  'testing-conferences-past',
] as const;
/** Vaste, ingebouwde bronnen. */
export type DiscoverySource = (typeof DISCOVERY_SOURCES)[number];

/**
 * Feedformaat van een handmatig toegevoegde bron. Bepaalt welke bestaande parser
 * (confs.tech of TestingConferences) de feed verwerkt.
 */
/**
 * Formaat van een handmatig toegevoegde bron; wordt per URL automatisch herkend.
 * - confs-tech-json / testing-conferences-yaml: exact de parsers van de vaste bronnen.
 * - json / yaml: lijst records; velden via een automatisch gevonden `SourceParseConfig`.
 * - ical: iCalendar-feed (VEVENT).
 * - jsonld: HTML-pagina met schema.org Event-gegevens (JSON-LD).
 * - ai: gewone HTML-pagina, uitgelezen door de AI (records krijgen status 'pending').
 */
export const CUSTOM_SOURCE_FORMATS = [
  'confs-tech-json',
  'testing-conferences-yaml',
  'json',
  'yaml',
  'ical',
  'jsonld',
  'ai',
] as const;
export type CustomSourceFormat = (typeof CUSTOM_SOURCE_FORMATS)[number];

/** Velden van een conferentie die uit een json/yaml-record gehaald kunnen worden. */
export const MAPPED_FIELDS = [
  'name',
  'url',
  'startDate',
  'endDate',
  /** Vrije datumtekst, bijv. "March 3-4, 2027". */
  'dates',
  'city',
  'country',
  /** "Stad, Land", "Online" of een object met city/country. */
  'location',
  'online',
  'cfpUrl',
  'cfpDeadline',
  'price',
] as const;
export type MappedField = (typeof MAPPED_FIELDS)[number];

/** Hoe een json/yaml-bron gelezen wordt: waar de lijst staat en welke sleutel welk veld is. */
export type SourceParseConfig = {
  /** Pad naar de lijst records; [] = de lijst is de hele feed. */
  recordsPath: string[];
  fields: Partial<Record<MappedField, string>>;
};

/** Door een beheerder toegevoegde bron (tabel discovery_sources). */
export type CustomDiscoverySource = {
  id: string;
  /** Uniek label; wordt ook conferences.source_name en ingestion_runs.source_name. */
  name: string;
  url: string;
  format: CustomSourceFormat;
  /** Alleen bij json/yaml. */
  config: SourceParseConfig | null;
  /** Categorie als de naam geen bewijs voor testing/test-automation bevat. */
  default_category: Category;
  created_at: string;
};

/** POST /api/admin/sources — de server analyseert de URL opnieuw; het formaat kies je niet zelf. */
export type CreateCustomSourceRequest = {
  name: string;
  url: string;
  defaultCategory?: Category;
};

/** POST /api/admin/sources/analyze */
export type AnalyzeSourceRequest = { url: string };

/** Uitkomst van de analyse van een URL: wat er gevonden is, nog zonder iets op te slaan. */
export type SourceAnalysis = {
  url: string;
  format: CustomSourceFormat;
  config: SourceParseConfig | null;
  /** Voorgestelde standaardcategorie op basis van de gevonden namen. */
  defaultCategory: Category;
  /** Aantal geldige conferenties in de bron. */
  found: number;
  /** De eerste paar geldige records, zoals ze opgeslagen zouden worden. */
  sample: ConferenceInput[];
  /** Eerste fouten (ongeldige records e.d.). */
  errors: string[];
  /** Nieuwe conferenties uit deze bron krijgen status 'pending' (AI-extractie). */
  pending: boolean;
};

/** POST /api/discovery/run — óf een vaste bron, óf het id van een eigen bron. */
export type DiscoveryRunRequest = { source?: DiscoverySource } | { sourceId: string };

export type DiscoveryRunResponse = {
  /** Vaste bron-key, of de naam van een eigen bron. */
  source: string;
  found: number;
  inserted: number;
  updated: number;
  errors: string[];
  /** Websites bekeken op logo/afbeelding in deze run; ontbreekt als die stap niet draaide. */
  images?: { checked: number; found: number };
  /** Alleen bij eigen bronnen: in hoeverre de kostenschatting voor deze records werkt. */
  costCoverage?: CostCoverage;
};

/**
 * Dekking van de kostenschatting (src/lib/costs.ts) voor de records van één discovery-run.
 * Feeds bevatten geen ticketprijzen; die komen via de AI-verrijking of een beheerder.
 */
export type CostCoverage = {
  /** Records met een schatting voor reis + hotel (eigen land, standaardaanname of online). */
  withEstimate: number;
  /** Waarvan online-only (reis en hotel € 0). */
  online: number;
  /** Landen zonder eigen aanname die op de standaardaanname terugvallen. */
  onDefault: string[];
  /** Landen zonder eigen aanname terwijl er ook geen standaardaanname is: Onbekend. */
  missingCountries: string[];
  /** Records zonder bekende locatie (TBA): Onbekend. */
  withoutLocation: number;
};

/** Velden die via PATCH /api/admin/conferences/:id aangepast mogen worden. */
export const ADMIN_EDITABLE_FIELDS = [
  'status',
  'name',
  'city',
  'country',
  'cfp_deadline',
  'ticket_price_eur',
  'ticket_price_url',
] as const;
export type ConferencePatch = Partial<Pick<Conference, (typeof ADMIN_EDITABLE_FIELDS)[number]>>;

export type Review = {
  id: string;
  user_id: string | null;
  conference_id: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type ReviewsResponse = {
  items: Review[];
  averageRating: number | null;
  count: number;
};

export type CreateReviewRequest = {
  conferenceId: string;
  rating: number;
  comment?: string | null;
};

export const ATTENDANCE_STATUSES = ['interested', 'attended'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Iemand die interesse heeft of de conferentie heeft bijgewoond (user-generated, accountgebonden of legacy). */
export type Attendance = {
  id: string;
  user_id: string | null;
  conference_id: string;
  person_name: string;
  status: AttendanceStatus;
  created_at: string;
  /** Rating van hetzelfde account; voor legacyrecords alleen naamkoppeling tussen legacyrecords. */
  rating: number | null;
};

/** GET /api/attendances?conferenceId=<uuid> */
export type AttendancesResponse = {
  items: Attendance[];
  interested: number;
  attended: number;
};

/** POST /api/attendances — rating/comment alleen bij status 'attended'; maakt dan ook een review. */
export type CreateAttendanceRequest = {
  conferenceId: string;
  status: AttendanceStatus;
  rating?: number | null;
  comment?: string | null;
};

/** GET /api/attendances/summary — tellingen per conference_id voor lijst en vergelijking. */
export type CommunityStats = {
  interested: number;
  attended: number;
  reviews: number;
  averageRating: number | null;
};
export type CommunitySummaryResponse = { items: Record<string, CommunityStats> };

/** GET /api/favorites — conferentie-IDs van de ingelogde gebruiker. */
export type FavoritesResponse = { items: string[] };

/** POST /api/favorites — één of meer conferenties toevoegen (max. 500). */
export type AddFavoritesRequest = { conferenceIds: string[] };

/**
 * Kostenaanname per land (roadmap #4), beheerd door een admin. Bedragen in hele euro's,
 * per persoon: reis retour vanuit Nederland en hotel per nacht.
 */
export type CostAssumption = {
  country_key: string;
  country_label: string;
  travel_eur: number;
  hotel_per_night_eur: number;
  updated_at: string;
  /** 'admin' = door een beheerder ingevuld, 'ai' = ruwe AI-schatting (zie updated_at). */
  source: 'admin' | 'ai';
  /** Korte toelichting bij een AI-schatting. */
  note: string | null;
};

/* ---------- AI-verrijking ---------- */

export const ENRICH_TARGETS = ['costs', 'conferences'] as const;
export type EnrichTarget = (typeof ENRICH_TARGETS)[number];

/** POST /api/admin/enrich */
export type EnrichRequest = {
  target: EnrichTarget;
  /** Alleen bij 'conferences': aantal conferenties per run (1–12, standaard 6). */
  limit?: number;
};

export type EnrichResponse = {
  target: EnrichTarget;
  /** Het model dat OpenRouter daadwerkelijk gebruikte. */
  model: string | null;
  /** Aantal AI-verzoeken (tellen mee voor de dagelijkse limiet van gratis modellen). */
  requests: number;
  processed: number;
  updated: number;
  /** Alleen bij 'conferences': nog nooit door de AI gecontroleerde conferenties. */
  remaining: number | null;
  errors: string[];
};

/** PUT /api/admin/cost-assumptions — upsert op genormaliseerd land. */
export type UpsertCostAssumptionRequest = {
  /** Land, of '*' voor de standaardaanname (landen zonder eigen aanname). */
  country: string;
  travelEur: number;
  hotelPerNightEur: number;
};

/* ---------- Ervaringen delen (roadmap #3) ---------- */

export const WOULD_RETURN = ['yes', 'maybe', 'no'] as const;
export type WouldReturn = (typeof WOULD_RETURN)[number];

export type ExperiencePhoto = {
  id: string;
  experience_id: string;
  /** Publieke URL in de storage-bucket. */
  url: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
};

/** Verslag van een bezoek, accountgebonden auteur of oudere anonieme bijdrage. */
export type Experience = {
  id: string;
  conference_id: string | null;
  conference_name: string;
  conference_date: string | null;
  conference_city: string | null;
  author_name: string;
  title: string;
  summary: string;
  report: string | null;
  rating: number;
  would_return: WouldReturn;
  recommended_for: Category[];
  highlights: string[];
  tips: string | null;
  links: string[];
  created_at: string;
  photos: ExperiencePhoto[];
};

/** POST /api/experiences — conferenceId óf conferenceName is verplicht. */
export type CreateExperienceRequest = {
  conferenceId?: string | null;
  conferenceName?: string | null;
  conferenceDate?: string | null;
  conferenceCity?: string | null;
  title: string;
  summary: string;
  report?: string | null;
  rating: number;
  wouldReturn: WouldReturn;
  recommendedFor?: Category[];
  highlights?: string[];
  tips?: string | null;
  links?: string[];
};

/** Het bewerktoken wordt één keer teruggegeven en is nodig om foto's toe te voegen. */
export type CreateExperienceResponse = { experience: Experience; editToken: string };

/** Conferentie om een ervaring aan te koppelen (ook afgelopen edities). */
export type ExperienceConference = Pick<
  Conference,
  'id' | 'name' | 'start_date' | 'end_date' | 'city' | 'country'
>;

/** Kolommen die we teruggeven als Conference (geen created_at/updated_at). */
export const CONFERENCE_COLUMNS =
  'id,name,official_url,canonical_url,source_name,source_url,start_date,end_date,city,country,category,cfp_url,cfp_deadline,price_text,online_only,ticket_price_eur,ticket_price_url,ai_checked_at,ai_fields,image_url,icon_url,status,last_checked_at';
