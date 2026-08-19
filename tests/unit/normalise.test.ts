import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { trimOversizedArrays } from '@/lib/ai/normalise';

/**
 * The deterministic half of structured-output repair. Live GPT-5 models exceed
 * `maxItems` and keep doing it when asked to correct themselves, so the overflow is
 * trimmed here rather than paid for twice. The tests that matter are the ones proving
 * it only ever truncates — anything else would be fabricating the model's answer.
 */
function failureOf<T>(schema: z.ZodType<T>, value: unknown): z.ZodError {
  const result = schema.safeParse(value);
  if (result.success) throw new Error('expected the value to fail validation');
  return result.error;
}

describe('trimOversizedArrays', () => {
  it('trims a top-level array down to its declared maximum', () => {
    const schema = z.object({ tags: z.array(z.string()).max(3) });
    const input = { tags: ['a', 'b', 'c', 'd', 'e'] };

    const { changed, value } = trimOversizedArrays(input, failureOf(schema, input));

    expect(changed).toBe(true);
    expect(schema.parse(value)).toEqual({ tags: ['a', 'b', 'c'] });
  });

  it('keeps the earliest items, because models put their best answer first', () => {
    const schema = z.object({ items: z.array(z.number()).max(2) });
    const input = { items: [1, 2, 3, 4] };

    const { value } = trimOversizedArrays(input, failureOf(schema, input));

    expect(value).toEqual({ items: [1, 2] });
  });

  it('trims arrays nested inside array elements', () => {
    const schema = z.object({
      boldResults: z.array(z.object({ evidence: z.array(z.string()).max(2) })),
    });
    const input = {
      boldResults: [{ evidence: ['a', 'b', 'c'] }, { evidence: ['d', 'e', 'f', 'g'] }],
    };

    const { changed, value } = trimOversizedArrays(input, failureOf(schema, input));

    expect(changed).toBe(true);
    expect(schema.parse(value)).toEqual({
      boldResults: [{ evidence: ['a', 'b'] }, { evidence: ['d', 'e'] }],
    });
  });

  it('handles the root itself being an oversized array', () => {
    const schema = z.array(z.string()).max(1);
    const input = ['only', 'extra'];

    const { changed, value } = trimOversizedArrays(input, failureOf(schema, input));

    expect(changed).toBe(true);
    expect(value).toEqual(['only']);
  });

  it('does not touch the input object', () => {
    const schema = z.object({ tags: z.array(z.string()).max(1) });
    const input = { tags: ['a', 'b'] };

    trimOversizedArrays(input, failureOf(schema, input));

    expect(input).toEqual({ tags: ['a', 'b'] });
  });

  it('reports no change for failures that are not array overflows', () => {
    const schema = z.object({ score: z.number().max(1) });
    const input = { score: 8 };

    const { changed, value } = trimOversizedArrays(input, failureOf(schema, input));

    expect(changed).toBe(false);
    expect(value).toEqual({ score: 8 });
  });

  it('never invents items for an array that is too short', () => {
    const schema = z.object({ boldResults: z.array(z.string()).length(3) });
    const input = { boldResults: ['one'] };

    const { changed } = trimOversizedArrays(input, failureOf(schema, input));

    expect(changed).toBe(false);
  });

  it('leaves an out-of-range number alone while trimming a sibling array', () => {
    const schema = z.object({
      questions: z.array(z.object({ valueScore: z.number().max(1) })).max(1),
    });
    const input = { questions: [{ valueScore: 9 }, { valueScore: 8 }] };

    const { changed, value } = trimOversizedArrays(input, failureOf(schema, input));

    // The array shrinks; the bad score survives and must still fail validation, so a
    // model that misread the scale is corrected by a round trip rather than silently
    // accepted.
    expect(changed).toBe(true);
    expect(value).toEqual({ questions: [{ valueScore: 9 }] });
    expect(schema.safeParse(value).success).toBe(false);
  });
});
