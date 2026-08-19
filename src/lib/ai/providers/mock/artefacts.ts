import type { CouncilContext } from '@/lib/personalization/context-types';
import type {
  GameDraft,
  LifeMapEstimate,
  PersonalSnapshot,
  PlayerOptions,
  ProtocolDraft,
  SacrificeAssessment,
  WholeGoalDraft,
} from '@/schemas/artefacts';
import {
  ARCHETYPE_FRAMING,
  deriveSignals,
  pick,
  sample,
  type Signals,
} from './signals';
import {
  ATTITUDES,
  GAME_NAME_PARTS,
  MANTRAS,
  MOVES,
  PLAYER_NAMES,
  RITUAL_TEMPLATES,
  ROUTINE_TEMPLATES,
  STOP_ITEMS,
} from './library';

const clamp10 = (n: number) => Math.max(0, Math.min(10, Math.round(n * 10) / 10));

/* ── Personal Snapshot ──────────────────────────────────────────────────────*/

export function makeSnapshot(ctx: CouncilContext): PersonalSnapshot {
  const s = deriveSignals(ctx);
  const answers = ctx.ask.payload as {
    matters?: string[];
    twelveMonths?: string;
    notSacrificed?: string[];
  };

  const matters = answers.matters ?? s.topDomains.slice(0, 3).map((d) => d.label);
  const protect = answers.notSacrificed ?? s.protections.map((p) => p.label);
  const ambition = answers.twelveMonths ?? s.goalTitle ?? 'meaningful progress in your work';

  return {
    headline: `You are aiming at ${trim(ambition, 90)} while refusing to trade away ${listOf(protect, 2) || 'the things that matter most'}.`,
    likelyPriorities: (matters.length > 0 ? matters : ['Career', 'Health', 'Family'])
      .slice(0, 4)
      .map((label, i) => ({
        domainKey: domainKeyFor(label, ctx),
        why: `You named this first when asked what matters right now, which usually means it is where attention is already going.${i === 0 ? ' It reads as the lead priority.' : ''}`,
        confidence: i === 0 ? 0.82 : 0.7,
      })),
    likelyGoal: {
      title: toGoalTitle(ambition),
      horizonMonths: 12,
      why: `Drawn from how you described the next twelve months. It is an interpretation, not a quote — correct it if the emphasis is wrong.`,
      confidence: 0.74,
    },
    likelyConstraints: inferConstraints(ctx, s),
    possibleTension: {
      statement: tensionFor(s, protect),
      confidence: 0.68,
    },
    possibleOpportunity: {
      statement: opportunityFor(s),
      confidence: 0.71,
    },
    identityShift: {
      from: s.identityFrom ?? 'someone carrying more than they chose',
      to: s.identityTo ?? identityTargetFor(s),
      confidence: 0.62,
    },
    nonNegotiables: (protect.length > 0 ? protect : ['Sleep', 'Family time'])
      .slice(0, 5)
      .map((label) => ({
        label,
        hardness: /family|health|sleep|child/i.test(label) ? ('firm' as const) : ('strong' as const),
        confidence: 0.8,
      })),
  };
}

/* ── Life Map ───────────────────────────────────────────────────────────────*/

/**
 * Estimates rather than asks. The user confirms each with
 * [Lower][About right][Higher] — the minimal-input law applied to data entry.
 */
