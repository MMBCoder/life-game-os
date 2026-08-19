import type { Archetype } from './signals';
import type { LeverageCategory } from '@/schemas/common';

/**
 * Hand-authored strategy material, indexed by archetype.
 *
 * Its ceiling is lower than a real model's — that is accepted. Its job is to keep the
 * product fully functional without credentials and to give the evaluation suite real
 * differentiation to assert against.
 */

export interface MoveTemplate {
  title: string;
  detail: string;
  leverage: LeverageCategory;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
}

export const MOVES: Record<Archetype, MoveTemplate[]> = {
  constrained_ambitious: [
    {
      title: 'Hand over one recurring responsibility completely',
      detail:
        'Pick the recurring commitment that consumes the most time for the least strategic return, name a successor, and transfer it in one conversation rather than tapering it. Partial handover keeps the cognitive load.',
      leverage: 'delegation',
      impact: 'high',
      effort: 'medium',
    },
    {
      title: 'Make existing work visible instead of starting new work',
      detail:
        'The work that would earn recognition has already been done; it has not been narrated. Build one short standing update that reaches the people who make decisions about you.',
      leverage: 'visibility',
      impact: 'high',
      effort: 'low',
    },
    {
      title: 'Reposition how your role is described',
      detail:
        'Rewrite how you describe your remit — in your own words, in writing, where others read it — so it points at the outcomes you want to be trusted with rather than the tasks you currently absorb.',
      leverage: 'positioning',
      impact: 'high',
      effort: 'low',
    },
    {
      title: 'Renegotiate one commitment you inherited rather than chose',
      detail:
        'There is at least one obligation you are carrying because nobody reassigned it. Raise it once, explicitly, with a proposed alternative owner.',
      leverage: 'negotiation',
      impact: 'medium',
      effort: 'medium',
    },
    {
      title: 'Replace one meeting series with a written decision loop',
      detail:
        'Convert a recurring meeting into an asynchronous decision document. It returns hours and improves the quality of the record at the same time.',
      leverage: 'systems',
      impact: 'medium',
      effort: 'low',
    },
    {
      title: 'Stop the lowest-value stream outright',
      detail:
        'Not deferred, not reduced — ended, with the decision communicated. Elimination is the only leverage that returns capacity immediately.',
      leverage: 'elimination',
      impact: 'high',
      effort: 'low',
    },
  ],
  depleted: [
    {
      title: 'Cut the commitment list to what is genuinely load-bearing',
      detail:
        'Before anything is added, remove. List what you are currently carrying and end the bottom third. Recovery is not a scheduling problem while the load is unchanged.',
      leverage: 'elimination',
      impact: 'high',
      effort: 'low',
    },
    {
      title: 'Define a minimum that survives a bad day',
      detail:
        'A version of each commitment that takes ten minutes and still counts. This is what stops one missed day becoming a missed month.',
      leverage: 'systems',
      impact: 'high',
      effort: 'low',
    },
    {
      title: 'Change the environment rather than relying on resolve',
      detail:
        'Adjust one physical or calendar default so the sustainable choice is the easy one. Willpower is the resource currently in deficit; do not spend more of it.',
      leverage: 'environment',
      impact: 'medium',
      effort: 'low',
    },
    {
      title: 'Have the one conversation you have been postponing',
      detail:
        'A single unresolved conversation is usually carrying more load than the work it concerns. Name the outcome you want before you open it.',
      leverage: 'negotiation',
      impact: 'high',
      effort: 'medium',
    },
    {
      title: 'Protect one uninterrupted recovery block per week',
      detail:
        'Booked, defended, and not the first thing sacrificed when the week tightens. Treat it as an appointment with someone else.',
      leverage: 'focus',
      impact: 'medium',
      effort: 'low',
    },
  ],
  high_capacity_accelerator: [
    {
      title: 'Take on one visibly consequential piece of work',
      detail:
        'Choose the project whose outcome is discussed at a level above yours, and own a nameable part of it end to end.',
      leverage: 'visibility',
      impact: 'high',
      effort: 'high',
    },
    {
      title: 'Secure an advocate, not just a mentor',
      detail:
        'A mentor advises you; an advocate argues for you when you are not in the room. Identify one person with that standing and give them something specific to advocate for.',
      leverage: 'sponsorship',
      impact: 'high',
      effort: 'medium',
    },
    {
      title: 'Build depth in the one skill your goal actually gates on',
      detail:
        'Not broad development — the single capability whose absence would be the stated reason you were passed over. Make it demonstrable, not just acquired.',
      leverage: 'expertise',
      impact: 'high',
      effort: 'high',
    },
    {
      title: 'Sequence the next two moves so each one earns the next',
      detail:
        'Order matters more than pace. Pick the move that makes the following move easier to ask for, and do that one first.',
      leverage: 'sequencing',
      impact: 'medium',
      effort: 'low',
    },
    {
      title: 'Widen the set of people who can vouch for your work',
      detail:
        'Deliberately do work alongside two people outside your current reporting line, so your reputation does not have a single point of failure.',
      leverage: 'relationships',
      impact: 'medium',
      effort: 'medium',
    },
  ],
  identity_shifter: [
    {
      title: 'Produce one piece of public evidence in the new direction',
      detail:
        'Something a stranger could evaluate — written, built, or shipped. Credibility in a new field is transferred by artefacts, not by intent.',
      leverage: 'expertise',
      impact: 'high',
      effort: 'high',
    },
    {
      title: 'Have five real conversations with people already there',
      detail:
        'Not networking. Specific questions about how the work actually operates, asked of people doing it. This corrects the model you are planning against.',
      leverage: 'relationships',
      impact: 'high',
      effort: 'medium',
    },
    {
      title: 'Reframe your existing experience as an asset, not a detour',
      detail:
        'Write the two-sentence version of why your background is an advantage in the new direction. If you cannot say it, you will be described by others as a career change instead of a strength.',
      leverage: 'positioning',
      impact: 'high',
      effort: 'low',
    },
    {
      title: 'Stage the transition so it is reversible for as long as possible',
      detail:
        'Order the steps so the irreversible one comes last and by then is obviously right, rather than first and requiring courage.',
      leverage: 'sequencing',
      impact: 'medium',
      effort: 'medium',
    },
  ],
  hollow_winner: [
    {
      title: 'Remove the work that produces results you do not value',
      detail:
        'Some of your output is generating recognition for work you would not choose. Identify it precisely and stop competing for it.',
      leverage: 'elimination',
      impact: 'high',
      effort: 'medium',
    },
    {
      title: 'Reclaim decision rights over what you work on',
      detail:
        'The experience of the work usually degrades through loss of choice rather than volume. Negotiate for selection rights, not for less.',
      leverage: 'negotiation',
      impact: 'high',
      effort: 'medium',
    },
    {
      title: 'Reinvest one recovered block into work you would do unpaid',
      detail:
        'One protected block on something intrinsically interesting. It is not a reward for the rest; it is the part that makes the rest sustainable.',
      leverage: 'focus',
      impact: 'medium',
      effort: 'low',
    },
    {
      title: 'Change one condition of how you work, not how much',
      detail:
        'Location, who you work alongside, or how the work is reviewed. Conditions often explain the experience better than hours do.',
      leverage: 'environment',
      impact: 'medium',
      effort: 'medium',
    },
  ],
  provider_optimiser: [
    {
      title: 'Automate the financial system so it does not need attention',
      detail:
        'Automatic transfers on payday, one dashboard, one monthly review. Financial progress that depends on ongoing willpower competes with everything else you are carrying.',
      leverage: 'automation',
      impact: 'high',
      effort: 'low',
    },
    {
      title: 'Raise income through position rather than through hours',
      detail:
        'Hours are the one input that bills directly to the people this is for. Rate, scope, or role are the levers that do not.',
      leverage: 'positioning',
      impact: 'high',
      effort: 'medium',
    },
    {
      title: 'Sequence one financial objective at a time',
      detail:
        'Pick the single target for this ninety days. Parallel financial goals mostly produce slower progress on all of them and more anxiety about each.',
      leverage: 'sequencing',
      impact: 'medium',
      effort: 'low',
    },
    {
      title: 'Make one fixed cost structurally lower',
      detail:
        'A recurring reduction outperforms repeated discipline about discretionary spending, and it requires the decision only once.',
      leverage: 'systems',
      impact: 'medium',
      effort: 'medium',
    },
  ],
};

