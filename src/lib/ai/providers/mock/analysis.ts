import type { CouncilContext } from '@/lib/personalization/context-types';
import type { AgentId, AgentOutput, CouncilDecision } from '@/schemas/agent';
import type {
  AdaptationPlan,
  BlindSpotDraft,
  DailyPlan,
  InsightPlanDraft,
  MonthlyReview,
  PlayerDecision,
  ResetOptions,
  StateAssessment,
  SuggestionSet,
  WeeklyIntelligence,
} from '@/schemas/artefacts';
import { ARCHETYPE_FRAMING, deriveSignals, pick, sample, type Signals } from './signals';
import { MOVES, STOP_ITEMS } from './library';

/* ── Agent envelopes ────────────────────────────────────────────────────────*/

/**
 * Each agent gets a distinct remit, a distinct voice and — critically — distinct
 * objection rights. The guardians raise objections the Strategy Agent cannot
 * dismiss, which is what turns thirteen opinions into a negotiation.
 */
export function makeAgentOutput(agent: AgentId, ctx: CouncilContext): AgentOutput {
  const s = deriveSignals(ctx);
  const base = {
    agent,
    status: 'suggested' as const,
    confidence: 0.72,
    reasoning: [] as string[],
    insights: [] as AgentOutput['insights'],
    recommendations: [] as AgentOutput['recommendations'],
    risks: [] as AgentOutput['risks'],
    questions: [] as AgentOutput['questions'],
    proposedChanges: [] as AgentOutput['proposedChanges'],
    objections: [] as AgentOutput['objections'],
    evidence: [] as AgentOutput['evidence'],
  };

  switch (agent) {
    case 'identity':
      return {
        ...base,
        summary: `Your stated direction points at becoming ${s.identityTo ?? 'someone who operates differently'}, and the gap is less about capability than about permission.`,
        confidence: 0.7,
        reasoning: [
          `You describe the goal in terms of what you would be trusted with, not what you would produce — that reads as an identity shift rather than a performance one.`,
          `The things you refuse to sacrifice are consistent with each other, which suggests they are values rather than preferences.`,
        ],
        insights: [
          {
            title: 'You may value strategic autonomy more than title progression',
            detail: `Your description emphasises what you get to decide rather than what you get called. If that is right, a plan optimised for promotion mechanics would satisfy the wrong objective.`,
            confidence: 0.68,
            evidence: evidenceFrom(ctx, 2),
          },
        ],
        questions: [
          {
            question: `When you imagine this having gone well, is it the decisions you are trusted with that changed, or the recognition?`,
            why: 'These lead to materially different strategies, and the difference is not inferable from what you have said so far.',
            valueScore: 0.82,
            suggestions: ['The decisions', 'The recognition', 'Both, but decisions first'],
          },
        ],
        evidence: evidenceFrom(ctx, 3),
      };

    case 'reality':
      return {
        ...base,
        summary: `Your week is ${s.capacity.verdict}: roughly ${s.capacity.committedHoursPerWeek} of ${s.capacity.availableHoursPerWeek} usable hours are already committed.`,
        confidence: 0.8,
        reasoning: [
          `Capacity is calculated from what you have told us about commitments, not estimated.`,
          s.hardConstraints.length > 0
            ? `You have ${s.hardConstraints.length} high-severity constraint${s.hardConstraints.length === 1 ? '' : 's'} that any plan has to respect as given.`
            : `No hard constraints recorded yet, so the plan assumes a normal week.`,
        ],
        insights: [
          {
            title: 'Time and energy are not the same constraint here',
            detail: `Energy reads around ${s.energy.toFixed(1)}/10. A plan that fits the calendar can still fail on capacity, so the schedule alone is not a feasibility test.`,
            confidence: 0.74,
            evidence: evidenceFrom(ctx, 2),
          },
        ],
        evidence: evidenceFrom(ctx, 4),
      };

    case 'goal':
      return {
        ...base,
        summary: `The goal is expressible in all four dimensions, which means it can be planned against rather than only aspired to.`,
        recommendations: [
          {
            title: 'Commit to one primary goal for this quarter',
            detail: `${s.goalTitle ?? 'The stated ambition'} is enough for ninety days on its own.`,
            rationale:
              'Parallel major goals reliably produce slower progress on each and more anxiety about all of them.',
            priority: 'high',
            leverage: 'focus',
          },
        ],
        evidence: evidenceFrom(ctx, 2),
      };

    case 'player':
      return {
        ...base,
        summary: `The version of you this game needs is someone who ${ARCHETYPE_FRAMING[s.archetype]}.`,
        recommendations: [
          {
            title: 'Adopt explicit agreements rather than intentions',
            detail:
              'Written agreements are what hold when a week goes badly; intentions are what get renegotiated in the moment.',
            rationale: 'Your risk is not motivation — it is in-the-moment concession under pressure.',
            priority: 'medium',
          },
        ],
        evidence: evidenceFrom(ctx, 2),
      };

    case 'strategy':
      return {
        ...base,
        summary: `The strategy is ${s.leverage.slice(0, 2).join(' then ')} — create room first, then convert it into a visible result.`,
        confidence: 0.76,
        reasoning: [
          `We tested whether this outcome could be reached through leverage rather than additional hours; it can.`,
          `The sequence matters more than the pace: nothing new works until something has ended.`,
        ],
        recommendations: sample(MOVES[s.archetype], 3, s.seed).map((m) => ({
          title: m.title,
          detail: m.detail,
          rationale: `Chosen because ${ARCHETYPE_FRAMING[s.archetype]}.`,
          priority: m.impact === 'high' ? ('high' as const) : ('medium' as const),
          leverage: m.leverage,
        })),
        proposedChanges: [
          {
            target: 'stop_list',
            operation: 'create',
            payload: { items: sample(STOP_ITEMS[s.archetype], 3, s.seed) },
            rationale: 'Capacity has to be created before it can be allocated.',
          },
        ],
        risks: [
          {
            title: 'Plan is adopted without the stop list being executed',
            detail: 'The moves get added to the existing load and are funded from protected time.',
            severity: 'high',
            likelihood: 'high',
            mitigation: 'Treat the stop list as week one, gating everything else.',
          },
        ],
        evidence: evidenceFrom(ctx, 3),
      };

    case 'capacity': {
      const overloaded = s.capacity.verdict === 'overloaded' || s.capacity.verdict === 'tight';
      return {
        ...base,
        summary: `Load is at ${Math.round(s.capacity.load * 100)}% of usable capacity — ${s.capacity.verdict}.`,
        confidence: 0.85,
        reasoning: [
          `Committed hours divided by available hours, adjusted for reported energy.`,
          overloaded
            ? `There is no room for an additional initiative without something being removed first.`
            : `There is genuine headroom for one additional commitment.`,
        ],
        risks: overloaded
          ? [
              {
                title: 'Adding work at current load will fail or be funded from protected time',
                detail: `At ${Math.round(s.capacity.load * 100)}% committed, new work does not fit. It will either not happen or it will come out of ${listOf(s.protections.map((p) => p.label), 2) || 'recovery'}.`,
                severity: 'high',
                likelihood: 'high',
                mitigation: 'End or hand over at least one recurring commitment before starting anything new.',
              },
            ]
          : [],
        objections: overloaded
          ? [
              {
                against: 'strategy' as const,
                claim: `Capacity is already at ${Math.round(s.capacity.load * 100)}%. Any proposal that adds net workload is not feasible as written.`,
                severity: 'high' as const,
                basis: 'capacity' as const,
              },
            ]
          : [],
        evidence: evidenceFrom(ctx, 2),
      };
    }

    case 'health': {
      const atRisk = s.energy <= 4.5 || s.archetype === 'depleted' || s.capacity.verdict === 'overloaded';
      return {
        ...base,
        summary: atRisk
          ? `Recovery is already the funding source for the current pace. Any plan that adds load without returning capacity carries real risk.`
          : `The sustainability picture is workable, provided recovery stays explicitly protected rather than assumed.`,
        confidence: 0.75,
        reasoning: [
          `Assessed from your reported energy and the domains reading lowest on satisfaction — this is a wellness read, not a clinical one.`,
          atRisk
            ? `Where energy is this low, restoring the base usually produces more progress than pushing through does.`
            : `Protecting the base is cheaper than rebuilding it.`,
        ],
        insights: atRisk
          ? [
              {
                title: 'This may be a capacity problem being treated as a motivation problem',
                detail: `Possible pattern: the response to falling behind has been more effort, while the limiting input has been energy. If that is right, the current strategy makes the constraint worse. Worth discussing sustained exhaustion with a qualified professional if it persists.`,
                confidence: 0.66,
                evidence: evidenceFrom(ctx, 2),
              },
            ]
          : [],
        risks: atRisk
          ? [
              {
                title: 'Unacceptable recovery risk if load increases',
                detail: 'The plan would be drawing on a base that is already depleted.',
                severity: 'critical',
                likelihood: 'high',
                mitigation: 'Reduce load in the first thirty days; add nothing until the base is stable.',
              },
            ]
          : [],
        objections: atRisk
          ? [
              {
                against: 'strategy' as const,
                claim:
                  'This proposal increases cognitive load while recovery is already being borrowed against. I cannot support it in its current form.',
                severity: 'critical' as const,
                basis: 'health' as const,
              },
            ]
          : [],
        recommendations: [
          {
            title: 'Define a minimum mode before you need it',
            detail:
              'A ten-minute version of each commitment that still counts, agreed now rather than improvised on a bad day.',
            rationale: 'All-or-nothing execution is what turns one difficult day into a lost month.',
            priority: atRisk ? 'high' : 'medium',
          },
        ],
        evidence: evidenceFrom(ctx, 3),
      };
    }

    case 'relationships': {
      const conflict = s.hasFamilyProtection && s.capacity.verdict !== 'headroom';
      return {
        ...base,
        summary: conflict
          ? `You have named ${listOf(s.protections.filter((p) => /family|partner|child/i.test(p.label)).map((p) => p.label), 2) || 'family time'} as protected, and current load makes it the likeliest thing to be quietly spent.`
          : `Relationship commitments are currently compatible with the plan, provided presence is scheduled rather than hoped for.`,
        confidence: 0.73,
        reasoning: [
          conflict
            ? `Protected time that is not booked is the first thing a busy week reallocates.`
            : `No direct conflict detected between the plan and stated relationship commitments.`,
        ],
        objections: conflict
          ? [
              {
                against: 'strategy' as const,
                claim: `This proposal draws on time the person has explicitly protected. Presence has to be booked, not assumed.`,
                severity: 'high' as const,
                basis: 'relationships' as const,
              },
            ]
          : [],
        recommendations: [
          {
            title: 'Book the protected time as an appointment',
            detail: 'Recurring, visible in the calendar, and defended like a commitment to someone else — because it is one.',
            rationale: 'Unbooked protected time is reallocated by default in a tight week.',
            priority: conflict ? 'high' : 'medium',
          },
        ],
        evidence: evidenceFrom(ctx, 2),
      };
    }

    case 'execution':
      return {
        ...base,
        summary: `The plan converts into three moves a day and one weekly review — small enough to survive a bad week.`,
        recommendations: [
          {
            title: 'One strategic, one self, one relationship move per day',
            detail:
              'Three named moves rather than a task list. It keeps the plan balanced by construction rather than by intention.',
            rationale: 'A single-category day is how the protected domains quietly lose.',
            priority: 'high',
          },
        ],
        evidence: evidenceFrom(ctx, 2),
      };

    case 'reflection': {
      const latest = ctx.recentReflections[0];
      return {
        ...base,
        summary: latest
          ? `Last period, ${latest.moved.length} thing${latest.moved.length === 1 ? '' : 's'} moved and ${latest.didntMove.length} did not.${latest.costMoreThanExpected ? ` The unexpected cost was ${latest.costMoreThanExpected}.` : ''}`
          : `No reflection history yet, so patterns cannot be distinguished from single events.`,
        confidence: latest ? 0.7 : 0.4,
        insights: latest
          ? [
              {
                title: 'What did not move looks like a capacity issue rather than a commitment issue',
                detail: `Possible pattern: the items that stalled are the ones that needed uninterrupted time, not the ones you cared least about. Behavioural tendency observed, not a conclusion.`,
                confidence: 0.6,
                evidence: evidenceFrom(ctx, 2),
              },
            ]
          : [],
        questions: [
          {
            question: 'What cost more than you expected this week?',
            why: 'The gap between expected and actual cost is the most reliable early signal that a plan needs adjusting.',
            valueScore: 0.7,
            suggestions: ['A specific commitment', 'Context switching', 'An unresolved conversation', 'Nothing unexpected'],
          },
        ],
        evidence: evidenceFrom(ctx, 2),
      };
    }

    case 'adaptation':
      return {
        ...base,
        summary: `The plan should be adjusted rather than replaced: the objective still holds, the method needs tightening.`,
        recommendations: [
          {
            title: 'Reduce scope before reducing ambition',
            detail: 'Cut the number of parallel moves; keep the target.',
            rationale: 'Ambition is rarely the problem. Method usually is.',
            priority: 'high',
            leverage: 'focus',
          },
        ],
        proposedChanges: [
          {
            target: 'game',
            operation: 'update',
            payload: { status: 'recalibrating' },
            rationale: 'Context has moved far enough that the plan was designed for a situation that no longer holds.',
          },
        ],
        evidence: evidenceFrom(ctx, 2),
      };

    case 'redTeam':
      return makeRedTeam(ctx, s, base);

    case 'orchestrator':
      return {
        ...base,
        summary: `Synthesis: keep the ambition, change the method, and protect what was named as non-negotiable.`,
        confidence: 0.78,
        reasoning: [
          `Guardian objections were treated as binding rather than advisory.`,
          `Where capacity and strategy disagreed, the plan reduced scope rather than the target.`,
        ],
        evidence: evidenceFrom(ctx, 3),
      };

    default:
      return { ...base, summary: 'No analysis produced for this agent.' };
  }
}

