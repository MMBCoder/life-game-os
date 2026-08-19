import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth/session';
import * as gameRepo from '@/lib/db/repositories/game';
import { GoalClient } from './goal-client';

export const metadata: Metadata = { title: 'Whole Goal' };

export default async function GoalPage() {
  const user = await requireSession();
  const goal = await gameRepo.getPrimaryGoal(user.id);
  const wholeGoal = goal ? await gameRepo.getWholeGoal(user.id, goal.id) : null;

  return (
    <div className="space-y-8">
      <header>
        <p className="type-label text-ink-faint">Your whole goal</p>
        <h1 className="type-statement mt-2 text-ink">
          A goal is never only an outcome.
        </h1>
        <p className="type-body mt-3 max-w-2xl text-ink-muted">
          Result, experience, impact, identity. A target you can hit and still regret is not a
          goal worth planning around.
        </p>
      </header>

      <GoalClient
        existing={
          goal && wholeGoal
            ? {
                goalId: goal.id,
                title: goal.title,
                rawInput: goal.rawInput,
                horizonMonths: goal.horizonMonths,
                result: wholeGoal.result,
                experience: wholeGoal.experience,
                impact: wholeGoal.impact,
                identity: wholeGoal.identity,
                mostImportantDimension: wholeGoal.mostImportantDimension,
                source: wholeGoal.source,
                confidence: wholeGoal.confidence,
              }
            : null
        }
      />
    </div>
  );
}
