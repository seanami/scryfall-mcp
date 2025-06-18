import Handlebars from 'handlebars';
import { z } from 'zod/v4';

import { TemplateContext, loadTemplate } from '../templates';
import { ScryfallListSchema } from './list';

export const ScryfallRulingSchema = z.object({
  object: z.literal('ruling').describe('A content type for this object, always ruling'),
  oracle_id: z.string().describe('The Oracle ID of the card this ruling is associated with'),
  source: z
    .string()
    .describe(
      'A computer-readable string indicating which company produced this ruling, either wotc or scryfall'
    ),
  published_at: z.string().describe('The date when the ruling or note was published'),
  comment: z.string().describe('The text of the ruling'),
});

export type ScryfallRuling = z.infer<typeof ScryfallRulingSchema>;

export function renderRuling(ruling: ScryfallRuling, context: TemplateContext): string {
  return loadTemplate('ruling.hbs')({ ...ruling, context }).trim();
}

Handlebars.registerHelper(
  'renderRuling',
  (ruling: ScryfallRuling, options: Handlebars.HelperOptions) => {
    return renderRuling(ruling, { depth: options.hash.depth });
  }
);

export const ScryfallRulingListSchema = ScryfallListSchema.extend({
  data: z.array(ScryfallRulingSchema),
});

export type ScryfallRulingList = z.infer<typeof ScryfallRulingListSchema>;

export function renderRulingList(rulingList: ScryfallRulingList, context: TemplateContext): string {
  return rulingList.data.map(ruling => renderRuling(ruling, context)).join('\n\n');
}