export const STOP_ITEMS: Record<Archetype, Array<{ text: string; reason: string }>> = {
  constrained_ambitious: [
    {
      text: 'Stop accepting work in the moment it is offered',
      reason:
        'Immediate yes is where most of your overload originates. A held answer costs nothing and changes the outcome.',
    },
    {
      text: 'Stop treating every request as though it were strategic',
      reason:
        'Urgency and importance have been collapsed into one category, so everything is being paid for at the same rate.',
    },
    {
      text: 'Stop adding a commitment without removing one',
      reason: 'Your capacity is the binding constraint; additions without subtractions are borrowed from protected time.',
    },
    {
      text: 'Stop absorbing work that has no owner',
      reason:
        'Quietly picking up unassigned work makes it permanently yours and invisible in every workload conversation.',
    },
  ],
  depleted: [
    {
      text: 'Stop solving capacity problems with more effort',
      reason:
        'Effort is the input in deficit. Applying more of it to a capacity problem deepens the deficit.',
    },
    {
      text: 'Stop borrowing from sleep to finish low-value work',
      reason: 'The next day pays the cost at a worse exchange rate than the work was worth.',
    },
    {
      text: 'Stop measuring the day by how much you got through',
      reason:
        'Output volume is the metric that got you here; it is not the metric that gets you out.',
    },
    {
      text: 'Stop deferring the conversation that would reduce the load',
      reason: 'The postponement is itself consuming energy, every day, without resolving anything.',
    },
  ],
  high_capacity_accelerator: [
    {
      text: 'Stop pursuing three career objectives at once',
      reason:
        'You have the capacity to attempt all three and the concentration to complete one. Sequencing is the constraint, not energy.',
    },
    {
      text: 'Stop doing high-effort work nobody can attribute to you',
      reason:
        'Unattributable work at this stage buys goodwill instead of standing, and you need standing.',
    },
    {
      text: 'Stop treating skill acquisition as progress on its own',
      reason: 'Capability that is not demonstrated does not move the outcome you named.',
    },
    {
      text: 'Stop waiting to be offered the next thing',
      reason: 'The pattern that got you here rewards asking, and you have the record to ask with.',
    },
  ],
  identity_shifter: [
    {
      text: 'Stop preparing instead of producing',
      reason:
        'Further preparation is now the comfortable form of avoidance. One artefact teaches more than another course.',
    },
    {
      text: 'Stop describing your background as a detour',
      reason:
        'The framing you use becomes the framing others use, and it is currently costing you the advantage you actually have.',
    },
    {
      text: 'Stop making the transition a single irreversible decision',
      reason: 'Framing it as one leap makes it feel reckless and delays every step that is not.',
    },
  ],
  hollow_winner: [
    {
      text: 'Stop competing for recognition you do not want',
      reason:
        'Some of your current effort is buying outcomes that will not improve your experience of the work.',
    },
    {
      text: 'Stop using external results as evidence that the strategy is working',
      reason:
        'The external numbers are exactly what is masking the cost. They are not a rebuttal to how it feels.',
    },
    {
      text: 'Stop giving away the parts of the work you enjoy',
      reason:
        'The enjoyable work is usually the first delegated because it feels indulgent. That is the wrong thing to hand over.',
    },
  ],
  provider_optimiser: [
    {
      text: 'Stop trading family time for marginal income',
      reason:
        'The trade is being made incrementally, at a rate you would refuse if it were proposed all at once.',
    },
    {
      text: 'Stop running multiple financial objectives in parallel',
      reason: 'Split attention produces slower progress and more anxiety about each of them.',
    },
    {
      text: 'Stop relying on discipline where a system would do',
      reason: 'Every decision you automate is a decision you no longer have to win.',
    },
  ],
};

