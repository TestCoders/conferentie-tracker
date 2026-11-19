import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { AppUser, Attendance, Review } from '@/lib/types';

export async function saveContribution(
  user: AppUser,
  input: {
    conferenceId: string;
    status?: string;
    rating: number | null;
    comment: string | null;
  },
) {
  const { data, error } = await getSupabaseAdmin().rpc('record_conference_contribution', {
    p_user_id: user.id,
    p_conference_id: input.conferenceId,
    p_display_name: user.display_name,
    p_status: input.status ?? null,
    p_rating: input.rating,
    p_comment: input.comment,
  });
  if (error) {
    const status =
      error.code === 'P0002'
        ? 404
        : error.code === '22023'
          ? 400
          : error.code === '42501'
            ? 403
            : 503;
    return {
      response: Response.json(
        {
          error:
            error.code === '55000'
              ? 'Bijdragen worden overgezet naar Microsoft-accounts. Probeer na de uitrol opnieuw.'
              : status === 503
                ? 'Bijdrage opslaan mislukt. Controleer de Entra-migratie.'
                : error.message,
        },
        { status },
      ),
    };
  }
  return { data: data as { attendance: Omit<Attendance, 'rating'> | null; review: Review | null } };
}