export function makeLifeMap(ctx: CouncilContext): LifeMapEstimate {
  const s = deriveSignals(ctx);
  const answers = ctx.ask.payload as { matters?: string[]; notSacrificed?: string[] };
  const named = new Set(
    [...(answers.matters ?? []), ...(answers.notSacrificed ?? [])].map((v) => v.toLowerCase()),
  );

  const scores = ctx.domains.map((domain, index) => {
    const existing = domain.scores;
    if (existing) {
      return {
        domainKey: domain.key,
        ...existing,
        basis: 'Carried forward from your confirmed scores.',
        confidence: 0.9,
      };
    }

    const isNamed = named.has(domain.label.toLowerCase()) || named.has(domain.key);
    const isGoalDomain = domain.key === s.goalDomainKey;
    const isProtected = s.protections.some(
      (p) => p.domainKey === domain.key || p.label.toLowerCase().includes(domain.key),
    );
    const base = pick([4.5, 5, 5.5, 6], s.seed, index);

    // Career-shaped domains carrying the ambition read high outside and lower inside;
    // protected-but-squeezed domains read the opposite. This is the divergence the
    // product exists to surface.
    const outer = clamp10(isGoalDomain ? base + 2.5 : isProtected ? base - 0.5 : base);
    const inner = clamp10(isGoalDomain ? base - 0.5 : isProtected ? base - 1.5 : base - 0.5);

    return {
      domainKey: domain.key,
      currentExperience: clamp10((outer + inner) / 2),
      desiredExperience: clamp10(isNamed || isGoalDomain ? 9 : 7.5),
      outerResult: outer,
      innerExperience: inner,
      importance: clamp10(isNamed ? 9 : isGoalDomain ? 8.5 : isProtected ? 8 : 5.5),
      energy: clamp10(isProtected ? base - 1 : base),
      satisfaction: clamp10(inner),
      risk: clamp10(isProtected ? 7 : isGoalDomain ? 5 : 3.5),
      momentum: clamp10(isGoalDomain ? 6.5 : base - 1),
      basis: isNamed
        ? 'You named this directly, so importance is set high and the desired level ambitious.'
        : isGoalDomain
          ? 'This is the domain your stated goal sits in, so outer results are likely ahead of how it feels.'
          : isProtected
            ? 'You said this must not be sacrificed, which usually means it is already under pressure.'
            : 'Estimated from the overall picture. Low confidence — worth correcting.',
      confidence: isNamed || isGoalDomain ? 0.72 : 0.5,
    };
  });

  const divergences = scores
    .filter((sc) => sc.outerResult - sc.innerExperience >= 2)
    .map((sc) => {
      const label = ctx.domains.find((d) => d.key === sc.domainKey)?.label ?? sc.domainKey;
      return {
        domainKey: sc.domainKey,
        statement: `${label} is performing better externally (${sc.outerResult.toFixed(1)}) than it is being experienced (${sc.innerExperience.toFixed(1)}). That pattern usually means the current strategy is producing results at a cost that has not yet been named.`,
        gap: Math.round((sc.outerResult - sc.innerExperience) * 10) / 10,
        confidence: 0.7,
      };
    });

  return { scores, divergences };
}

/* ── Whole Goal ─────────────────────────────────────────────────────────────*/

export function makeWholeGoal(ctx: CouncilContext): WholeGoalDraft {
  const s = deriveSignals(ctx);
  const raw = (ctx.ask.payload.raw as string) ?? ctx.goal?.rawInput ?? ctx.goal?.title ?? '';
  const title = toGoalTitle(raw || 'Move meaningfully forward in the next year');
  const protectPhrase = listOf(s.protections.map((p) => p.label), 2);

  return {
    title,
    result: `${title}. Concretely: the change is visible to other people, not only felt by you — a different remit, a different set of decisions you are trusted with, or a different number, depending on which of those you meant.`,
    experience: `Getting there feeling ${experienceWordsFor(s)} rather than depleted. This matters as much as the outcome: the same result reached by grinding is a different result.`,
    impact: impactFor(s),
    identity: `Becoming ${s.identityTo ?? identityTargetFor(s)} — someone for whom this level of work is normal operating rather than sustained effort.`,
    horizonMonths: ctx.goal?.horizonMonths ?? 12,
    domainKey: s.goalDomainKey ?? domainKeyFor(raw, ctx),
    clarifyingQuestion:
      protectPhrase.length > 0
        ? null
        : 'What must not be sacrificed while you pursue this? That single answer shapes the whole strategy.',
    confidence: 0.75,
  };
}

/* ── Player ─────────────────────────────────────────────────────────────────*/