export const GAME_NAME_PARTS: Record<Archetype, string[]> = {
  constrained_ambitious: [
    'The Leverage Quarter',
    'Progress Without Cost',
    'The Strategic Builder',
    'Ninety Days of Leverage',
    'Rise Without Overrun',
  ],
  depleted: [
    'The Rebuild',
    'Capacity First',
    'The Recovery Quarter',
    'Steady Ground',
    'Return to Sustainable',
  ],
  high_capacity_accelerator: [
    'The Acceleration',
    'Visible Ninety',
    'The Exposure Quarter',
    'Step Change',
    'The Ascent',
  ],
  identity_shifter: [
    'The Crossing',
    'Proof of the New Direction',
    'Becoming Credible',
    'The Deliberate Pivot',
    'Evidence Quarter',
  ],
  hollow_winner: [
    'Reclaiming the Work',
    'The Inner Result',
    'Winning On Purpose',
    'The Realignment',
    'Same Results, Different Cost',
  ],
  provider_optimiser: [
    'Freedom Without Absence',
    'The Compounding Quarter',
    'Building the Runway',
    'Provide and Be Present',
    'The Quiet Engine',
  ],
};

export const PLAYER_NAMES: Record<Archetype, string[]> = {
  constrained_ambitious: ['The Strategic Builder', 'The Calm Operator', 'The Leverage Architect'],
  depleted: ['The Steady Rebuilder', 'The Sustainable Operator', 'The Grounded Player'],
  high_capacity_accelerator: ['The Deliberate Climber', 'The Visible Contributor', 'The Focused Ascender'],
  identity_shifter: ['The Credible Newcomer', 'The Deliberate Crosser', 'The Evidence Builder'],
  hollow_winner: ['The Realigned Performer', 'The Selective Operator', 'The Purposeful Winner'],
  provider_optimiser: ['The Present Provider', 'The Quiet Compounder', 'The Steady Builder'],
};

