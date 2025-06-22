import { TemplateContext } from '../templates/types.js';
import {
  ScryfallCard,
  ScryfallCardList,
  ScryfallCardSchema,
  renderCard,
  renderCardList,
} from './card.js';

describe('ScryfallCard', () => {
  describe('validation', () => {
    it('should validate valid card', () => {
      const validCard: ScryfallCard = {
        object: 'card',
        id: '123456',
        name: 'Test Card',
        mana_cost: '{1}{W}',
        cmc: 2,
        color_identity: ['W'],
        type_line: 'Creature — Human',
        oracle_text: 'When Test Card enters the battlefield, draw a card.',
        game_changer: false,
        produced_mana: null,
        set: 'M21',
        set_name: 'Core Set 2021',
        collector_number: '1',
        rarity: 'common',
        card_faces: null,
        prices: {
          usd: '0.50',
          usd_foil: '1.00',
          eur: '0.40',
          tix: '0.25',
        },
        power: '2',
        toughness: '2',
        loyalty: null,
        defense: null,
      };

      const result = ScryfallCardSchema.safeParse(validCard);
      expect(result.success).toBe(true);
    });

    it('should validate card with multiple faces', () => {
      const cardWithFaces: ScryfallCard = {
        object: 'card',
        id: '123457',
        name: 'Test Card // Test Card Back',
        mana_cost: '{1}{W}',
        cmc: 2,
        color_identity: ['W'],
        type_line: 'Creature — Human // Creature — Angel',
        oracle_text: 'When Test Card enters the battlefield, draw a card.',
        game_changer: false,
        produced_mana: null,
        set: 'M21',
        set_name: 'Core Set 2021',
        collector_number: '2',
        rarity: 'rare',
        card_faces: [
          {
            name: 'Test Card',
            mana_cost: '{1}{W}',
            cmc: 2,
            type_line: 'Creature — Human',
            oracle_text: 'When Test Card enters the battlefield, draw a card.',
            power: '2',
            toughness: '2',
            defense: null,
            loyalty: null,
          },
          {
            name: 'Test Card Back',
            mana_cost: '{2}{W}{W}',
            cmc: 4,
            type_line: 'Creature — Angel',
            oracle_text: 'Flying\nWhen Test Card Back enters the battlefield, gain 3 life.',
            power: '3',
            toughness: '3',
            defense: null,
            loyalty: null,
          },
        ],
        prices: {
          usd: '1.50',
          usd_foil: '2.00',
          eur: '1.20',
          tix: '0.75',
        },
        power: '2',
        toughness: '2',
        loyalty: null,
        defense: null,
      };

      const result = ScryfallCardSchema.safeParse(cardWithFaces);
      expect(result.success).toBe(true);
    });

    it('should reject invalid card', () => {
      const invalidCard = {
        object: 'card',
        id: '123456',
        name: 'Test Card',
        mana_cost: '{1}{W}',
        cmc: '2', // should be number
        color_identity: ['W'],
        type_line: 'Creature — Human',
        oracle_text: 'When Test Card enters the battlefield, draw a card.',
        game_changer: false,
        produced_mana: null,
        set: 'M21',
        set_name: 'Core Set 2021',
        collector_number: '1',
        rarity: 'common',
        card_faces: null,
        prices: {
          usd: '0.50',
          usd_foil: '1.00',
          eur: '0.40',
          tix: '0.25',
        },
        power: '2',
        toughness: '2',
        loyalty: null,
        defense: null,
      };

      const result = ScryfallCardSchema.safeParse(invalidCard);
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
    it('should render single card correctly', () => {
      const card: ScryfallCard = {
        object: 'card',
        id: '123456',
        name: 'Test Card',
        mana_cost: '{1}{W}',
        cmc: 2,
        color_identity: ['W'],
        type_line: 'Creature — Human',
        oracle_text: 'When Test Card enters the battlefield, draw a card.',
        game_changer: false,
        produced_mana: null,
        set: 'M21',
        set_name: 'Core Set 2021',
        collector_number: '1',
        rarity: 'common',
        card_faces: null,
        prices: {
          usd: '0.50',
          usd_foil: '1.00',
          eur: '0.40',
          tix: '0.25',
        },
        power: '2',
        toughness: '2',
        loyalty: null,
        defense: null,
      };

      const context: TemplateContext = {
        depth: 1,
      };

      const rendered = renderCard(card, context);
      expect(rendered).toBe(
        `# Test Card

**Set:** Core Set 2021 (M21) #1
**Rarity:** common

**Mana Cost:** {1}{W} (CMC: 2)
**Type:** Creature — Human

**Oracle Text:**
When Test Card enters the battlefield, draw a card.

**Power/Toughness:** 2/2


## Prices
- USD: $0.50
- USD Foil: $1.00
- EUR: €0.40
- MTGO: 0.25 tix`
      );
    });

    it('should render card list correctly', () => {
      const cardList: ScryfallCardList = {
        object: 'list',
        total_cards: 2,
        has_more: false,
        next_page: null,
        warnings: null,
        data: [
          {
            object: 'card',
            id: '123456',
            name: 'Test Card 1',
            mana_cost: '{1}{W}',
            cmc: 2,
            color_identity: ['W'],
            type_line: 'Creature — Human',
            oracle_text: 'When Test Card 1 enters the battlefield, draw a card.',
            game_changer: false,
            produced_mana: null,
            set: 'M21',
            set_name: 'Core Set 2021',
            collector_number: '1',
            rarity: 'common',
            card_faces: null,
            prices: {
              usd: '0.50',
              usd_foil: '1.00',
              eur: '0.40',
              tix: '0.25',
            },
            power: '2',
            toughness: '2',
            loyalty: null,
            defense: null,
          },
          {
            object: 'card',
            id: '123457',
            name: 'Test Card 2',
            mana_cost: '{2}{W}',
            cmc: 3,
            color_identity: ['W'],
            type_line: 'Creature — Angel',
            oracle_text: 'Flying\nWhen Test Card 2 enters the battlefield, gain 3 life.',
            game_changer: false,
            produced_mana: null,
            set: 'M21',
            set_name: 'Core Set 2021',
            collector_number: '2',
            rarity: 'uncommon',
            card_faces: null,
            prices: {
              usd: '0.75',
              usd_foil: '1.50',
              eur: '0.60',
              tix: '0.35',
            },
            power: '3',
            toughness: '3',
            loyalty: null,
            defense: null,
          },
        ],
      };

      const context: TemplateContext = {
        depth: 1,
      };

      const rendered = renderCardList(cardList, context);
      expect(rendered).toBe(
        `# Test Card 1

**Set:** Core Set 2021 (M21) #1
**Rarity:** common

**Mana Cost:** {1}{W} (CMC: 2)
**Type:** Creature — Human

**Oracle Text:**
When Test Card 1 enters the battlefield, draw a card.

**Power/Toughness:** 2/2


## Prices
- USD: $0.50
- USD Foil: $1.00
- EUR: €0.40
- MTGO: 0.25 tix

# Test Card 2

**Set:** Core Set 2021 (M21) #2
**Rarity:** uncommon

**Mana Cost:** {2}{W} (CMC: 3)
**Type:** Creature — Angel

**Oracle Text:**
Flying
When Test Card 2 enters the battlefield, gain 3 life.

**Power/Toughness:** 3/3


## Prices
- USD: $0.75
- USD Foil: $1.50
- EUR: €0.60
- MTGO: 0.35 tix`
      );
    });
  });
});
