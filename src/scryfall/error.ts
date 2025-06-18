import { z } from 'zod/v4';

export const ScryfallErrorSchema = z
  .object({
    object: z.literal('error'),
    code: z
      .string()
      .describe('A computer-friendly string representing the appropriate HTTP status code'),
    status: z.number().describe('An integer HTTP status code for this error'),
    details: z.string().describe('A human-readable string explaining the error'),
    type: z
      .string()
      .nullable()
      .describe(
        'A computer-friendly string that provides additional context for the main error. For example, an endpoint many generate HTTP 404 errors for different kinds of input. This field will provide a label for the specific kind of 404 failure, such as ambiguous'
      ),
    warnings: z
      .array(z.string())
      .nullable()
      .describe(
        'If your input also generated non-failure warnings, they will be provided as human-readable strings in this array'
      ),
  })
  .describe('An error object returned by Scryfall');

export type ScryfallError = z.infer<typeof ScryfallErrorSchema>;
