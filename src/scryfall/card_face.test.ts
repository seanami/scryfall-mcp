import { TemplateContext } from '../templates/types.js';
import { ScryfallCardFace, ScryfallCardFaceSchema, renderCardFace } from './card_face.js';

describe('ScryfallCardFace', () => {
  describe('validation', () => {
    it('should validate valid card face', () => {
      const validCardFace: ScryfallCardFace = {
        name: 'Test Card',
        mana_cost: '{1}{W}',
        cmc: 2,
        type_line: 'Creature — Human',
        oracle_text: 'When Test Card enters the battlefield, draw a card.',
        defense: null,
        loyalty: null,
        power: '2',
        toughness: '2',
      };

      const result = ScryfallCardFaceSchema.safeParse(validCardFace);
      expect(result.success).toBe(true);
    });

    it('should validate card face with special power/toughness', () => {
      const cardFaceWithSpecialStats: ScryfallCardFace = {
        name: 'Test Card',
        mana_cost: '{X}',
        cmc: 0,
        type_line: 'Creature — Elemental',
        oracle_text:
          "Test Card's power and toughness are each equal to the amount of mana spent to cast it.",
        defense: null,
        loyalty: null,
        power: '*',
        toughness: '*',
      };

      const result = ScryfallCardFaceSchema.safeParse(cardFaceWithSpecialStats);
      expect(result.success).toBe(true);
    });

    it('should validate card face with loyalty', () => {
      const planeswalkerFace: ScryfallCardFace = {
        name: 'Test Walker',
        mana_cost: '{2}{U}{U}',
        cmc: 4,
        type_line: 'Legendary Planeswalker — Test',
        oracle_text:
          '+1: Draw a card\n-2: Return target creature to its owner\'s hand\n-8: You get an emblem with "You have no maximum hand size."',
        defense: null,
        loyalty: '4',
        power: null,
        toughness: null,
      };

      const result = ScryfallCardFaceSchema.safeParse(planeswalkerFace);
      expect(result.success).toBe(true);
    });

    it('should validate card face with defense', () => {
      const battleFace: ScryfallCardFace = {
        name: 'Test Battle',
        mana_cost: '{2}{W}',
        cmc: 3,
        type_line: 'Battle — Siege',
        oracle_text:
          'When Test Battle enters the battlefield, target opponent gets a poison counter.',
        defense: '5',
        loyalty: null,
        power: null,
        toughness: null,
      };

      const result = ScryfallCardFaceSchema.safeParse(battleFace);
      expect(result.success).toBe(true);
    });

    it('should reject invalid card face', () => {
      const invalidCardFace = {
        name: 'Test Card',
        mana_cost: '{1}{W}',
        cmc: '2', // should be number
        type_line: 'Creature — Human',
        oracle_text: 'When Test Card enters the battlefield, draw a card.',
        defense: null,
        loyalty: null,
        power: '2',
        toughness: '2',
      };

      const result = ScryfallCardFaceSchema.safeParse(invalidCardFace);
      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('Invalid input: expected number, received string'),
          }),
        ])
      );
    });
  });

  describe('rendering', () => {
    it('should render creature card face correctly', () => {
      const cardFace: ScryfallCardFace = {
        name: 'Test Card',
        mana_cost: '{1}{W}',
        cmc: 2,
        type_line: 'Creature — Human',
        oracle_text: 'When Test Card enters the battlefield, draw a card.',
        defense: null,
        loyalty: null,
        power: '2',
        toughness: '2',
      };

      const context: TemplateContext = {
        depth: 1,
      };

      const rendered = renderCardFace(cardFace, context);
      expect(rendered).toContain('Test Card');
      expect(rendered).toContain('{1}{W}');
      expect(rendered).toContain('Creature — Human');
      expect(rendered).toContain('When Test Card enters the battlefield, draw a card.');
      expect(rendered).toContain('2/2');
    });

    it('should render planeswalker card face correctly', () => {
      const planeswalkerFace: ScryfallCardFace = {
        name: 'Test Walker',
        mana_cost: '{2}{U}{U}',
        cmc: 4,
        type_line: 'Legendary Planeswalker — Test',
        oracle_text:
          '+1: Draw a card\n-2: Return target creature to its owner\'s hand\n-8: You get an emblem with "You have no maximum hand size."',
        defense: null,
        loyalty: '4',
        power: null,
        toughness: null,
      };

      const context: TemplateContext = {
        depth: 1,
      };

      const rendered = renderCardFace(planeswalkerFace, context);
      expect(rendered).toContain('Test Walker');
      expect(rendered).toContain('{2}{U}{U}');
      expect(rendered).toContain('Legendary Planeswalker — Test');
      expect(rendered).toContain('+1: Draw a card');
      expect(rendered).toContain('4');
    });

    it('should render battle card face correctly', () => {
      const battleFace: ScryfallCardFace = {
        name: 'Test Battle',
        mana_cost: '{2}{W}',
        cmc: 3,
        type_line: 'Battle — Siege',
        oracle_text:
          'When Test Battle enters the battlefield, target opponent gets a poison counter.',
        defense: '5',
        loyalty: null,
        power: null,
        toughness: null,
      };

      const context: TemplateContext = {
        depth: 1,
      };

      const rendered = renderCardFace(battleFace, context);
      expect(rendered).toContain('Test Battle');
      expect(rendered).toContain('{2}{W}');
      expect(rendered).toContain('Battle — Siege');
      expect(rendered).toContain('When Test Battle enters the battlefield');
      expect(rendered).toContain('5');
    });
  });
});