export function makePlayerOptions(ctx: CouncilContext): PlayerOptions {
  const s = deriveSignals(ctx);
  const names = PLAYER_NAMES[s.archetype];
  const mantras = MANTRAS[s.archetype];
  const attitudes = ATTITUDES[s.archetype];

  const options = names.slice(0, 3).map((name, i) => ({
    name,
    identity: `Someone who ${identityLineFor(s, i)}`,
    intention: intentionFor(s, i),
    mantra: pick(mantras, s.seed, i) as string,
    attitude: pick(attitudes, s.seed, i) as string[],
    actions: playerActionsFor(s, i),
    agreements: agreementsFor(s),
    boundaries: boundariesFor(s),
    strengths:
      ctx.strengths.filter((st) => st.kind === 'strength').map((st) => st.label).slice(0, 4).length >= 2
        ? ctx.strengths.filter((st) => st.kind === 'strength').map((st) => st.label).slice(0, 4)
        : ['Follows through', 'Reads situations well'],
    watchOuts: watchOutsFor(s, ctx),
    whyThisFits: `This fits because ${ARCHETYPE_FRAMING[s.archetype]}. ${
      s.protections.length > 0
        ? `It is built around protecting ${listOf(s.protections.map((p) => p.label), 2)} rather than treating that as a constraint to work around.`
        : 'It is built to make progress without requiring more of your week.'
    }`,
    confidence: 0.72,
  }));

  return { options };
}

/* ── Game ───────────────────────────────────────────────────────────────────*/

export function makeGame(ctx: CouncilContext): GameDraft {
  const s = deriveSignals(ctx);
  const nameOptions = sample(GAME_NAME_PARTS[s.archetype], 4, s.seed);
  const moves = sample(MOVES[s.archetype], 4, s.seed);
  const stops = sample(STOP_ITEMS[s.archetype], 4, s.seed);
  const goal = s.goalTitle ?? 'the next meaningful step in your work';
  const protectLabels = s.protections.map((p) => p.label);

  return {
    nameOptions,
    name: nameOptions[0] ?? 'The Leverage Quarter',
    purpose: `To make real progress toward ${trim(goal, 80)} in ninety days without spending the things you said you will not spend. ${capitalise(ARCHETYPE_FRAMING[s.archetype])}.`,
    winningDefinition: `Winning means ${winningFor(s)} — and arriving there with ${listOf(protectLabels, 2) || 'your health and relationships'} intact rather than recovered afterwards.`,
    nonWinningDefinition: `Winning does not require ${nonWinningFor(s)}. If the plan starts to need any of those, the plan is wrong — not the ambition.`,
    strategicObjective: `Change how your work creates results: ${objectiveFor(s)}.`,
    boldResults: [
      {
        title: boldTitle(s, 30),
        dayMarker: 30,
        successDefinition: `By day 30, ${boldSuccess(s, 30)}`,
        evidence: [`Something written down that did not exist before`, `One conversation held that was previously postponed`],
        leadingIndicators: ['Hours spent on the highest-leverage move each week', 'Number of commitments ended'],
        dependencies: ['Your own decision — nothing external gates this one'],
        risks: ['The week absorbs it because nothing was removed first'],
        confidence: 0.78,
        owner: 'me',
      },
      {
        title: boldTitle(s, 60),
        dayMarker: 60,
        successDefinition: `By day 60, ${boldSuccess(s, 60)}`,
        evidence: ['A result other people can point to', 'A measurable change in one number you care about'],
        leadingIndicators: ['Consistency of the protected blocks', 'Whether the day-30 change held'],
        dependencies: ['The day-30 result actually holding'],
        risks: ['Reverting under pressure in a difficult week'],
        confidence: 0.68,
        owner: 'me',
      },
      {
        title: boldTitle(s, 90),
        dayMarker: 90,
        successDefinition: `By day 90, ${boldSuccess(s, 90)}`,
        evidence: ['Recognition or a decision that would not have happened in month one', 'Your own honest answer that it did not cost what it used to'],
        leadingIndicators: ['Trend in how the work is experienced, not only how it performs'],
        dependencies: ['Days 30 and 60 both holding'],
        risks: ['Success at day 60 creating pressure to add more work'],
        confidence: 0.6,
        owner: 'me',
      },
    ],
    strategicMoves: moves.map((m) => ({
      title: m.title,
      detail: m.detail,
      leverageCategory: m.leverage,
      expectedImpact: m.impact,
      effort: m.effort,
    })),
    stopList: stops,
    protectList:
      protectLabels.length > 0
        ? protectLabels.slice(0, 5).map((label) => ({
            text: label,
            reason: `You named this as something that must not be sacrificed. It is a constraint on the strategy, not a nice-to-have — the plan is built around it.`,
          }))
        : [
            {
              text: 'Sleep',
              reason:
                'Nothing in this plan works if recovery is the funding source. It is the first thing that gets quietly spent, so it is named explicitly.',
            },
          ],
    risks: [
      {
        title: 'The plan gets added to the existing load rather than replacing part of it',
        detail:
          'This is the most common failure mode: the new moves are adopted, nothing is stopped, and the whole thing is funded from protected time.',
        severity: 'high',
        likelihood: 'high',
        mitigation: 'Complete the stop list in week one, before any new move begins.',
      },
      {
        title: 'An early result creates pressure to expand scope',
        detail:
          'Progress at day 30 or 60 tends to invite additional commitments, which is how a working plan becomes an overloaded one.',
        severity: 'medium',
        likelihood: 'medium',
        mitigation: 'Treat the three bold results as a ceiling for the quarter, not a floor.',
      },
    ],
    squad: squadFor(s),
    whyThisPlan: whyThisPlan(s, ctx),
    intentionalOmissions: omissionsFor(s),
    confidence: 0.74,
  };
}

