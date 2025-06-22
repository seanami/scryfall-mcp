import Handlebars from 'handlebars';
import { z } from 'zod/v4';

import { loadTemplate } from '../templates/index.js';
import { TemplateContext } from '../templates/types.js';
import { ScryfallCardFaceSchema } from './card_face.js';
import { ScryfallListSchema } from './list.js';
import { ScryfallStatsSchema } from './stats.js';

export const ScryfallCardSchema = z
  .object({
    object: z.literal('card').describe('A content type for this object, always "card"'),
    id: z.string().describe("A unique ID for this card in Scryfall's database"),
    name: z
      .string()
      .describe(
        'The name of this card. If this card has multiple faces, this field will contain both names separated by ␣//␣'
      ),
    mana_cost: z
      .string()
      .describe(
        'The mana cost for this card. This value will be any empty string "" if the cost is absent. Remember that per the game rules, a missing mana cost and a mana cost of {0} are different values'
      ),
    cmc: z
      .number()
      .describe("The card's mana value. Note that some funny cards have fractional mana costs"),
    color_identity: z.array(z.string()).describe("This card's color identity"),
    type_line: z.string().describe('The type line of this card'),
    oracle_text: z.string().describe('The Oracle text for this card, if any'),
    game_changer: z
      .boolean()
      .nullable()
      .describe('True if this card is on the Commander Game Changer list'),
    produced_mana: z
      .array(z.string())
      .nullable()
      .describe('Colors of mana that this card could produce'),
    set: z.string().describe("This card's set code"),
    set_name: z.string().describe("This card's full set name"),
    collector_number: z.string().describe("This card's collector number"),
    rarity: z
      .string()
      .describe("This card's rarity. One of common, uncommon, rare, special, mythic, or bonus"),
    card_faces: z
      .array(ScryfallCardFaceSchema)
      .nullable()
      .describe('An array of Card Face objects, if this card is multifaced'),
    prices: z
      .object({
        usd: z.string().nullable().optional().describe('The price of this card in USD'),
        usd_foil: z.string().nullable().optional().describe('The price of this card in USD (foil)'),
        eur: z.string().nullable().optional().describe('The price of this card in EUR'),
        tix: z.string().nullable().optional().describe('The price of this card in MTGO tickets'),
      })
      .describe('An object containing daily price information for this card'),
  })
  .extend(ScryfallStatsSchema.shape);

export type ScryfallCard = z.infer<typeof ScryfallCardSchema>;

export function renderCard(card: ScryfallCard, context: TemplateContext): string {
  return loadTemplate('card.hbs')({ ...card, context }).trim();
}

Handlebars.registerHelper('renderCard', (card: ScryfallCard, options: Handlebars.HelperOptions) => {
  return renderCard(card, { depth: options.hash.depth });
});

// List

export const ScryfallCardListSchema = ScryfallListSchema.extend({
  data: z.array(ScryfallCardSchema),
});

export type ScryfallCardList = z.infer<typeof ScryfallCardListSchema>;

export function renderCardList(cardList: ScryfallCardList, context: TemplateContext): string {
  return cardList.data
    .map(card => renderCard(card, context))
    .join('\n\n')
    .trim();
}
