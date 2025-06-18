import { TemplateContext } from '../templates';
import { ScryfallRuling, ScryfallRulingSchema, renderRuling } from './ruling';

describe('ScryfallRuling', () => {
  describe('validation', () => {
    it('should validate valid ruling', () => {
      const validRuling: ScryfallRuling = {
        object: 'ruling' as const,
        oracle_id: '123456',
        source: 'wotc',
        published_at: '2024-03-20',
        comment: 'This is a test ruling',
      };

      const result = ScryfallRulingSchema.safeParse(validRuling);
      expect(result.success).toBe(true);
    });

    it('should reject invalid ruling', () => {
      const invalidRuling = {
        object: 'card', // should be 'ruling'
        oracle_id: '123456',
        source: 'wotc',
        published_at: '2024-03-20',
        comment: 'This is a test ruling',
      };

      const result = ScryfallRulingSchema.safeParse(invalidRuling);
      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('Invalid input: expected "ruling"'),
          }),
        ])
      );
    });
  });

  describe('rendering', () => {
    it('should render ruling correctly', () => {
      const ruling: ScryfallRuling = {
        object: 'ruling' as const,
        oracle_id: '123456',
        source: 'wotc',
        published_at: '2024-03-20',
        comment: 'This is a test ruling',
      };

      const context: TemplateContext = {
        depth: 1,
      };

      const rendered = renderRuling(ruling, context);
      expect(rendered).toBe(`# Ruling for 123456 (2024-03-20)

**Source:** wotc

This is a test ruling`);
    });
  });
});