function makeRedTeam(
  ctx: CouncilContext,
  s: Signals,
  base: Omit<AgentOutput, 'agent' | 'summary'> & { agent: AgentId },
): AgentOutput {
  const tight = s.capacity.verdict === 'tight' || s.capacity.verdict === 'overloaded';
  const peerAddsWork = ctx.peerOutputs.some((p) =>
    p.recommendations.some((r) => /add|take on|start|new initiative|more/i.test(r)),
  );

  return {
    ...base,
    agent: 'redTeam',
    summary: tight
      ? `The plan's central assumption — that the freed capacity will actually be freed — is the thing most likely to be wrong.`
      : `The plan is feasible, but it assumes consistency through a bad week, and nothing in it is designed for one.`,
    confidence: 0.7,
    reasoning: [
      `Attacked the plan on four fronts: assumptions, sequencing, what is missing, and what it quietly costs.`,
      `The strongest failure mode is not collapse — it is the plan being adopted alongside everything else.`,
    ],
    risks: [
      {
        title: 'Handover happens on paper but not in practice',
        detail:
          'Delegated work returns informally: the questions still come to you, so the cognitive load stays even though the task moved.',
        severity: 'high',
        likelihood: 'high',
        mitigation: 'Define handover as "they answer the questions too", and name a date after which you stop being consulted.',
      },
      {
        title: 'Nothing is designed for a bad week',
        detail:
          'The plan assumes a normal week. The first difficult one will either break it or be absorbed by protected time.',
        severity: 'medium',
        likelihood: 'high',
        mitigation: 'Agree the minimum mode now, and treat using it as executing the plan rather than failing it.',
      },
    ],
    objections: peerAddsWork
      ? [
          {
            against: 'strategy',
            claim:
              'A recommendation here adds net workload without a corresponding removal. At current capacity that is an unfunded commitment, not a strategy.',
            severity: 'high',
            basis: 'feasibility',
          },
        ]
      : [
          {
            against: 'execution',
            claim:
              'The execution plan assumes uninterrupted blocks that this person’s week has not historically produced.',
            severity: 'medium',
            basis: 'feasibility',
          },
        ],
    insights: [
      {
        title: 'Possible blind spot: a positioning problem being solved with additional work',
        detail: `Hypothesis, not a conclusion — the stated goal is about how you are perceived and trusted, while the instinctive response has been to produce more. Those are different problems with different solutions.`,
        confidence: 0.62,
        evidence: evidenceFrom(ctx, 2),
      },
    ],
    evidence: evidenceFrom(ctx, 3),
  };
}

