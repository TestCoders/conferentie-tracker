// Eigenaar: D. GET ?conferenceId=<uuid> en POST — server-side validatie, geen directe DB-schrijfrechten.
import { notImplemented } from '@/lib/http';

export async function GET() {
  // TODO(D): → ReviewsResponse { items, averageRating, count }
  return notImplemented('GET /api/reviews');
}

export async function POST() {
  // TODO(D): valideer CreateReviewRequest (uuid, rating 1–5, naam verplicht, tekstlengte max).
  return notImplemented('POST /api/reviews');
}
