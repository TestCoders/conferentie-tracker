// Eigenaar: C. Badge-kleuren per categorie (tokens uit globals.css).
import type { Category } from '@/lib/types';

export const CATEGORY_STYLES: Record<Category, string> = {
  development: 'bg-signal-glow text-signal',
  testing: 'bg-glass text-assess',
  'test-automation': 'bg-glass text-adopt',
};
