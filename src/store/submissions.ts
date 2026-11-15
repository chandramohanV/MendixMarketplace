// Pure submission logic: no React, so it can be unit-tested.
import { slugify } from '../data/components';
import type { Submission, SubmissionInput } from '../types';

/** Submission ids start here so they never collide with catalog ids. */
export const SUBMISSION_ID_BASE = 1_000_000;

/** setTimeout overflows above 2^31-1 ms (~24.8 days) and would fire immediately. */
export const MAX_TIMER_MS = 2 ** 31 - 1;

export const nextSubmissionId = (existing: Submission[]): number =>
  Math.max(SUBMISSION_ID_BASE, ...existing.map((s) => s.id)) + 1;

const slugFor = (id: number, name: string) => `${id}-${slugify(name.trim())}`;

export function createSubmission(
  input: SubmissionInput,
  existing: Submission[],
  now: Date,
  publishDelayMs: number,
): Submission {
  const id = nextSubmissionId(existing);
  return {
    ...input,
    name: input.name.trim(),
    id,
    slug: slugFor(id, input.name),
    status: 'pending',
    submittedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    publishAt: new Date(now.getTime() + publishDelayMs).toISOString(),
  };
}

/** Applies an edit to a pending submission and restarts its review timer. */
export function reviseSubmission(
  existing: Submission,
  input: SubmissionInput,
  now: Date,
  publishDelayMs: number,
): Submission {
  return {
    ...existing,
    ...input,
    name: input.name.trim(),
    slug: slugFor(existing.id, input.name),
    updatedAt: now.toISOString(),
    publishAt: new Date(now.getTime() + publishDelayMs).toISOString(),
  };
}

/**
 * Milliseconds until a pending submission should auto-publish, or null when it shouldn't be scheduled
 * in this session (not pending, no publish time, or too far away for setTimeout).
 */
export function autoPublishDelay(s: Submission, nowMs: number): number | null {
  if (s.status !== 'pending' || !s.publishAt) return null;
  const delay = Math.max(0, Date.parse(s.publishAt) - nowMs);
  return delay <= MAX_TIMER_MS ? delay : null;
}
