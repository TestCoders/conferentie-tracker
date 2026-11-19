// Eigenaar: B. Adapter voor de live JSON-feed van confs.tech.
import type { ConferenceInput } from '@/lib/types';

export const CONFS_TECH_SOURCES = [
  'https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2027/javascript.json',
  'https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2027/devops.json',
] as const;

/**
 * TODO(B): live JSON ophalen (native fetch), valideren en mappen naar ConferenceInput.
 * category = 'development'; onbekende velden = null; geen verzonnen data.
 */
export async function fetchConfsTech(): Promise<{ items: ConferenceInput[]; errors: string[] }> {
  return { items: [], errors: ['fetchConfsTech is nog niet geïmplementeerd'] };
}
