import { ScryfallError, ScryfallErrorSchema } from './error.js';

describe('ScryfallError', () => {
  describe('validation', () => {
    it('should validate valid error', () => {
      const validError: ScryfallError = {
        object: 'error',
        code: 'not_found',
        status: 404,
        details: 'Card not found',
        type: 'ambiguous',
        warnings: ['This is a warning'],
      };

      const result = ScryfallErrorSchema.safeParse(validError);
      expect(result.success).toBe(true);
    });

    it('should validate error with null type and warnings', () => {
      const validError: ScryfallError = {
        object: 'error',
        code: 'not_found',
        status: 404,
        details: 'Card not found',
        type: null,
        warnings: null,
      };

      const result = ScryfallErrorSchema.safeParse(validError);
      expect(result.success).toBe(true);
    });

    it('should reject invalid error', () => {
      const invalidError = {
        object: 'card', // should be 'error'
        code: 'not_found',
        status: '404', // should be a number
        details: 'Card not found',
        type: 'ambiguous',
        warnings: ['This is a warning'],
      };

      const result = ScryfallErrorSchema.safeParse(invalidError);
      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('Invalid input: expected "error"'),
          }),
        ])
      );
    });

    it('should reject error with invalid status type', () => {
      const invalidError = {
        object: 'error',
        code: 'not_found',
        status: '404', // should be a number
        details: 'Card not found',
        type: 'ambiguous',
        warnings: ['This is a warning'],
      };

      const result = ScryfallErrorSchema.safeParse(invalidError);
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
});
