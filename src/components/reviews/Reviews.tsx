'use client';
// Eigenaar: D. Compacte review-component; C importeert deze later in de explorer.
import type { Conference } from '@/lib/types';

export function Reviews({ conferenceId }: { conferenceId: Conference['id'] }) {
  // TODO(D): GET /api/reviews?conferenceId=…, gemiddelde tonen, formulier voor POST.
  return <div data-conference-id={conferenceId} />;
}