export const MANTRAS: Record<Archetype, string[]> = {
  constrained_ambitious: [
    'Create leverage, not more workload.',
    'Fewer commitments, better ones.',
    'The plan changes; the ambition does not.',
  ],
  depleted: [
    'Rebuild the base before adding load.',
    'Minimum still counts.',
    'Capacity is the strategy.',
  ],
  high_capacity_accelerator: [
    'One thing, done visibly.',
    'Ask, then deliver.',
    'Depth before breadth.',
  ],
  identity_shifter: [
    'Produce, then persuade.',
    'Evidence over intent.',
    'My history is the advantage.',
  ],
  hollow_winner: [
    'Results that are worth having.',
    'Choose the work, not just the outcome.',
    'The cost is part of the score.',
  ],
  provider_optimiser: [
    'Build it without billing them.',
    'Systems, not sacrifice.',
    'Present now, free later.',
  ],
};

export const ATTITUDES: Record<Archetype, string[][]> = {
  constrained_ambitious: [
    ['Calm', 'Clear', 'Courageous'],
    ['Deliberate', 'Direct', 'Composed'],
  ],
  depleted: [
    ['Patient', 'Honest', 'Kind'],
    ['Steady', 'Realistic', 'Gentle'],
  ],
  high_capacity_accelerator: [
    ['Ambitious', 'Focused', 'Open'],
    ['Bold', 'Curious', 'Reliable'],
  ],
  identity_shifter: [
    ['Curious', 'Humble', 'Persistent'],
    ['Open', 'Rigorous', 'Brave'],
  ],
  hollow_winner: [
    ['Honest', 'Selective', 'Present'],
    ['Discerning', 'Grounded', 'Willing'],
  ],
  provider_optimiser: [
    ['Steady', 'Present', 'Disciplined'],
    ['Patient', 'Warm', 'Consistent'],
  ],
};