/* ── Protocol ───────────────────────────────────────────────────────────────*/

export function makeProtocol(ctx: CouncilContext): ProtocolDraft {
  const s = deriveSignals(ctx);
  const focusDomains = [...new Set([...s.protections.map((p) => p.domainKey), s.goalDomainKey])]
    .filter((k): k is string => typeof k === 'string')
    .slice(0, 3);
  const domainKeys = focusDomains.length >= 3 ? focusDomains : ['health', 'career', 'family'];

  const items = domainKeys.map((key) => protocolItemFor(key, s));
  const rituals = sample(RITUAL_TEMPLATES, 3, s.seed).map((r) => ({
    category: r.category,
    name: r.name,
    detail: r.detail,
    cadence: r.cadence,
    whyThisFits: `Chosen because ${r.fits}.`,
  }));
  const routines = sample(ROUTINE_TEMPLATES, 3, s.seed + 7).map((r) => ({
    slot: r.slot,
    name: r.name,
    steps: r.steps,
    durationMinutes: r.minutes,
  }));

  return { items, rituals, routines, confidence: 0.73 };
}

function protocolItemFor(key: string, s: Signals) {
  const table: Record<string, { label: string; min: string; std: string; exp: string }> = {
    health: {
      label: 'Movement',
      min: '10-minute walk',
      std: '30-minute session',
      exp: '60-minute training block',
    },
    career: {
      label: 'Strategic work',
      min: 'One 20-minute block on the highest-leverage move',
      std: 'One protected 90-minute block before the inbox',
      exp: 'Two protected blocks plus one visibility action',
    },
    family: {
      label: 'Presence',
      min: 'One undivided conversation',
      std: 'Devices away for the shared hour',
      exp: 'A protected half-day with no work surfaces open',
    },
    self: {
      label: 'Recovery',
      min: 'Ten minutes of nothing required',
      std: 'One unmeasured hour',
      exp: 'A half-day with no output expectation',
    },
    finance: {
      label: 'Financial hygiene',
      min: 'Check the one number',
      std: 'Weekly 15-minute review',
      exp: 'Monthly review plus one structural change',
    },
    relationships: {
      label: 'Connection',
      min: 'One message that is not logistics',
      std: 'One real conversation',
      exp: 'One planned time together',
    },
    growth: {
      label: 'Learning',
      min: 'Fifteen minutes of reading',
      std: 'One focused hour',
      exp: 'A deliberate practice session with feedback',
    },
    joy: {
      label: 'Something unproductive',
      min: 'Ten minutes',
      std: 'One hour',
      exp: 'A half-day',
    },
    purpose: {
      label: 'Chosen work',
      min: 'Fifteen minutes on the work you would do unpaid',
      std: 'One protected block',
      exp: 'A sustained session with visible output',
    },
    impact: {
      label: 'Contribution',
      min: 'One useful message to someone else',
      std: 'One act of mentoring or help',
      exp: 'A deliberate contribution beyond your own remit',
    },
  };

  const entry = table[key] ?? table.self;
  const safe = entry ?? { label: 'Recovery', min: 'Ten minutes', std: 'One hour', exp: 'A half-day' };
  return {
    domainKey: key,
    label: safe.label,
    minimum: safe.min,
    standard: safe.std,
    expansion: s.capacity.verdict === 'overloaded' ? safe.std : safe.exp,
  };
}

/* ── Sacrifice Radar ────────────────────────────────────────────────────────*/

