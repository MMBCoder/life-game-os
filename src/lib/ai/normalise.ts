import type { z } from 'zod';

/**
 * Deterministic repair for the one failure mode models reproduce even when told the
 * exact error: returning more array items than the schema allows.
 *
 * Observed against live GPT-5 models, which ignore `maxItems` in non-strict JSON
 * Schema mode and then ignore it again on the repair round trip. Rather than spend a
 * second call to be refused a second time, the overflow is trimmed here using the
 * limit Zod itself reports.
 *
 * This only ever *removes* trailing items from an array that declared a maximum. It
 * never invents a value, never edits one, and never touches any other issue kind — a
 * number out of range or a missing field still fails, because silently inventing
 * those would be fabricating the model's answer rather than truncating it.
 */
export function trimOversizedArrays(
  value: unknown,
  error: z.ZodError,
): { changed: boolean; value: unknown } {
  const overflows = error.issues.filter(isArrayOverflow);
  if (overflows.length === 0) return { changed: false, value };

  let working = structuredClone(value);
  let changed = false;

  // Deepest paths first, so trimming a parent cannot invalidate a child's index.
  const ordered = [...overflows].sort((a, b) => b.path.length - a.path.length);

  for (const issue of ordered) {
    const max = Number(issue.maximum);
    if (!Number.isFinite(max) || max < 0) continue;

    if (issue.path.length === 0) {
      if (Array.isArray(working) && working.length > max) {
        working = working.slice(0, max);
        changed = true;
      }
      continue;
    }

    const parent = resolve(working, issue.path.slice(0, -1));
    const key = issue.path[issue.path.length - 1];
    if (parent === undefined || key === undefined) continue;

    const current = read(parent, key);
    if (Array.isArray(current) && current.length > max) {
      write(parent, key, current.slice(0, max));
      changed = true;
    }
  }

  return { changed, value: working };
}

interface ArrayOverflow {
  maximum: unknown;
  path: PropertyKey[];
}

function isArrayOverflow(issue: z.core.$ZodIssue): issue is z.core.$ZodIssue & ArrayOverflow {
  return (
    issue.code === 'too_big' &&
    'origin' in issue &&
    issue.origin === 'array' &&
    'maximum' in issue
  );
}

function resolve(root: unknown, path: PropertyKey[]): unknown {
  let node = root;
  for (const key of path) {
    if (node === null || node === undefined) return undefined;
    node = read(node, key);
  }
  return node;
}

function read(node: unknown, key: PropertyKey): unknown {
  if (Array.isArray(node)) {
    const index = Number(key);
    return Number.isInteger(index) ? node[index] : undefined;
  }
  if (typeof node === 'object' && node !== null) {
    return (node as Record<PropertyKey, unknown>)[key];
  }
  return undefined;
}

function write(node: unknown, key: PropertyKey, next: unknown): void {
  if (Array.isArray(node)) {
    const index = Number(key);
    if (Number.isInteger(index)) node[index] = next;
    return;
  }
  if (typeof node === 'object' && node !== null) {
    (node as Record<PropertyKey, unknown>)[key] = next;
  }
}
