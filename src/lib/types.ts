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
  status: ConferenceStatus;
  last_checked_at: string;
};

/** Rij zoals de discovery-engine hem aanlevert voor een upsert (zonder DB-velden). */
export type ConferenceInput = Omit<Conference, 'id' | 'status' | 'last_checked_at'> & {
  status?: ConferenceStatus;
};

export type ListResponse<T> = { items: T[] };

export type ErrorResponse = { error: string };

export type DiscoverySource = 'confs-tech' | 'testing-conferences';

export type DiscoveryRunResponse = {
  source: DiscoverySource;
  found: number;
  inserted: number;
  updated: number;
  errors: string[];
};

/** Velden die via PATCH /api/admin/conferences/:id aangepast mogen worden. */
export const ADMIN_EDITABLE_FIELDS = ['status', 'name', 'city', 'country', 'cfp_deadline'] as const;
export type ConferencePatch = Partial<Pick<Conference, (typeof ADMIN_EDITABLE_FIELDS)[number]>>;

export type Review = {
  id: string;
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
  reviewerName: string;
  rating: number;
  comment?: string | null;
};

export const ATTENDANCE_STATUSES = ['interested', 'attended'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Iemand die interesse heeft of de conferentie heeft bijgewoond (user-generated, geen login). */
export type Attendance = {
  id: string;
  conference_id: string;
  person_name: string;
  status: AttendanceStatus;
  created_at: string;
  /** Laatste rating van een review onder dezelfde naam (hoofdletter-ongevoelig), anders null. */
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
  personName: string;
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

/** Kolommen die we teruggeven als Conference (geen created_at/updated_at). */
export const CONFERENCE_COLUMNS =
  'id,name,official_url,canonical_url,source_name,source_url,start_date,end_date,city,country,category,cfp_url,cfp_deadline,price_text,status,last_checked_at';
