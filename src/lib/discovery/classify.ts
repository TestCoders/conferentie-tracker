// Eigenaar: B. Categorie bepalen uit bron (feed) + naam; alleen op zichtbaar bewijs, niets raden.
import type { Category } from '@/lib/types';

const RANK: Record<Category, number> = { development: 0, testing: 1, 'test-automation': 2 };

/** Namen die expliciet over testautomatisering of een automatiseringstool gaan. */
const TEST_AUTOMATION =
  /\btest[\s-]*automation\b|\bautomated[\s-]+testing\b|\bselenium\w*|\bplaywright\b|\bcypress\b|\bappium\b|\bwebdriver\w*|\brobot[\s-]*framework\b|\brobocon\b/i;

/** Namen die expliciet over testen of kwaliteit gaan (TestBash, TestCon, ParisTestConf, QA …). */
const TESTING =
  /\btest(s|ing|ers?|bash|con|conf|js|ops)?\b|\w+test(conf|con|fest)\b|\bqa\b|\bquality[\s-]+(assurance|engineering)\b|\bsoftware[\s-]+quality\b|\bstar(east|west|canada)\b|\beurostar\b/i;

/** Hoogste van twee categorieën: test-automation > testing > development. */
export function strongerCategory(a: Category, b: Category): Category {
  return RANK[b] > RANK[a] ? b : a;
}

/**
 * Categorie voor een conferentie. `base` is wat de bron zelf zegt (bijv. de testing-feed van
 * confs.tech of TestingConferences.org); de naam kan die alleen verhogen, nooit verlagen.
 */
export function classifyConference(name: string, base: Category): Category {
  if (TEST_AUTOMATION.test(name)) return 'test-automation';
  if (TESTING.test(name)) return strongerCategory(base, 'testing');
  return base;
}

/** confs.tech-feeds per onderwerp: `…/testing.json` is bewijs voor categorie testing. */
export function confsTechFeedCategory(sourceUrl: string): Category {
  return /\/testing\.json$/i.test(new URL(sourceUrl).pathname) ? 'testing' : 'development';
}