export function makeSacrifice(ctx: CouncilContext): SacrificeAssessment {
  const s = deriveSignals(ctx);
  const tight = s.capacity.verdict === 'tight' || s.capacity.verdict === 'overloaded';
  const depleted = s.archetype === 'depleted';

  const scores = ctx.domains.map((domain) => {
    const isGoal = domain.key === s.goalDomainKey;
    const isProtected = s.protections.some(
      (p) => p.domainKey === domain.key || p.label.toLowerCase().includes(domain.key),
    );

    // A plan that advances one domain is, by arithmetic, withdrawing attention from
    // another. Naming which is the entire point of the radar.
    //
    // Protected domains are never the withdrawal. The strategy leads with leverage —
    // delegation, elimination, renegotiation — precisely so the cost lands on breadth
    // rather than on the things the person said they will not spend. A plan that
    // funded itself from a firm non-negotiable would be a plan we should not have
    // proposed, and conflict detection would block it.
    let delta = 0;
    if (isProtected) {
      delta = depleted ? 2 : 1;
    } else if (isGoal) {
      delta = 3;
    } else if (tight) {
      delta = -1;
    }

    return {
      domainKey: domain.key,
      delta,
      why: isProtected
        ? depleted
          ? 'You named this as protected, and rebuilding it is the first move of the plan rather than a cost of it.'
          : 'You named this as protected. The plan is built around it — capacity comes from elsewhere.'
        : isGoal
          ? 'This is where the plan concentrates effort, so it should move furthest.'
          : delta < 0
            ? 'Attention has to come from somewhere. On current capacity this is where breadth is traded for focus.'
            : 'Roughly unchanged by this plan.',
    };
  });

  const alternatives = sample(MOVES[s.archetype], 2, s.seed + 3)
    .filter((m) => m.leverage !== 'visibility' || !tight)
    .map((m) => ({
      title: m.title,
      detail: m.detail,
      leverage: m.leverage,
      preservesAmbition: true as const,
    }));

  return {
    scores,
    alternatives:
      alternatives.length > 0
        ? alternatives
        : [
            {
              title: 'Reach the same outcome by ending something first',
              detail:
                'Keep the target. Fund it by stopping the lowest-value stream rather than by borrowing from protected time.',
              leverage: 'elimination',
              preservesAmbition: true as const,
            },
          ],
    confidence: 0.7,
  };
}

/* ── shared helpers ─────────────────────────────────────────────────────────*/

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

function toGoalTitle(raw: string): string {
  const clean = raw.trim().replace(/\s+/g, ' ').replace(/^i (want|would like) to\s*/i, '');
  const titled = capitalise(clean || 'Move meaningfully forward');
  return trim(titled.replace(/[.!?]+$/, ''), 190);
}

function domainKeyFor(text: string, ctx: CouncilContext): string {
  const lower = text.toLowerCase();
  const match = ctx.domains.find(
    (d) => lower.includes(d.key) || lower.includes(d.label.toLowerCase()),
  );
  if (match) return match.key;
  if (/lead|promot|role|work|job|career|manage/.test(lower)) return 'career';
  if (/money|financ|income|wealth|debt|save/.test(lower)) return 'finance';
  if (/health|fit|sleep|weight|energy/.test(lower)) return 'health';
  if (/family|child|partner|kid/.test(lower)) return 'family';
  return ctx.domains[0]?.key ?? 'career';
}

function inferConstraints(ctx: CouncilContext, s: Signals) {
  if (ctx.constraints.length > 0) {
    return ctx.constraints.slice(0, 4).map((c) => ({
      label: c.label,
      category: c.category as 'time' | 'energy' | 'financial' | 'responsibility' | 'environment' | 'skill',
      severity: c.severity as 'low' | 'medium' | 'high' | 'critical',
      confidence: 0.8,
    }));
  }

  const out: Array<{
    label: string;
    category: 'time' | 'energy' | 'financial' | 'responsibility' | 'environment' | 'skill';
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  }> = [];

  if (s.capacity.verdict === 'tight' || s.capacity.verdict === 'overloaded') {
    out.push({
      label: 'Very little uncommitted time in a normal week',
      category: 'time',
      severity: 'high',
      confidence: 0.7,
    });
  }
  if (s.energy <= 4.5) {
    out.push({
      label: 'Energy is lower than the plan would need',
      category: 'energy',
      severity: 'high',
      confidence: 0.65,
    });
  }
  if (s.hasFamilyProtection) {
    out.push({
      label: 'Significant responsibilities outside work',
      category: 'responsibility',
      severity: 'medium',
      confidence: 0.72,
    });
  }
  return out.slice(0, 4);
}

