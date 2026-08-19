import { cn } from '@/lib/cn';
import { AGENT_LABEL, type AgentId } from '@/schemas/agent';

export interface CouncilNode {
  agent: AgentId;
  status: 'succeeded' | 'failed' | 'running';
  confidence: number | null;
  summary?: string;
}

/**
 * The Council Room graph.
 *
 * Agents are drawn as roles, not characters — the point is to make the structure of
 * the decision legible (who advises, who can veto, who attacks, who decides), not to
 * anthropomorphise them.
 */
export function CouncilGraph({ nodes }: { nodes: CouncilNode[] }) {
  const byAgent = new Map(nodes.map((n) => [n.agent, n]));

  const advisors: AgentId[] = ['identity', 'reality', 'goal', 'player', 'strategy', 'execution', 'reflection'];
  const guardians: AgentId[] = ['health', 'relationships', 'capacity'];

  const present = (list: AgentId[]) => list.filter((a) => byAgent.has(a));

  return (
    <div className="space-y-4">
      <Tier
        label="Analysis"
        hint="Run in parallel on the same facts"
        agents={present(advisors)}
        byAgent={byAgent}
      />
      <Connector />
      <Tier
        label="Guardians"
        hint="Can veto — strategy cannot overrule them"
        agents={present(guardians)}
        byAgent={byAgent}
        tone="protect"
      />
      {byAgent.has('redTeam') && (
        <>
          <Connector />
          <Tier
            label="Red Team"
            hint="Attacks the surviving proposal"
            agents={['redTeam']}
            byAgent={byAgent}
            tone="watch"
          />
        </>
      )}
      {byAgent.has('orchestrator') && (
        <>
          <Connector />
          <Tier
            label="Final decision"
            hint="Resolves under fixed precedence"
            agents={['orchestrator']}
            byAgent={byAgent}
            tone="primary"
          />
        </>
      )}
    </div>
  );
}

function Tier({
  label,
  hint,
  agents,
  byAgent,
  tone = 'neutral',
}: {
  label: string;
  hint: string;
  agents: AgentId[];
  byAgent: Map<AgentId, CouncilNode>;
  tone?: 'neutral' | 'protect' | 'watch' | 'primary';
}) {
  if (agents.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
        <p className="type-label text-ink-faint">{label}</p>
        <p className="type-small text-ink-faint">{hint}</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {agents.map((agent) => {
          const node = byAgent.get(agent);
          return (
            <li key={agent}>
              <AgentNode agent={agent} node={node} tone={tone} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AgentNode({
  agent,
  node,
  tone,
}: {
  agent: AgentId;
  node: CouncilNode | undefined;
  tone: 'neutral' | 'protect' | 'watch' | 'primary';
}) {
  const failed = node?.status === 'failed';
  const tones = {
    neutral: 'border-line-strong bg-surface',
    protect: 'border-protect/45 bg-protect-soft/35',
    watch: 'border-watch/45 bg-watch-soft/35',
    primary: 'border-primary/40 bg-primary-soft/35',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2',
        failed ? 'border-line border-dashed opacity-60' : tones[tone],
      )}
      title={node?.summary}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          failed ? 'bg-ink-faint' : node ? 'bg-protect' : 'bg-line-strong',
        )}
      />
      <span className="type-small font-medium text-ink">{AGENT_LABEL[agent]}</span>
      {failed ? (
        <span className="type-label text-ink-faint">unavailable</span>
      ) : (
        typeof node?.confidence === 'number' && (
          <span data-numeric className="type-label text-ink-faint">
            {Math.round(node.confidence * 100)}%
          </span>
        )
      )}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center" aria-hidden="true">
      <div className="h-4 w-px bg-line-strong" />
    </div>
  );
}