/* ── Orchestrated decision ──────────────────────────────────────────────────*/

export function makeCouncilDecision(ctx: CouncilContext): CouncilDecision {
  const s = deriveSignals(ctx);
  const guardianObjections = ctx.peerOutputs.flatMap((p) =>
    p.objections.filter((o) => o.severity === 'high' || o.severity === 'critical'),
  );
  const blocked = guardianObjections.length > 0;

  const questions = ctx.peerOutputs.length > 0 ? [] : [];

  return {
    verdict: blocked ? 'approve_with_changes' : 'approve',
    headline: blocked
      ? 'Create leverage before adding work.'
      : `Concentrate on ${s.leverage[0] ?? 'focus'} and protect the base.`,
    rationale: blocked
      ? `The strategy is sound and the ambition stands. What does not stand is funding it from capacity you do not have. ${guardianObjections
          .slice(0, 2)
          .map((o) => o.claim)
          .join(' ')} So the recommendation is unchanged in target and different in method: create room in the first thirty days, then convert it. ${capitalise(ARCHETYPE_FRAMING[s.archetype])}.`
      : `There is genuine room to move here. The plan concentrates on ${s.leverage.slice(0, 2).join(' and ')}, keeps the count of parallel objectives at one, and names what is protected so it does not get spent by accident. ${capitalise(ARCHETYPE_FRAMING[s.archetype])}.`,
    tradeOffs: [
      'Progress in the first month comes from removal rather than from visible output, which can feel slower than it is.',
      s.protections.length > 0
        ? `Holding ${listOf(s.protections.map((p) => p.label), 2)} fixed means some faster routes are off the table by choice.`
        : 'Keeping one objective means other opportunities wait a quarter.',
    ],
    omissions: [
      'We did not add a second major initiative.',
      'We did not increase working hours.',
      'We did not add habits unrelated to this game.',
    ],
    confidence: blocked ? 0.74 : 0.79,
    nextQuestion: questions[0] ?? null,
  };
}