function tensionFor(s: Signals, protect: string[]): string {
  const first = protect[0]?.toLowerCase() ?? 'the things you said matter';
  if (s.archetype === 'depleted') {
    return `You are aiming at something that needs sustained energy while energy is currently the scarcest input. That is not a motivation problem — it reads as a capacity problem, and the two need different treatment.`;
  }
  if (s.archetype === 'hollow_winner') {
    return `Your external results are strong and your experience of producing them is not. Working harder is the one response that would make that worse.`;
  }
  return `Your ambition needs more attention than your week currently has spare, and you have said ${first} cannot be the source. Something in the method has to change, not the target.`;
}

function opportunityFor(s: Signals): string {
  const lever = s.leverage[0] ?? 'delegation';
  return `Your biggest opportunity this quarter is probably not doing more. It is ${lever} — becoming less operationally necessary so the work that actually advances your goal has somewhere to sit.`;
}

function identityTargetFor(s: Signals): string {
  const map: Record<Signals['archetype'], string> = {
    constrained_ambitious: 'someone who creates results through leverage rather than volume',
    depleted: 'someone who operates sustainably and still delivers',
    high_capacity_accelerator: 'someone whose contribution is visible at the level above',
    identity_shifter: 'someone credible in the new direction, not a newcomer to it',
    hollow_winner: 'someone who chooses the work, not only the outcome',
    provider_optimiser: 'someone who builds security without going absent',
  };
  return map[s.archetype];
}

function experienceWordsFor(s: Signals): string {
  const map: Record<Signals['archetype'], string> = {
    constrained_ambitious: 'clear, in control of your week, and present when you are not working',
    depleted: 'steadier than you do now, with energy left at the end of a normal day',
    high_capacity_accelerator: 'stretched in the way you chose, not scattered',
    identity_shifter: 'increasingly confident that you belong in this work',
    hollow_winner: 'connected to why the work matters rather than only to whether it landed',
    provider_optimiser: 'calm about money and present with the people it is for',
  };
  return map[s.archetype];
}

function impactFor(s: Signals): string {
  if (s.hasFamilyProtection) {
    return 'The people closest to you experience you as present rather than as someone perpetually recovering from work. At work, the people around you get clearer decisions and less bottlenecking through you.';
  }
  return 'The people around you get clearer decisions, and the work you do becomes something others can build on rather than something only you can carry.';
}

function identityLineFor(s: Signals, i: number): string {
  const lines: Record<Signals['archetype'], string[]> = {
    constrained_ambitious: [
      'creates progress by removing friction rather than by adding hours, and holds the line on what they said they would protect.',
      'stays calm under load because they have decided in advance what they will not do.',
      'builds systems so their absence stops being a risk.',
    ],
    depleted: [
      'rebuilds capacity before adding load, and treats a minimum day as a real day.',
      'is honest about what is sustainable and delivers anyway.',
      'chooses the smallest change that holds rather than the largest that impresses.',
    ],
    high_capacity_accelerator: [
      'does one consequential thing visibly rather than five things quietly.',
      'asks directly for the work they want and then delivers it.',
      'builds depth where it counts and lets the rest wait.',
    ],
    identity_shifter: [
      'earns credibility with evidence rather than with intent.',
      'treats their history as an advantage rather than a gap to explain.',
      'sequences the transition so courage is needed once, not daily.',
    ],
    hollow_winner: [
      'measures the cost of a result as part of the result.',
      'is selective about which wins they compete for.',
      'protects the part of the work that makes the rest worth doing.',
    ],
    provider_optimiser: [
      'builds financial security through systems rather than through absence.',
      'is present now and still building for later.',
      'automates the decisions so discipline is not the bottleneck.',
    ],
  };
  const set = lines[s.archetype];
  return (set[i % set.length] ?? set[0]) as string;
}

function intentionFor(s: Signals, i: number): string {
  const options = [
    'Create meaningful progress without unnecessary force.',
    'Move the one thing that matters, and protect what I said I would.',
    'Do less, better, visibly.',
  ];
  return (options[(s.seed + i) % options.length] ?? options[0]) as string;
}