export const RITUAL_TEMPLATES = [
  {
    category: 'energy' as const,
    name: 'Movement before the workday',
    detail:
      'A short walk or session before work begins, chosen for consistency rather than intensity.',
    cadence: 'Weekday mornings',
    fits: 'energy is highest before the day starts and the current game needs sustained thinking',
  },
  {
    category: 'mind' as const,
    name: 'Ten-minute end-of-day close',
    detail:
      'Write what moved, what did not, and the single decision for tomorrow. Then stop working.',
    cadence: 'End of each workday',
    fits: 'work is currently following you home, and a defined close is what ends the day',
  },
  {
    category: 'relationships' as const,
    name: 'One undivided hour',
    detail: 'A recurring block with the people who matter, with no device present.',
    cadence: 'Weekly',
    fits: 'presence rather than time is what is actually missing here',
  },
  {
    category: 'gratitude' as const,
    name: 'Weekly note of what held',
    detail: 'Three things that went right, named specifically. Two minutes, written down.',
    cadence: 'Weekly',
    fits: 'the current pattern registers what failed far more readily than what worked',
  },
  {
    category: 'support' as const,
    name: 'The weekly ask',
    detail: 'Identify one thing to delegate, decline, or request help with. Then do it.',
    cadence: 'Weekly',
    fits: 'asking is the skill that would most reduce the load, and it improves with repetition',
  },
  {
    category: 'purpose' as const,
    name: 'Protected block on the work you chose',
    detail: 'One block on something intrinsically interesting, defended like a meeting.',
    cadence: 'Weekly',
    fits: 'the connection between the work and the reason for it has thinned',
  },
  {
    category: 'creativity' as const,
    name: 'One unproductive hour',
    detail: 'Time with no output requirement. Reading, making, wandering — anything unmeasured.',
    cadence: 'Weekly',
    fits: 'every current hour has a purpose attached, which is itself part of the strain',
  },
];

export const ROUTINE_TEMPLATES = [
  {
    slot: 'morning' as const,
    name: 'Deliberate start',
    steps: [
      'No screen for the first fifteen minutes',
      'Movement, however brief',
      'Name the one move that matters today',
    ],
    minutes: 30,
  },
  {
    slot: 'work' as const,
    name: 'Protected first block',
    steps: [
      'Hardest strategic work first, before the inbox',
      'One task, notifications off',
      'Stop at the block boundary, finished or not',
    ],
    minutes: 90,
  },
  {
    slot: 'transition' as const,
    name: 'Close the workday',
    steps: [
      'Write tomorrow’s single decision',
      'Shut the work surfaces down',
      'Ten minutes of something with no purpose',
    ],
    minutes: 20,
  },
  {
    slot: 'evening' as const,
    name: 'Present evening',
    steps: ['Devices away for the shared hour', 'One real conversation', 'A consistent wind-down'],
    minutes: 60,
  },
  {
    slot: 'weekly' as const,
    name: 'Weekly review',
    steps: [
      'What moved and what did not',
      'What cost more than expected',
      'Next week’s three moves',
    ],
    minutes: 25,
  },
  {
    slot: 'monthly' as const,
    name: 'Monthly recalibration',
    steps: [
      'Compare the life map to last month',
      'Is this still the right game?',
      'Adjust, simplify, or continue',
    ],
    minutes: 45,
  },
];