/* ── Ask My Player ──────────────────────────────────────────────────────────*/

export function makePlayerDecision(ctx: CouncilContext): PlayerDecision {
  const s = deriveSignals(ctx);
  const question = ctx.ask.question ?? 'this decision';
  const tight = s.capacity.verdict === 'tight' || s.capacity.verdict === 'overloaded';
  const looksAdditive = /take|accept|join|add|another|extra|more|new/i.test(question);
  const looksStrategic = new RegExp(
    (s.goalTitle ?? 'goal').split(/\s+/).filter((w) => w.length > 4).slice(0, 3).join('|') || 'strategy',
    'i',
  ).test(question);

  const verdict: PlayerDecision['verdict'] =
    looksAdditive && tight && !looksStrategic
      ? 'decline'
      : looksAdditive && tight
        ? 'renegotiate'
        : looksAdditive && !tight
          ? 'take'
          : 'defer';

  const reasoningByVerdict: Record<PlayerDecision['verdict'], string> = {
    decline: `This adds workload without materially advancing your current ninety-day game. At ${Math.round(s.capacity.load * 100)}% committed capacity, saying yes means it comes out of ${listOf(s.protections.map((p) => p.label), 2) || 'recovery'} — you would be paying for it with something you said you would not spend.`,
    renegotiate: `The direction is right and the shape is wrong. It touches your current game, so refusing outright loses something real, but taking it as offered does not fit the capacity you actually have. Change the terms rather than the answer.`,
    take: `This advances the current game and you have the headroom for it. Take it, and name in advance what it replaces so it does not quietly become an addition.`,
    defer: `Nothing here is urgent enough to displace what is already committed. Deferring costs you very little; deciding now costs you focus.`,
    delegate: `This needs to happen and it does not need to be you. Handing it over costs one conversation and returns the whole commitment.`,
  };

  const betterMoveByVerdict: Record<PlayerDecision['verdict'], string> = {
    decline:
      'Decline directly, and offer the one thing you can do that costs you almost nothing — an introduction, a review, or fifteen minutes of context.',
    renegotiate:
      'Accept a reduced scope with an explicit end date, or accept it in exchange for handing over something you currently own.',
    take: 'Take it, and pick now which existing commitment it replaces.',
    defer: 'Put a date on revisiting it so deferring does not become avoidance.',
    delegate: 'Name the person, hand it over completely, and stop being the escalation path for it.',
  };

  return {
    verdict,
    headline:
      verdict === 'decline'
        ? 'Decline — this is workload, not progress.'
        : verdict === 'renegotiate'
          ? 'Renegotiate the terms rather than the answer.'
          : verdict === 'take'
            ? 'Take it — it advances the game and you have room.'
            : 'Defer — nothing here needs deciding today.',
    reasoning: reasoningByVerdict[verdict],
    conflictsWith:
      verdict === 'decline' || verdict === 'renegotiate'
        ? [
            'Capacity protection',
            ...s.protections.slice(0, 2).map((p) => p.label),
            'Strategic focus',
          ].slice(0, 4)
        : [],
    supports: verdict === 'take' ? ['Your current strategic objective', 'Visibility'] : [],
    betterMove: betterMoveByVerdict[verdict],
    opportunityCost:
      verdict === 'take'
        ? 'The time comes from somewhere — name it now rather than discovering it in week three.'
        : `Saying yes here would cost roughly the equivalent of your protected strategic block for the next month, which is the only place your current game is actually progressing.`,
    confidence: 0.73,
  };
}

/* ── Daily play ─────────────────────────────────────────────────────────────*/

