// Eigenaar: D. POST /api/admin/sources/analyze — URL ophalen, formaat herkennen en voorbeeldrecords
// tonen, zonder iets op te slaan. Admin-token vereist. Bij een gewone webpagina: één AI-verzoek.
import { analyzeSource, parseAnalyzeRequest } from '@/lib/discovery/custom-sources';
import { jsonError, requireAdmin } from '@/lib/http';
import type { SourceAnalysis } from '@/lib/types';

export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const raw = await request.text();
  if (raw.length > 3000) return jsonError('Requestbody is te groot', 400);
  let url: string;
  try {
    url = await parseAnalyzeRequest(JSON.parse(raw) as unknown);
  } catch (error) {
    return jsonError(
      error instanceof SyntaxError ? 'Ongeldige JSON' : (error as Error).message,
      400,
    );
  }
  try {
    const analysis = await analyzeSource(url);
    return Response.json(analysis satisfies SourceAnalysis);
  } catch (error) {
    // Ophalen of herkennen mislukt: geen serverfout, maar een bron die we niet kunnen lezen.
    return jsonError(error instanceof Error ? error.message : 'Analyse mislukt', 400);
  }
}
