import { BarChart3 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMoney, useReports } from '@/lib/queries';
import { Card, EmptyState, Skeleton } from '@/ui/Display';
import { PageHeader } from './StaffLayout';

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className='p-5'>
      <p className='text-sm text-ink-muted'>{label}</p>
      <p className='tabular mt-2 font-display text-3xl font-bold tracking-tight'>{value}</p>
      {sub && <p className='mt-1 text-sm text-ink-subtle'>{sub}</p>}
    </Card>
  );
}

const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

interface ChartTooltipProps {
  active?: boolean;
  payload?: { payload: Record<string, number | string> }[];
  label?: string | number;
  format: (p: Record<string, number | string>) => ReactNode;
}

function ChartTooltip({ active, payload, label, format }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className='rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-raised'>
      <p className='font-medium'>{typeof label === 'number' ? hourLabel(label) : label}</p>
      <p className='tabular text-ink-muted'>{format(payload[0].payload)}</p>
    </div>
  );
}

const axisTick = { fill: 'var(--ink-subtle)', fontSize: 12 };

export function ReportsPage() {
  const { data, isLoading } = useReports();
  const money = useMoney();

  return (
    <div>
      <PageHeader title='Reports' description='Live numbers for today’s service. Revenue counts paid orders only.' />
      <div className='space-y-6 px-4 pb-10 sm:px-6 lg:px-8'>
        {isLoading || !data ? (
          <div className='grid grid-cols-2 gap-4 @4xl:grid-cols-4'>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className='h-32' />
            ))}
          </div>
        ) : (
          <>
            <div className='grid grid-cols-2 gap-4 @4xl:grid-cols-4'>
              <Stat
                label='Revenue'
                value={money(data.revenueCents)}
                sub={`${money(data.outstandingCents)} still open on tables`}
              />
              <Stat label='Orders' value={data.orderCount} sub={`${data.openOrderCount} in the kitchen now`} />
              <Stat label='Average order' value={money(data.averageTicketCents)} />
              <Stat
                label='Average time to ready'
                value={data.averagePrepMinutes === null ? '—' : `${data.averagePrepMinutes} min`}
                sub={`${data.occupiedTables} of ${data.totalTables} tables seated`}
              />
            </div>

            {data.orderCount === 0 ? (
              <Card>
                <EmptyState icon={<BarChart3 className='size-6' />} title='No orders yet today'>
                  Charts fill in as orders come through.
                </EmptyState>
              </Card>
            ) : (
              <div className='grid gap-4 @5xl:grid-cols-2'>
                <Card className='p-5'>
                  <h2 className='font-display text-lg font-bold'>Orders by hour</h2>
                  <div className='mt-4 h-64' aria-hidden>
                    <ResponsiveContainer>
                      <BarChart data={data.ordersByHour} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barCategoryGap={2}>
                        <CartesianGrid vertical={false} stroke='var(--line)' />
                        <XAxis
                          dataKey='hour'
                          tickFormatter={hourLabel}
                          tick={axisTick}
                          axisLine={false}
                          tickLine={false}
                          interval='preserveStartEnd'
                        />
                        <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: 'var(--surface-2)' }}
                          content={<ChartTooltip format={(p) => `${p.orders} orders · ${money(Number(p.revenueCents))} paid`} />}
                        />
                        <Bar dataKey='orders' fill='var(--chart)' radius={[4, 4, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <table className='sr-only'>
                    <caption>Orders by hour</caption>
                    <thead>
                      <tr>
                        <th>Hour</th>
                        <th>Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ordersByHour.map((h) => (
                        <tr key={h.hour}>
                          <td>{hourLabel(h.hour)}</td>
                          <td>{h.orders}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>

                <Card className='p-5'>
                  <h2 className='font-display text-lg font-bold'>Best sellers</h2>
                  <ol className='mt-4 space-y-3'>
                    {data.topItems.map((item) => {
                      const max = data.topItems[0]?.quantity || 1;
                      return (
                        <li key={item.name} className='text-sm'>
                          <div className='flex items-baseline justify-between gap-3'>
                            <span className='truncate font-medium'>{item.name}</span>
                            <span className='tabular shrink-0 text-ink-muted'>
                              {item.quantity} sold · {money(item.revenueCents)}
                            </span>
                          </div>
                          <div className='mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2' aria-hidden>
                            <div
                              className='h-full rounded-full bg-chart transition-[width] duration-500 ease-[var(--ease-out)]'
                              style={{ width: `${(item.quantity / max) * 100}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
