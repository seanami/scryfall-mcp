import { ScryfallList, ScryfallListSchema } from './list.js';

describe('ScryfallList', () => {
  describe('validation', () => {
    it('should validate valid list', () => {
      const validList: ScryfallList = {
        object: 'list',
        has_more: true,
        next_page: 'https://api.scryfall.com/cards?page=2',
        total_cards: 100,
        warnings: ['Some warning message'],
      };

      const result = ScryfallListSchema.safeParse(validList);
      expect(result.success).toBe(true);
    });

    it('should validate list with null values', () => {
      const validList: ScryfallList = {
        object: 'list',
        has_more: false,
        next_page: null,
        total_cards: null,
        warnings: null,
      };

      const result = ScryfallListSchema.safeParse(validList);
      expect(result.success).toBe(true);
    });

    it('should reject invalid list', () => {
      const invalidList = {
        object: 'card', // should be 'list'
        has_more: 'true', // should be boolean
        next_page: 123, // should be string or null
        total_cards: '100', // should be number or null
        warnings: 'warning', // should be array of strings or null
      };

      const result = ScryfallListSchema.safeParse(invalidList);
      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('Invalid input: expected "list"'),
          }),
        ])
      );
    });
  });
});
