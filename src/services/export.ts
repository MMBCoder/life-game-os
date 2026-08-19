import 'server-only';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

/**
 * Complete data export. Deliberately exhaustive rather than a summary — the export
 * capability in spec §50 is only meaningful if it returns everything the system
 * holds about the person.
 *
 * Excluded: password hash and salt, and session token hashes. Those are credentials,
 * not personal data, and exporting them would be a security regression.
 */
export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const database = await db();

  const [
    users,
    profiles,
    identityModels,
    values,
    strengths,
    constraints,
    nonNegotiables,
    behavioralPatterns,
    observations,
    lifeDomains,
    lifeScores,
    goals,
    wholeGoals,
    games,
    boldResults,
    milestones,
    strategicMoves,
    stopListItems,
    protectListItems,
    gameRisks,
    squadMembers,
    players,
    decisions,
    actions,
    protocols,
    protocolItems,
    rituals,
    routines,
    stateSnapshots,
    intentionSnapshots,
    reflections,
    insights,
    blindSpots,
    insightPlans,
    dayLogs,
    memoryItems,
    councilRuns,
    agentRuns,
    agentOutputs,
    agentConflicts,
    agentDecisions,
    recommendations,
    sacrificeAssessments,
  ] = await Promise.all([
    database.select().from(schema.users).where(eq(schema.users.id, userId)),
    database.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)),
    database.select().from(schema.identityModels).where(eq(schema.identityModels.userId, userId)),
    database.select().from(schema.values).where(eq(schema.values.userId, userId)),
    database.select().from(schema.strengths).where(eq(schema.strengths.userId, userId)),
    database.select().from(schema.constraints).where(eq(schema.constraints.userId, userId)),
    database.select().from(schema.nonNegotiables).where(eq(schema.nonNegotiables.userId, userId)),
    database
      .select()
      .from(schema.behavioralPatterns)
      .where(eq(schema.behavioralPatterns.userId, userId)),
    database.select().from(schema.observations).where(eq(schema.observations.userId, userId)),
    database.select().from(schema.lifeDomains).where(eq(schema.lifeDomains.userId, userId)),
    database.select().from(schema.lifeScores).where(eq(schema.lifeScores.userId, userId)),
    database.select().from(schema.goals).where(eq(schema.goals.userId, userId)),
    database.select().from(schema.wholeGoals).where(eq(schema.wholeGoals.userId, userId)),
    database.select().from(schema.games).where(eq(schema.games.userId, userId)),
    database.select().from(schema.boldResults).where(eq(schema.boldResults.userId, userId)),
    database.select().from(schema.milestones).where(eq(schema.milestones.userId, userId)),
    database.select().from(schema.strategicMoves).where(eq(schema.strategicMoves.userId, userId)),
    database.select().from(schema.stopListItems).where(eq(schema.stopListItems.userId, userId)),
    database
      .select()
      .from(schema.protectListItems)
      .where(eq(schema.protectListItems.userId, userId)),
    database.select().from(schema.gameRisks).where(eq(schema.gameRisks.userId, userId)),
    database.select().from(schema.squadMembers).where(eq(schema.squadMembers.userId, userId)),
    database.select().from(schema.players).where(eq(schema.players.userId, userId)),
    database.select().from(schema.decisions).where(eq(schema.decisions.userId, userId)),
    database.select().from(schema.actions).where(eq(schema.actions.userId, userId)),
    database.select().from(schema.protocols).where(eq(schema.protocols.userId, userId)),
    database.select().from(schema.protocolItems).where(eq(schema.protocolItems.userId, userId)),
    database.select().from(schema.rituals).where(eq(schema.rituals.userId, userId)),
    database.select().from(schema.routines).where(eq(schema.routines.userId, userId)),
    database.select().from(schema.stateSnapshots).where(eq(schema.stateSnapshots.userId, userId)),
    database
      .select()
      .from(schema.intentionSnapshots)
      .where(eq(schema.intentionSnapshots.userId, userId)),
    database.select().from(schema.reflections).where(eq(schema.reflections.userId, userId)),
    database.select().from(schema.insights).where(eq(schema.insights.userId, userId)),
    database.select().from(schema.blindSpots).where(eq(schema.blindSpots.userId, userId)),
    database.select().from(schema.insightPlans).where(eq(schema.insightPlans.userId, userId)),
    database.select().from(schema.dayLogs).where(eq(schema.dayLogs.userId, userId)),
    database.select().from(schema.memoryItems).where(eq(schema.memoryItems.userId, userId)),
    database.select().from(schema.councilRuns).where(eq(schema.councilRuns.userId, userId)),
    database.select().from(schema.agentRuns).where(eq(schema.agentRuns.userId, userId)),
    database.select().from(schema.agentOutputs).where(eq(schema.agentOutputs.userId, userId)),
    database.select().from(schema.agentConflicts).where(eq(schema.agentConflicts.userId, userId)),
    database.select().from(schema.agentDecisions).where(eq(schema.agentDecisions.userId, userId)),
    database.select().from(schema.recommendations).where(eq(schema.recommendations.userId, userId)),
    database
      .select()
      .from(schema.sacrificeAssessments)
      .where(eq(schema.sacrificeAssessments.userId, userId)),
  ]);

  const account = users[0];

  return {
    exportedAt: new Date().toISOString(),
    format: 'life-game-os/v1',
    account: account
      ? {
          id: account.id,
          email: account.email,
          name: account.name,
          timezone: account.timezone,
          createdAt: account.createdAt,
        }
      : null,
    profile: profiles[0] ?? null,
    personalModel: {
      identity: identityModels[0] ?? null,
      values,
      strengths,
      constraints,
      nonNegotiables,
      behavioralPatterns,
      observations,
    },
    lifeMap: { domains: lifeDomains, scores: lifeScores },
    goals: { goals, wholeGoals },
    game: {
      games,
      boldResults,
      milestones,
      strategicMoves,
      stopListItems,
      protectListItems,
      risks: gameRisks,
      squad: squadMembers,
    },
    player: { players, decisions },
    execution: { actions, protocols, protocolItems, rituals, routines, dayLogs },
    state: { stateSnapshots, intentionSnapshots },
    reflection: { reflections, insights, blindSpots, insightPlans },
    memory: memoryItems,
    council: {
      runs: councilRuns,
      agentRuns,
      agentOutputs,
      conflicts: agentConflicts,
      decisions: agentDecisions,
      recommendations,
      sacrificeAssessments,
    },
  };
}
