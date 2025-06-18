import z from 'zod/v4';

export const ScryfallListSchema = z.object({
  object: z.literal('list').describe('A content type for this object, always list'),
  has_more: z
    .boolean()
    .describe('True if this List is paginated and there is a page beyond the current page'),
  next_page: z
    .string()
    .nullable()
    .describe(
      'If there is a page beyond the current page, this field will contain a full API URI to that page'
    ),
  total_cards: z
    .number()
    .nullable()
    .describe(
      'If this is a list of Card objects, this field will contain the total number of cards found across all pages'
    ),
  warnings: z
    .array(z.string())
    .nullable()
    .describe('An array of human-readable warnings issued when generating this list, as strings'),
});

export type ScryfallList = z.infer<typeof ScryfallListSchema>;