export function makeDailyPlan(ctx: CouncilContext): DailyPlan {
  const s = deriveSignals(ctx);
  const strategic = pick(MOVES[s.archetype], s.seed, dayOffset(ctx.user.today));
  const mode: DailyPlan['suggestedMode'] =
    s.energy <= 4 ? 'minimum' : s.capacity.verdict === 'headroom' && s.energy >= 7 ? 'expansion' : 'standard';

  return {
    moves: [
      {
        title: strategic.title,
        kind: 'strategic',
        why: `This is the highest-leverage move available to you today: ${strategic.leverage}.`,
        timeMinutes: mode === 'minimum' ? 25 : 60,
        energyCost: strategic.effort,
      },
      {
        title: s.energy <= 4 ? 'Ten minutes of movement, nothing more' : 'Protect your recovery block',
        kind: 'health',
        why:
          s.energy <= 4
            ? 'Energy is the limiting input right now, so the minimum version is the correct version today.'
            : 'The base is what makes the rest of the plan repeatable.',
        timeMinutes: s.energy <= 4 ? 10 : 30,
        energyCost: 'low',
      },
      {
        title: s.hasFamilyProtection
          ? 'One undivided hour with no device present'
          : 'One conversation that is not about work',
        kind: 'relationship',
        why: s.hasFamilyProtection
          ? 'You named this as protected. Protected time that is not scheduled is the first thing a busy day reallocates.'
          : 'Relationships are the domain that degrades quietly rather than visibly.',
        timeMinutes: 60,
        energyCost: 'low',
      },
    ],
    councilNote:
      s.capacity.verdict === 'overloaded' || s.capacity.verdict === 'tight'
        ? `Your biggest opportunity this week is not doing more. It is becoming less operationally necessary, so the work that actually advances your game has somewhere to sit.`
        : `You have room this week. Spend it on the one move that compounds rather than on three that do not.`,
    suggestedMode: mode,
    oneDecision:
      s.capacity.verdict === 'overloaded'
        ? 'What will you end today, so that something else can start?'
        : `What is the highest-leverage decision you need to make today about ${trim(s.goalTitle ?? 'your current game', 50)}?`,
    confidence: 0.75,
  };
}

export function makeStateAssessment(ctx: CouncilContext): StateAssessment {
  const s = deriveSignals(ctx);
  const alignment = s.goalTitle ? 7.5 : 4;
  const capacityScore = Math.max(1, 10 - s.capacity.load * 10);

  const state: StateAssessment['state'] =
    s.energy <= 3
      ? 'surviving'
      : s.capacity.verdict === 'overloaded'
        ? 'stretched'
        : !s.goalTitle
          ? 'drifting'
          : s.energy >= 7.5 && s.capacity.verdict === 'headroom'
            ? 'expanding'
            : s.energy >= 6.5
              ? 'focused'
              : 'engaged';

  return {
    state,
    confidence: 0.72,
    drivers: [
      s.goalTitle ? 'Clear goal' : 'No single clear goal yet',
      s.capacity.verdict === 'overloaded' ? 'Capacity pressure' : 'Workable capacity',
      s.energy <= 4 ? 'Low energy' : 'Adequate energy',
      s.protections.length > 0 ? 'Explicit non-negotiables' : 'Protections not yet named',
    ],
    focus: clamp(alignment),
    energy: clamp(s.energy),
    alignment: clamp(alignment),
    capacity: clamp(capacityScore),
  };
}

/* ── Reflection ─────────────────────────────────────────────────────────────*/

export function makeWeeklyIntelligence(ctx: CouncilContext): WeeklyIntelligence {
  const s = deriveSignals(ctx);
  const latest = ctx.recentReflections[0];
  const moved = latest?.moved ?? [];
  const stalled = latest?.didntMove ?? [];

  return {
    progress:
      moved.length > 0
        ? `${moved.length} thing${moved.length === 1 ? '' : 's'} moved this week — ${listOf(moved, 2)}. That is real progress against the game, and it came from the moves you had already identified rather than from new ones.`
        : `Nothing named as moved this week. That is information, not failure: it usually means the week was consumed by commitments made before the game existed.`,
    pattern: {
      statement:
        stalled.length > 0
          ? `Possible pattern: what stalled (${listOf(stalled, 2)}) needed uninterrupted time rather than more motivation. The items that moved were the ones that fit into the gaps.`
          : `Possible pattern: progress this week came from removal rather than addition, which is consistent with what the plan was designed to do.`,
      confidence: 0.62,
      hypothesis: true,
    },
    risk:
      s.capacity.verdict === 'overloaded'
        ? `The main risk is unchanged: the plan is running alongside the old load rather than replacing part of it. That resolves itself in one direction or the other within a fortnight.`
        : `The main risk is a good week producing pressure to add a second objective.`,
    insight:
      latest?.costMoreThanExpected
        ? `The unexpected cost was ${latest.costMoreThanExpected}. That is usually where the next adjustment belongs — the plan is not wrong, it has an unpriced line item.`
        : `The most useful signal available this week is what cost more than you expected. It predicts the next adjustment better than what did not get done.`,
    recommendedAdjustment: {
      title: s.capacity.verdict === 'overloaded' ? 'End one commitment before next Monday' : 'Protect the one block that produced this week’s progress',
      detail:
        s.capacity.verdict === 'overloaded'
          ? 'Pick the lowest-value recurring commitment and end it, with the decision communicated. Not deferred — ended.'
          : 'Identify the block where progress actually happened and make it the least negotiable thing in your week.',
      leverage: s.capacity.verdict === 'overloaded' ? 'elimination' : 'focus',
    },
    nextThreeMoves: sample(MOVES[s.archetype], 3, s.seed + 11).map((m) => m.title),
    confidence: 0.72,
  };
}

