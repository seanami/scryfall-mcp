import Handlebars from 'handlebars';
import { z } from 'zod/v4';

import { TemplateContext, loadTemplate } from '../templates';

export const ScryfallStatsSchema = z.object({
  power: z
    .string()
    .nullable()
    .describe(
      "This card's power, if any. Note that some cards have powers that are not numeric, such as *"
    ),
  toughness: z.string().nullable().describe("This card's toughness, if any"),
  loyalty: z.string().nullable().describe("This card's loyalty, if any"),
  defense: z.string().nullable().describe("This card's defense, if any"),
});

export type ScryfallStats = z.infer<typeof ScryfallStatsSchema>;

export function renderStats(stats: ScryfallStats, context: TemplateContext): string {
  return loadTemplate('stats.hbs')({ ...stats, context }).trim();
}

Handlebars.registerHelper(
  'renderStats',
  (stats: ScryfallStats, options: Handlebars.HelperOptions) => {
    return renderStats(stats, { depth: options.hash.depth });
  }
);