function playerActionsFor(s: Signals, i: number): string[] {
  const base = MOVES[s.archetype].map((m) => m.title.replace(/^([A-Z])/, (c) => c.toUpperCase()));
  const chosen = sample(base, 4, s.seed + i);
  return chosen.length >= 3 ? chosen : ['Prioritise', 'Delegate', 'Communicate', 'Protect recovery'];
}

function agreementsFor(s: Signals): string[] {
  const out = [
    'I do not confuse activity with impact.',
    'I decide what to stop before I decide what to add.',
  ];
  if (s.hasHealthProtection || s.archetype === 'depleted') {
    out.push('I do not fund work with sleep.');
  }
  if (s.hasFamilyProtection) {
    out.push('I keep the commitments I have made at home as firmly as the ones I have made at work.');
  }
  out.push('I choose leverage over volume.');
  return out.slice(0, 6);
}

function boundariesFor(s: Signals): string[] {
  const out: string[] = ['I do not answer yes in the moment; I answer after I have checked capacity.'];
  if (s.hasFamilyProtection) out.push('Evenings and weekends are not available by default.');
  if (s.hasHealthProtection) out.push('The recovery block is not the first thing I cancel.');
  if (out.length < 2) out.push('I do not take on work that has no owner just because it is in front of me.');
  return out.slice(0, 5);
}

function watchOutsFor(s: Signals, ctx: CouncilContext): string[] {
  const overdone = ctx.strengths.filter((st) => st.kind === 'overdone').map((st) => st.label);
  if (overdone.length > 0) return overdone.slice(0, 4);

  const map: Record<Signals['archetype'], string[]> = {
    constrained_ambitious: [
      'Taking on work quietly rather than declining it visibly',
      'Treating a full calendar as evidence of contribution',
    ],
    depleted: [
      'Mistaking a good week for a recovered baseline',
      'Adding load back the moment energy returns',
    ],
    high_capacity_accelerator: [
      'Starting a fourth thing before the first is finished',
      'Confusing motion with progress',
    ],
    identity_shifter: [
      'Preparing instead of producing',
      'Apologising for your background rather than using it',
    ],
    hollow_winner: [
      'Reading strong external numbers as proof the strategy is fine',
      'Delegating the enjoyable work first',
    ],
    provider_optimiser: [
      'Trading presence for marginal income without noticing the rate',
      'Optimising several financial goals at once',
    ],
  };
  return map[s.archetype];
}

function winningFor(s: Signals): string {
  const map: Record<Signals['archetype'], string> = {
    constrained_ambitious:
      'visible progress on the goal, with at least two recurring commitments permanently off your plate',
    depleted: 'a sustainable baseline restored and one real piece of progress made from it',
    high_capacity_accelerator:
      'one consequential piece of work delivered and attributed to you',
    identity_shifter: 'concrete public evidence that you can do the new work',
    hollow_winner: 'the same standard of results, produced in a way you would choose again',
    provider_optimiser: 'measurable financial progress with no reduction in presence at home',
  };
  return map[s.archetype];
}

function nonWinningFor(s: Signals): string {
  const parts: string[] = [];
  if (s.hasFamilyProtection) parts.push('working evenings or weekends');
  if (s.hasHealthProtection || s.archetype === 'depleted') parts.push('cutting sleep or recovery');
  parts.push('taking on a second major initiative');
  parts.push('being available at every hour');
  return listOf(parts, 3);
}

function objectiveFor(s: Signals): string {
  const map: Record<Signals['archetype'], string> = {
    constrained_ambitious:
      'reduce how operationally necessary you are, so strategic work has somewhere to sit',
    depleted: 'restore capacity first, then convert it into one clear result',
    high_capacity_accelerator: 'concentrate effort into one visible, attributable outcome',
    identity_shifter: 'convert intent into evidence a stranger could evaluate',
    hollow_winner: 'change the conditions of the work rather than its volume',
    provider_optimiser: 'move financial progress from effort-dependent to system-dependent',
  };
  return map[s.archetype];
}