export function makeMonthlyReview(ctx: CouncilContext): MonthlyReview {
  const s = deriveSignals(ctx);
  const stillRight = s.capacity.verdict !== 'overloaded' && s.energy > 4;

  return {
    comparison: `Compared with where you started, the outer picture has moved more than the inner one. ${
      s.divergentDomains.length > 0
        ? `${s.divergentDomains[0]?.label} still reads higher externally than it is experienced, which is the same divergence the plan set out to close.`
        : 'The gap between outer results and inner experience has narrowed, which is the more meaningful of the two movements.'
    } Capacity is ${s.capacity.verdict}, energy is around ${s.energy.toFixed(1)}/10.`,
    domainMovement: s.topDomains.slice(0, 5).map((d) => ({
      domainKey: d.key,
      direction: d.scores.momentum >= 6 ? ('up' as const) : d.scores.momentum >= 4 ? ('flat' as const) : ('down' as const),
      note:
        d.divergence >= 2
          ? `Performing externally, still costing more than it returns.`
          : d.gap >= 2.5
            ? `The gap between where this is and where you want it has not closed yet.`
            : `Roughly holding.`,
    })),
    stillTheRightGame: {
      verdict: stillRight ? 'continue' : s.energy <= 3.5 ? 'simplify' : 'adjust',
      reasoning: stillRight
        ? `The objective still matches what you said matters, and the method is producing movement. Continue — the case for changing the game would need evidence that the target is wrong, and there isn't any.`
        : s.energy <= 3.5
          ? `The objective is still right; the plan is too large for the capacity you actually have. Simplify to one bold result and one protected block, and let the other two wait a month.`
          : `The objective holds but the method is not producing movement. Adjust the strategy rather than the target — this is a method problem, not an ambition problem.`,
      confidence: 0.7,
    },
    recommendations: [
      {
        title: stillRight ? 'Keep the plan, tighten the protection' : 'Reduce to one bold result',
        detail: stillRight
          ? 'The plan is working. The thing most likely to break it is a good month producing an additional commitment.'
          : 'Three bold results at current capacity is the problem. Pick the one that would matter most and let the rest wait.',
      },
    ],
  };
}

/* ── Insight plan & blind spots ─────────────────────────────────────────────*/

export function makeInsightPlan(ctx: CouncilContext): InsightPlanDraft {
  const s = deriveSignals(ctx);
  const protectPhrase = listOf(s.protections.map((p) => p.label), 3) || 'the things you have said matter';

  const sections: Array<{ title: string; body: string; source: 'ai_inferred' | 'user_said'; confidence: number }> = [
    {
      title: 'Who I Am',
      body: `Someone moving from ${s.identityFrom ?? 'carrying more than they chose'} toward ${s.identityTo ?? identityTarget(s)}. The direction is consistent across everything you have told us; the pace is the open question.`,
      source: 'ai_inferred',
      confidence: 0.68,
    },
    {
      title: 'What Matters to Me',
      body: `${capitalise(listOf(s.topDomains.slice(0, 3).map((d) => d.label), 3) || 'career, health and family')} — and specifically ${protectPhrase}, which you named as things you will not trade.`,
      source: ctx.nonNegotiables.length > 0 ? 'user_said' : 'ai_inferred',
      confidence: ctx.nonNegotiables.length > 0 ? 0.95 : 0.6,
    },
    {
      title: 'What Gives Me Energy',
      body: `The domains reading highest on energy are ${listOf(
        [...s.topDomains].sort((a, b) => b.scores.energy - a.scores.energy).slice(0, 2).map((d) => d.label),
        2,
      ) || 'not yet clear'}. Work that involves deciding rather than absorbing appears to return energy rather than spend it.`,
      source: 'ai_inferred',
      confidence: 0.62,
    },
    {
      title: 'What Drains Me',
      body: `${capitalise(listOf(s.drainedDomains.slice(0, 2).map((d) => d.label), 2) || 'operational load')} — and, more specifically, work that is necessary, unattributable, and could be done by someone else.`,
      source: 'ai_inferred',
      confidence: 0.64,
    },
    {
      title: 'What I Naturally Do Well',
      body: ctx.strengths.filter((st) => st.kind === 'strength').length > 0
        ? `${listOf(ctx.strengths.filter((st) => st.kind === 'strength').map((st) => st.label), 3)}.`
        : 'Following through on what you commit to, and reading a situation before acting in it.',
      source: ctx.strengths.length > 0 ? 'user_said' : 'ai_inferred',
      confidence: ctx.strengths.length > 0 ? 0.9 : 0.55,
    },
    {
      title: 'What I Tend To Overdo',
      body: `Absorbing work that has no owner. It is a real strength past its useful range: it makes you dependable and it makes you the bottleneck.`,
      source: 'ai_inferred',
      confidence: 0.6,
    },
    {
      title: 'What I Avoid',
      body: `The conversation that would reduce the load. Possible pattern only — but the shape of what has stalled is consistent with it.`,
      source: 'ai_inferred',
      confidence: 0.55,
    },
    {
      title: 'My Current Reality',
      body: `Roughly ${s.capacity.committedHoursPerWeek} of ${s.capacity.availableHoursPerWeek} usable hours committed — ${s.capacity.verdict}. Energy around ${s.energy.toFixed(1)}/10.`,
      source: 'ai_inferred',
      confidence: 0.8,
    },
    {
      title: 'My Biggest Opportunity',
      body: opportunity(s),
      source: 'ai_inferred',
      confidence: 0.7,
    },
    {
      title: 'My Biggest Risk',
      body: `That the new plan is adopted alongside the old load rather than replacing part of it, and is therefore funded from ${protectPhrase}.`,
      source: 'ai_inferred',
      confidence: 0.74,
    },
    {
      title: 'My Identity Shift',
      body: `From ${s.identityFrom ?? 'someone who is relied on for everything'} to ${s.identityTo ?? identityTarget(s)}.`,
      source: 'ai_inferred',
      confidence: 0.65,
    },
    {
      title: 'What I Need To Stop',
      body: sample(STOP_ITEMS[s.archetype], 2, s.seed).map((i) => i.text).join('. ') + '.',
      source: 'ai_inferred',
      confidence: 0.7,
    },
    {
      title: 'What I Need To Start',
      body: `${(sample(MOVES[s.archetype], 2, s.seed + 2).map((m) => m.title).join('. '))}.`,
      source: 'ai_inferred',
      confidence: 0.7,
    },
    {
      title: 'What I Need To Protect',
      body: `${capitalise(protectPhrase)}. Booked, visible, and not the first thing cancelled.`,
      source: ctx.nonNegotiables.length > 0 ? 'user_said' : 'ai_inferred',
      confidence: 0.85,
    },
    {
      title: 'What I Need To Practise',
      body: `Declining without over-explaining. Holding an answer until you have checked capacity, rather than answering in the moment.`,
      source: 'ai_inferred',
      confidence: 0.6,
    },
    {
      title: 'What I Need To Learn',
      body: `How your work is actually evaluated at the level you are aiming at — which is usually different from how it is evaluated at your current level.`,
      source: 'ai_inferred',
      confidence: 0.58,
    },
    {
      title: 'What I Need To Delegate',
      body: `The recurring commitment with the highest time cost and the lowest strategic return. Completely, not partially.`,
      source: 'ai_inferred',
      confidence: 0.68,
    },
    {
      title: 'What I Need To Say No To',
      body: `Work that arrives urgent, is not yours, and would be absorbed rather than assigned.`,
      source: 'ai_inferred',
      confidence: 0.66,
    },
  ];

  return { sections };
}

