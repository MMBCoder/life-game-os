import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth/session';
import * as execution from '@/lib/db/repositories/execution';
import { Card, CardBody, CardHeader, CardTitle, SectionLabel } from '@/components/ui/card';
import { Badge } from '@/components/ui/feedback';
import { ProtocolClient } from './protocol-client';

export const metadata: Metadata = { title: 'Protocol' };

const SLOT_LABEL: Record<string, string> = {
  morning: 'Morning',
  work: 'Work',
  transition: 'Transition',
  evening: 'Evening',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default async function ProtocolPage() {
  const user = await requireSession();
  const [protocol, rituals, routines] = await Promise.all([
    execution.getActiveProtocol(user.id),
    execution.listRituals(user.id),
    execution.listRoutines(user.id),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <p className="type-label text-ink-faint">Your protocol</p>
        <h1 className="type-statement mt-2 text-ink">How you operate — on any kind of day.</h1>
        <p className="type-body mt-3 max-w-2xl text-ink-muted">
          Three modes, so a difficult day still has a defined move. The minimum is not a failure
          state; it is the plan working.
        </p>
      </header>

      {protocol && (
        <section>
          <SectionLabel>Minimum · Standard · Expansion</SectionLabel>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse">
              <caption className="sr-only">Your operating protocol by mode</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="type-label py-2.5 pr-4 text-left text-ink-faint">
                    Area
                  </th>
                  <th scope="col" className="type-label py-2.5 pr-4 text-left text-watch">
                    Minimum
                  </th>
                  <th scope="col" className="type-label py-2.5 pr-4 text-left text-primary">
                    Standard
                  </th>
                  <th scope="col" className="type-label py-2.5 text-left text-protect">
                    Expansion
                  </th>
                </tr>
              </thead>
              <tbody>
                {protocol.items.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <th scope="row" className="type-small py-3.5 pr-4 text-left font-medium text-ink">
                      {item.label}
                    </th>
                    <td className="type-small py-3.5 pr-4 text-ink-muted">{item.minimum}</td>
                    <td className="type-small py-3.5 pr-4 text-ink">{item.standard}</td>
                    <td className="type-small py-3.5 text-ink-muted">{item.expansion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {rituals.length > 0 && (
        <section>
          <SectionLabel>Rituals</SectionLabel>
          <p className="type-small mt-1 mb-3 text-ink-muted">
            Chosen for your life, not from a list. Each one says why it fits.
          </p>
          <ul className="grid gap-4 md:grid-cols-2">
            {rituals.map((ritual) => (
              <li key={ritual.id}>
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle as="h3">{ritual.name}</CardTitle>
                      <p className="type-small mt-1 text-ink-faint">{ritual.cadence}</p>
                    </div>
                    <Badge tone="neutral">{ritual.category}</Badge>
                  </CardHeader>
                  <CardBody>
                    <p className="type-body text-ink">{ritual.detail}</p>
                    <p className="type-small mt-2.5 text-ink-muted">{ritual.whyThisFits}</p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {routines.length > 0 && (
        <section>
          <SectionLabel>Routines</SectionLabel>
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {routines.map((routine) => (
              <li key={routine.id}>
                <Card>
                  <CardHeader>
                    <div>
                      <p className="type-label text-ink-faint">
                        {SLOT_LABEL[routine.slot] ?? routine.slot}
                      </p>
                      <CardTitle as="h3" className="mt-1">
                        {routine.name}
                      </CardTitle>
                    </div>
                    <span data-numeric className="type-small text-ink-faint">
                      {routine.durationMinutes} min
                    </span>
                  </CardHeader>
                  <CardBody>
                    <ol className="space-y-1.5">
                      {routine.steps.map((step, i) => (
                        <li key={step} className="type-small flex gap-2.5 text-ink">
                          <span data-numeric className="text-ink-faint">
                            {i + 1}.
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ProtocolClient hasProtocol={protocol !== null} />
    </div>
  );
}
