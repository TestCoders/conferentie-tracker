/**
 * Gedeeld contract (eigenaar: A). Zie HACKATHON_PLAN.md §6.
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
  status: ConferenceStatus;
  last_checked_at: string;
};

/** Rij zoals de discovery-engine hem aanlevert voor een upsert (zonder DB-velden). */
/** Zonder ticketvelden: die beheert een beheerder en mag een herimport niet overschrijven. */
export type ConferenceInput = Omit<
  Conference,
  'id' | 'status' | 'last_checked_at' | 'ticket_price_eur' | 'ticket_price_url'
> & {
  status?: ConferenceStatus;
};

export type ListResponse<T> = { items: T[] };

export type ErrorResponse = { error: string };

export type AppUser = { id: string; display_name: string; disabled_at: string | null };

/** '-past': historische bronnen, conferenties vanaf 12 maanden geleden. */
export type DiscoverySource =
  'confs-tech' | 'testing-conferences' | 'confs-tech-past' | 'testing-conferences-past';

export type DiscoveryRunResponse = {
  source: DiscoverySource;
  found: number;
  inserted: number;
  updated: number;
  errors: string[];
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
  'id,name,official_url,canonical_url,source_name,source_url,start_date,end_date,city,country,category,cfp_url,cfp_deadline,price_text,online_only,ticket_price_eur,ticket_price_url,status,last_checked_at';