export function makeBlindSpots(ctx: CouncilContext): BlindSpotDraft {
  const s = deriveSignals(ctx);
  const out: BlindSpotDraft['blindSpots'] = [];

  if (s.capacity.verdict === 'overloaded' || s.capacity.verdict === 'tight') {
    out.push({
      hypothesis: 'You may be treating a capacity problem as a motivation problem',
      detail: `Your load is at ${Math.round(s.capacity.load * 100)}% and the instinctive response to falling behind appears to be more effort. If that reading is right, the harder you work the worse the constraint gets. This is a hypothesis — correct it if it does not match your experience.`,
      confidence: 0.66,
      basedOn: ['Your committed hours against available hours', 'What you described as not moving'],
    });
  }

  if (s.divergentDomains.length > 0) {
    const d = s.divergentDomains[0];
    out.push({
      hypothesis: `Your ${d?.label.toLowerCase() ?? 'career'} may be succeeding at a cost you have not priced`,
      detail: `Outer results read ${d?.scores.outerResult.toFixed(1)} while the experience reads ${d?.scores.innerExperience.toFixed(1)}. That gap usually means the strategy is working and is being funded by something not on the balance sheet.`,
      confidence: 0.7,
      basedOn: ['The gap between outer result and inner experience in your life map'],
    });
  }

  if (s.goalTitle && /lead|senior|promot|role/i.test(s.goalTitle)) {
    out.push({
      hypothesis: 'You may be trying to solve a positioning problem through additional work',
      detail: `The goal is about what you are trusted with. Additional output is the most available response and often the least effective one, because the constraint is how the work is perceived rather than how much of it there is.`,
      confidence: 0.6,
      basedOn: ['How you described the goal', 'The kind of work currently filling your week'],
    });
  }

  if (s.protections.length > 0 && s.capacity.verdict !== 'headroom') {
    out.push({
      hypothesis: 'Your stated priorities and your calendar may not currently agree',
      detail: `You have named ${listOf(s.protections.map((p) => p.label), 2)} as protected. On current load, protected time that is not booked is the most likely source of any additional hours the plan needs.`,
      confidence: 0.64,
      basedOn: ['Your non-negotiables', 'Your current committed hours'],
    });
  }

  return { blindSpots: out.slice(0, 4) };
}

/* ── Adaptation & reset ─────────────────────────────────────────────────────*/

export function makeAdaptationPlan(ctx: CouncilContext): AdaptationPlan {
  const s = deriveSignals(ctx);
  const trigger = (ctx.ask.detail ?? ctx.ask.question) ?? 'A change in your circumstances';

  return {
    trigger: trim(trigger, 380),
    affected: ['goal', 'strategy', 'milestones', 'protocol'],
    recommendation: 'recalibrate',
    headline: 'Your current game was designed for your previous context.',
    reasoning: `The objective may still be right, but the plan was built against constraints that have changed. Recalibrating now is cheaper than discovering in six weeks that the milestones were set for a different situation. Specifically: the timeline assumptions, the available hours, and the people who were part of the plan all need re-checking. ${capitalise(ARCHETYPE_FRAMING[s.archetype])}.`,
    changes: [
      {
        area: 'goal',
        change: 'Re-confirm that the stated goal is still what you want in the new context.',
        why: 'A goal set under different constraints is often kept out of momentum rather than conviction.',
      },
      {
        area: 'milestones',
        change: 'Reset the 30/60/90 dates from today rather than from the original start.',
        why: 'Milestones anchored to a superseded start date quietly become failures rather than markers.',
      },
      {
        area: 'strategy',
        change: `Re-test the leverage assumptions — ${s.leverage.slice(0, 2).join(' and ')} may no longer be the available routes.`,
        why: 'Leverage depends on relationships and position, both of which change with context.',
      },
      {
        area: 'protocol',
        change: 'Rebuild the minimum mode around the new schedule before anything else.',
        why: 'A protocol built for the old week will fail in the first difficult week of the new one.',
      },
    ],
    confidence: 0.72,
  };
}

