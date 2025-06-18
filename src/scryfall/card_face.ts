import Handlebars from 'handlebars';
import { z } from 'zod/v4';

import { TemplateContext, loadTemplate } from '../templates';
import { ScryfallStatsSchema } from './stats';

export const ScryfallCardFaceSchema = z
  .object({
    name: z.string().describe('The name of this particular face'),
    mana_cost: z
      .string()
      .describe(
        'The mana cost for this face. This value will be any empty string "" if the cost is absent'
      ),
    cmc: z.number().describe('The mana value of this particular face'),
    type_line: z.string().describe('The type line of this particular face'),
    oracle_text: z.string().describe('The Oracle text for this face, if any'),
  })
  .extend(ScryfallStatsSchema.shape);

export type ScryfallCardFace = z.infer<typeof ScryfallCardFaceSchema>;

export function renderCardFace(face: ScryfallCardFace, context: TemplateContext): string {
  return loadTemplate('card_face.hbs')({ ...face, context });
}

Handlebars.registerHelper(
  'renderCardFace',
  (face: ScryfallCardFace, options: Handlebars.HelperOptions) => {
    return renderCardFace(face, { depth: options.hash.depth });
  }
);
