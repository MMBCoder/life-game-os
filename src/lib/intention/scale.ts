/**
 * LEVELS OF INTENTION — 15 levels, +7 to -7.
 *
 * Two dimensions at every level:
 *   `stance`     Experience — what it feels like, how it lives for you
 *   `energy`     Energetic — what you are putting out into the Universe
 *
 * The 15 levels group into 8 broader experiential states:
 *
 *   Sovereignty → Surrendering → Seeking → Striving →
 *   Settling → Sacrificing → Struggling → Suffering
 *
 * The positive side moves toward greater agency and alignment; the negative side
 * moves progressively toward resistance, blame and self-sabotage.
 *
 * Scale and terminology supplied and confirmed by the product owner.
 *
 * ── Safety note (CLAUDE.md §6) ───────────────────────────────────────────────
 * A level describes the stance a person is *operating from* right now. It moves
 * hour to hour and is entirely changeable. It never describes the person, and it is
 * never framed as clinical. The -6 and -7 copy is the copy most capable of doing
 * harm, so it is written to be read aloud to someone actually there without making
 * their day worse — and it does not assert a health state.
 *
 * This file is the single source of truth for the labels. Nothing else hard-codes a
 * stance or energy name.
 */

export type IntentionBand =
  | 'sovereignty'
  | 'surrendering'
  | 'seeking'
  | 'striving'
  | 'settling'
  | 'sacrificing'
  | 'struggling'
  | 'suffering';

export type IntentionTone = 'protect' | 'primary' | 'neutral' | 'watch' | 'risk';

export interface IntentionLevel {
  /** -7 … +7 */
  level: number;
  band: IntentionBand;
  /** Experience — how it feels. */
  stance: string;
  /** Energetic — what you are putting out. */
  energy: string;
  /** The experience, in the second person. */
  experience: string;
  /** The energetic output, in the second person. */
  putting: string;
  tone: IntentionTone;
}

/** Ordered high to low, so the ladder renders top-down without re-sorting. */
export const INTENTION_LADDER: readonly IntentionLevel[] = [
  {
    level: 7,
    band: 'sovereignty',
    stance: 'Sovereignty',
    energy: 'Embodying',
    experience:
      'Supreme power and authority to govern yourself. You are present, and able to respond with power and confidence in any moment.',
    putting: 'You are embodying what you intend rather than pursuing it.',
    tone: 'protect',
  },
  {
    level: 6,
    band: 'surrendering',
    stance: 'Surrendering',
    energy: 'Knowing',
    experience:
      'You have ceased resistance and relinquished control to something greater. You are acknowledging what is true and aligning with trust.',
    putting: 'You are putting out knowing — not hope, and not force.',
    tone: 'protect',
  },
  {
    level: 5,
    band: 'surrendering',
    stance: 'Surrendering',
    energy: 'Committing',
    experience:
      'Resistance and control are released. You are aligned with trust, and the decision is already made.',
    putting: 'You are putting out commitment rather than reconsidering the choice.',
    tone: 'protect',
  },
  {
    level: 4,
    band: 'seeking',
    stance: 'Seeking',
    energy: 'Believing',
    experience:
      'You are searching and expanding — taking on new thoughts, new actions, and new responses to people and circumstances.',
    putting: 'You are putting out belief that what you are looking for is available to you.',
    tone: 'primary',
  },
  {
    level: 3,
    band: 'seeking',
    stance: 'Seeking',
    energy: 'Asking',
    experience:
      'You are actively searching, exploring and expanding your thoughts, actions and responses.',
    putting: 'You are putting out real questions, and staying for the answers.',
    tone: 'primary',
  },
  {
    level: 2,
    band: 'striving',
    stance: 'Striving',
    energy: 'Wanting',
    experience:
      'You are making great effort and trying hard to achieve or obtain something — actively focusing thought and energy on acquiring what you do not have.',
    putting: 'You are putting out want: focused, but from a position of lack.',
    tone: 'primary',
  },
  {
    level: 1,
    band: 'striving',
    stance: 'Striving',
    energy: 'Wishing',
    experience:
      'You are making effort and directing your thoughts and energy toward something you desire.',
    putting: 'You are putting out wishing more than movement.',
    tone: 'primary',
  },
  {
    level: 0,
    band: 'settling',
    stance: 'Settling',
    energy: 'Indifference',
    experience:
      'You are accepting something you consider less than satisfactory, choosing security or comfort, and rationalising why what you know to do is not worth doing.',
    putting: 'You are putting out very little in either direction.',
    tone: 'neutral',
  },
  {
    level: -1,
    band: 'settling',
    stance: 'Settling',
    energy: 'Resigned',
    experience:
      'You are remaining with something less than satisfactory, and choosing security and comfort over action.',
    putting: 'You are putting out a quiet case for staying where you are.',
    tone: 'neutral',
  },
  {
    level: -2,
    band: 'sacrificing',
    stance: 'Sacrificing',
    energy: 'Avoiding',
    experience:
      'You are giving away your gift, or what you want, for some noble cause — doing for others before yourself, and busying yourself with their demands.',
    putting: 'You are putting out availability, and staying busy enough not to notice.',
    tone: 'watch',
  },
  {
    level: -3,
    band: 'sacrificing',
    stance: 'Sacrificing',
    energy: 'Denying',
    experience:
      'You are over-prioritising other people’s needs and demands at the expense of your own wants, needs and gifts.',
    putting: 'You are putting out everything you have, in every direction except your own.',
    tone: 'watch',
  },
  {
    level: -4,
    band: 'struggling',
    stance: 'Struggling',
    energy: 'Resisting',
    experience:
      'You are having difficulty getting an outcome — forcing or fighting to cope, going against what you know is true, and repeating a cycle you do not want.',
    putting: 'You are putting out resistance where the situation is asking for a different move.',
    tone: 'risk',
  },
  {
    level: -5,
    band: 'struggling',
    stance: 'Struggling',
    energy: 'Suppressing',
    experience:
      'You are continuing to force, fight or resist the outcome, and the undesirable pattern keeps repeating.',
    putting: 'You are putting energy into holding it all down.',
    tone: 'risk',
  },
  {
    level: -6,
    band: 'suffering',
    stance: 'Suffering',
    energy: 'Resenting',
    experience:
      'You are enduring real pain and hardship, and there is blame in it — of yourself or of someone else — along with anger, and the sense of being the one it happened to.',
    putting: 'You are putting out resentment, which is what is left when effort has not worked.',
    tone: 'risk',
  },
  {
    level: -7,
    band: 'suffering',
    stance: 'Suffering',
    energy: 'Sabotaging',
    experience:
      'You are deeply experiencing pain, hardship, blame and anger, and some part of you has begun working against your own plan.',
    putting: 'You are putting out the very thing that keeps this going.',
    tone: 'risk',
  },
];

const BY_LEVEL = new Map(INTENTION_LADDER.map((entry) => [entry.level, entry]));

export const INTENTION_MIN = -7;
export const INTENTION_MAX = 7;

/** Clamps into range, so a caller can never index off the end of the ladder. */
export function intentionAt(level: number): IntentionLevel {
  const clamped = Math.max(INTENTION_MIN, Math.min(INTENTION_MAX, Math.round(level)));
  const entry = BY_LEVEL.get(clamped);
  // Unreachable: every level in range is defined. Kept so the return type is honest.
  if (!entry) throw new Error(`No intention level defined for ${clamped}`);
  return entry;
}

/**
 * Where the line sits between energy going into what you intend and energy going
 * into absorbing its cost. Used to colour the rail, not to judge.
 */
export function isAbove(level: number): boolean {
  return level > 0;
}
