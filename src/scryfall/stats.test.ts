import { TemplateContext } from '../templates/types.js';
import { ScryfallStatsSchema, renderStats } from './stats.js';

describe('ScryfallStats', () => {
  describe('validation', () => {
    it('should validate valid stats', () => {
      const validStats = {
        power: '2',
        toughness: '3',
        loyalty: null,
        defense: null,
      };

      const result = ScryfallStatsSchema.safeParse(validStats);
      expect(result.success).toBe(true);
    });

    it('should reject invalid stats', () => {
      const invalidStats = {
        power: 2, // should be stringe
        toughness: '3',
        loyalty: null,
        defense: null,
      };

      const result = ScryfallStatsSchema.safeParse(invalidStats);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid input: expected string, received number');
    });
  });

  describe('rendering', () => {
    it('should render stats correctly for power and toughness', () => {
      const stats = {
        power: '2',
        toughness: '3',
        loyalty: null,
        defense: null,
      };

      const context: TemplateContext = {
        depth: 1,
      };

      const rendered = renderStats(stats, context);
      expect(rendered).toBe('**Power/Toughness:** 2/3');
    });

    it('should render stats correctly for loyalty', () => {
      const stats = {
        power: null,
        toughness: null,
        loyalty: '1',
        defense: null,
      };

      const context: TemplateContext = {
        depth: 1,
      };

      const rendered = renderStats(stats, context);
      expect(rendered).toBe('**Loyalty:** 1');
    });

    it('should render stats correctly for defense', () => {
      const stats = {
        power: null,
        toughness: null,
        loyalty: null,
        defense: '1',
      };

      const context: TemplateContext = {
        depth: 1,
      };

      const rendered = renderStats(stats, context);
      expect(rendered).toBe('**Defense:** 1');
    });
  });
});