function boldTitle(s: Signals, day: 30 | 60 | 90): string {
  const map: Record<Signals['archetype'], Record<30 | 60 | 90, string>> = {
    constrained_ambitious: {
      30: 'Capacity recovered and repositioned',
      60: 'Demonstrable impact from the freed capacity',
      90: 'Recognised for strategic contribution, not availability',
    },
    depleted: {
      30: 'Load reduced and a minimum that holds',
      60: 'A stable week, twice in a row',
      90: 'One real result produced from a sustainable base',
    },
    high_capacity_accelerator: {
      30: 'The consequential work secured',
      60: 'Measurable progress others can see',
      90: 'Attributed delivery and an advocate in the room',
    },
    identity_shifter: {
      30: 'First public artefact in the new direction',
      60: 'Five conversations that corrected the plan',
      90: 'Credible enough to be considered, not just curious',
    },
    hollow_winner: {
      30: 'The work you did not choose, ended',
      60: 'Selection rights renegotiated',
      90: 'Same results, materially different cost',
    },
    provider_optimiser: {
      30: 'The financial system automated',
      60: 'One structural change to income or cost',
      90: 'Visible progress with presence intact',
    },
  };
  return map[s.archetype][day];
}

function boldSuccess(s: Signals, day: 30 | 60 | 90): string {
  if (day === 30) {
    return `at least two recurring commitments have been ended or handed over completely, and the time they occupied is booked for the work that actually advances ${trim(s.goalTitle ?? 'the goal', 60)}.`;
  }
  if (day === 60) {
    return 'there is a result someone else can point to, produced from the capacity created in month one rather than from additional hours.';
  }
  return `the change is durable: it survived at least one difficult week, ${
    s.protections.length > 0
      ? `${listOf(s.protections.map((p) => p.label), 2)} were not spent to get here`
      : 'nothing protected was spent to get here'
  }, and you would run the same plan again.`;
}

function squadFor(s: Signals) {
  const base = [
    {
      role: 'Someone who can take one responsibility off you',
      canHelpWith: 'Absorbing a recurring commitment permanently, not temporarily',
      askDraft:
        'I am reshaping what I own this quarter. Would you take this on permanently? I will hand it over properly rather than leaving it half with me.',
    },
    {
      role: 'Someone senior who can advocate for you',
      canHelpWith: 'Arguing for you in rooms you are not in',
      askDraft:
        'I am aiming at something specific over the next ninety days. Can I tell you what it is, so that if it comes up you know what I am going for?',
    },
  ];
  if (s.hasFamilyProtection) {
    base.push({
      role: 'The person most affected at home',
      canHelpWith: 'Agreeing what the next ninety days actually look like, in advance',
      askDraft:
        'Here is what I am trying to do this quarter and what I am specifically not going to trade for it. Does that match what you are seeing?',
    });
  }
  return base.slice(0, 3);
}

function whyThisPlan(s: Signals, ctx: CouncilContext): string {
  const protectPhrase = listOf(s.protections.map((p) => p.label), 3);
  return [
    `This plan is built from what you have told us, not from a template.`,
    `We prioritised ${s.leverage.slice(0, 2).join(' and ')} because ${ARCHETYPE_FRAMING[s.archetype]}.`,
    protectPhrase
      ? `We treated ${protectPhrase} as fixed. That is why the strategy changes how the work happens rather than how much of it there is.`
      : `We kept the ambition and constrained the method, because there is no version of this plan worth having that is funded by your health.`,
    ctx.capacity.verdict === 'overloaded' || ctx.capacity.verdict === 'tight'
      ? `Your current load is ${ctx.capacity.verdict}, so we deliberately avoided adding a second major initiative — the first thirty days are about creating room, not filling it.`
      : `You have real headroom, so we let the plan reach further than we otherwise would.`,
    `We kept three bold results rather than more, because a plan you can hold in your head is a plan you will actually run.`,
  ].join(' ');
}

function omissionsFor(s: Signals): string[] {
  const out = [
    'We are not optimising for maximum working hours.',
    'We are not pursuing more than one major objective this quarter.',
    'We are not adding habits that do not directly support this game.',
  ];
  if (s.hasFamilyProtection) out.push('We are not making family time the flexible part of the plan.');
  if (s.hasHealthProtection || s.archetype === 'depleted') {
    out.push('We are not funding any of this from sleep or recovery.');
  }
  if (s.capacity.verdict === 'overloaded') {
    out.push('We are not starting anything new until something has ended.');
  }
  return out.slice(0, 6);
}