export function makeResetOptions(ctx: CouncilContext): ResetOptions {
  const s = deriveSignals(ctx);
  const what = ctx.ask.detail ?? 'something got in the way';

  return {
    acknowledgement: `That happens, and it is information rather than failure. ${capitalise(trim(what, 120))} — the plan should absorb that, not be broken by it.`,
    options: [
      {
        title: 'Drop to minimum mode for the rest of the week',
        detail:
          'Run the ten-minute version of each commitment. It keeps the thread intact without pretending the week is normal.',
        effort: 'low',
      },
      {
        title: 'Remove one thing from this week entirely',
        detail: `Pick the commitment with the least consequence and end it for the week. ${
          s.capacity.verdict === 'overloaded' ? 'At your current load this is the option that actually changes anything.' : ''
        }`.trim(),
        effort: 'low',
      },
      {
        title: 'Have the conversation that would reduce the load',
        detail:
          'The higher-cost, higher-return option. If the same thing derails the week repeatedly, the conversation is the actual work.',
        effort: 'medium',
      },
    ],
  };
}

/* ── Suggestions ────────────────────────────────────────────────────────────*/

export function makeSuggestions(ctx: CouncilContext): SuggestionSet {
  const s = deriveSignals(ctx);
  const field = (ctx.ask.payload.field as string) ?? 'general';

  const byField: Record<string, Array<{ text: string; because: string }>> = {
    non_negotiables: [
      { text: 'Sleep — at least seven hours on weeknights', because: `Energy reads around ${s.energy.toFixed(1)}/10, so this is currently the binding input rather than a preference.` },
      { text: 'Evenings with family, devices away', because: 'You described presence rather than time as what is missing, and presence needs a boundary rather than a slot.' },
      { text: 'One unmeasured hour a week', because: 'Every hour in your week currently has a purpose attached, which is itself part of the strain.' },
    ],
    stop_list: STOP_ITEMS[s.archetype].map((i) => ({ text: i.text, because: i.reason })),
    rituals: [
      { text: 'Protect thirty minutes of movement before the workday', because: `Your energy is highest before the day starts and your current game needs sustained cognitive performance, so a short movement block before work fits your actual pattern.` },
      { text: 'Ten-minute written close to the workday', because: 'Work is currently following you home; a defined close is what ends the day rather than deferring it.' },
    ],
    matters: [
      { text: 'Career growth', because: 'Your stated goal sits here.' },
      { text: 'Health', because: 'Energy is the input most likely to constrain everything else you named.' },
      { text: 'Family', because: 'You referenced commitments outside work that the plan has to respect.' },
    ],
    general: [
      { text: `Focus on ${s.leverage[0] ?? 'delegation'} this quarter`, because: `Given ${ARCHETYPE_FRAMING[s.archetype]}, this is the lever with the best return on your actual constraints.` },
    ],
  };

  return { suggestions: (byField[field] ?? byField.general ?? []).slice(0, 5) };
}

/* ── helpers ────────────────────────────────────────────────────────────────*/

function clamp(n: number): number {
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

function trim(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function listOf(items: string[], max: number): string {
  const shown = items.slice(0, max).map((i) => i.toLowerCase());
  if (shown.length === 0) return '';
  if (shown.length === 1) return shown[0] as string;
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

function identityTarget(s: Signals): string {
  return s.archetype === 'depleted'
    ? 'someone who operates sustainably and still delivers'
    : 'someone who creates results through leverage rather than volume';
}

function opportunity(s: Signals): string {
  return `Not doing more. ${capitalise(s.leverage[0] ?? 'delegation')} — becoming less operationally necessary, so the work that actually advances your goal has somewhere to sit.`;
}

function dayOffset(today: string): number {
  const parsed = Date.parse(today);
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 86_400_000);
}

function evidenceFrom(ctx: CouncilContext, count: number): AgentOutput['evidence'] {
  const out: AgentOutput['evidence'] = [];

  if (ctx.goal) {
    out.push({ kind: 'goal', ref: ctx.goal.title, note: 'Your stated goal' });
  }
  for (const n of ctx.nonNegotiables.slice(0, 2)) {
    out.push({ kind: 'non_negotiable', ref: n.label, note: `Named as ${n.hardness}` });
  }
  for (const c of ctx.constraints.slice(0, 2)) {
    out.push({ kind: 'constraint', ref: c.label, note: `${c.category}, ${c.severity}` });
  }
  const scored = ctx.domains.filter((d) => d.scores !== null).slice(0, 2);
  for (const d of scored) {
    out.push({
      kind: 'life_score',
      ref: d.key,
      note: `outer ${d.scores?.outerResult.toFixed(1)} / inner ${d.scores?.innerExperience.toFixed(1)}`,
    });
  }
  for (const r of ctx.recentReflections.slice(0, 1)) {
    out.push({ kind: 'reflection', ref: r.periodEnd, note: `${r.kind} reflection` });
  }

  return out.slice(0, Math.max(1, count));
}
