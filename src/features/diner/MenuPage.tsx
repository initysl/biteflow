import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, CATEGORY_LABELS, type Category, type MenuItem } from '@shared/schemas';
import { cn } from '@/lib/cn';
import { useConfig, useMenu } from '@/lib/queries';
import { EmptyState, FoodImage, Skeleton } from '@/ui/Display';
import { SearchField } from '@/ui/Form';
import { CartBar } from './CartBar';
import { useDiner } from './DinerLayout';
import { ItemSheet } from './ItemSheet';
import { MenuItemCard, PickCard } from './MenuItemCard';

const HEADER_OFFSET = 72 + 60; // site header + compact category bar

function PromoBanner({ code, label, onOrder }: { code: string; label: string; onOrder: () => void }) {
  return (
    <section
      aria-label='Offer'
      className='relative flex min-h-40 overflow-hidden rounded-[28px] bg-accent-bright text-on-bright sm:min-h-44'
    >
      <span aria-hidden className='absolute -top-12 -right-10 size-56 rounded-full bg-white/12' />
      <span aria-hidden className='absolute -bottom-20 left-1/3 size-40 rounded-full bg-white/8' />
      <div className='relative flex flex-1 flex-col justify-between gap-3 p-5 sm:p-7'>
        <span className='self-start rounded-full bg-white px-3 py-1 text-xs font-bold text-[#17171a]'>Code {code}</span>
        <p className='font-display text-[26px] leading-[1.05] font-bold text-balance sm:text-4xl'>{label}</p>
        <button
          type='button'
          onClick={onOrder}
          className='pressable self-start rounded-full bg-[#17171a] px-4 py-2 text-sm font-bold text-white'
        >
          Order now
        </button>
      </div>
    </section>
  );
}

export function MenuPage() {
  const { canOrder } = useDiner();
  const { data: config } = useConfig();
  const { data: menu, isLoading } = useMenu();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('starters');
  const [barVisible, setBarVisible] = useState(false);
  const sectionRefs = useRef<Partial<Record<Category, HTMLElement | null>>>({});
  const tilesRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      (menu ?? []).filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.dietary.some((d) => d.includes(q)),
      ),
    [menu, q],
  );
  const sections = CATEGORIES.map((c) => ({ category: c, items: filtered.filter((m) => m.category === c) })).filter(
    (s) => s.items.length,
  );
  const picks = (menu ?? []).filter((m) => m.featured && m.available);
  const tiles = CATEGORIES.map((c) => {
    const items = (menu ?? []).filter((m) => m.category === c);
    return { category: c, image: (items.find((m) => m.featured) ?? items[0])?.imageUrl ?? null, count: items.length };
  }).filter((t) => t.count > 0);

  // Scroll-spy: highlight the category whose section is under the sticky bar.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveCategory(visible[0].target.getAttribute('data-category') as Category);
      },
      { rootMargin: `-${HEADER_OFFSET + 8}px 0px -55% 0px` },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [sections.length, q]);

  // The compact category bar only appears once the photo tiles have scrolled away.
  useEffect(() => {
    const el = tilesRef.current;
    if (!el) {
      setBarVisible(!!q);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setBarVisible(!entry.isIntersecting), {
      rootMargin: '-72px 0px 0px 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [q, tiles.length]);

  useEffect(() => {
    barRef.current
      ?.querySelector(`[data-chip="${activeCategory}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [activeCategory]);

  const jumpTo = (c: Category) => {
    const el = sectionRefs.current[c];
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET, behavior: 'smooth' });
  };

  return (
    <>
      {/* Compact category bar */}
      <div
        aria-hidden={!barVisible}
        className={cn(
          'fixed inset-x-0 top-18 z-20 bg-canvas/90 backdrop-blur-xl transition-[transform,opacity] duration-200 ease-[var(--ease-out)]',
          barVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
        )}
      >
        <nav
          ref={barRef}
          aria-label='Menu sections'
          className='no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2.5 sm:px-6'
        >
          {sections.map(({ category }) => (
            <button
              key={category}
              type='button'
              data-chip={category}
              tabIndex={barVisible ? 0 : -1}
              onClick={() => jumpTo(category)}
              aria-current={activeCategory === category ? 'true' : undefined}
              className={cn(
                'pressable h-10 shrink-0 rounded-full px-4 text-sm font-bold transition-colors duration-150',
                activeCategory === category ? 'bg-accent text-on-accent' : 'bg-surface text-ink-muted shadow-card hover:text-ink',
              )}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </nav>
      </div>

      <main className='mx-auto max-w-6xl px-4 pb-36 sm:px-6'>
        <h1 className='sr-only'>Menu</h1>
        <div className='space-y-5 pt-2'>
          <div className='relative'>
            <SearchField
              icon={<Search className='size-5' />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search dishes, drinks, “vegan”…'
              aria-label='Search the menu'
              className='pr-12'
            />
            {query && (
              <button
                type='button'
                onClick={() => setQuery('')}
                aria-label='Clear search'
                className='pressable absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-accent-soft text-accent-ink'
              >
                <X className='size-4' />
              </button>
            )}
          </div>

          {!q && (
            <>
              {config?.promo && canOrder && (
                <div className='grid gap-4 md:grid-cols-[1.4fr_1fr]'>
                  <PromoBanner
                    code={config.promo.code}
                    label={config.promo.label}
                    onOrder={() => jumpTo(sections[0]?.category ?? 'starters')}
                  />
                  {picks[0] && (
                    <button
                      type='button'
                      onClick={() => setSelected(picks[0])}
                      className='pressable relative hidden overflow-hidden rounded-[28px] text-left md:block'
                    >
                      <FoodImage src={picks[0].imageUrl} alt={picks[0].name} className='absolute inset-0 size-full' />
                      <span className='absolute inset-x-3 bottom-3 rounded-2xl bg-surface/95 px-4 py-3 shadow-raised backdrop-blur'>
                        <span className='block text-xs font-bold text-accent-text'>Tonight’s favourite</span>
                        <span className='block font-display text-lg font-bold'>{picks[0].name}</span>
                      </span>
                    </button>
                  )}
                </div>
              )}

              <div ref={tilesRef} className='no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0'>
                {tiles.map(({ category, image }) => {
                  const active = activeCategory === category && barVisible;
                  return (
                    <button
                      key={category}
                      type='button'
                      onClick={() => jumpTo(category)}
                      className='pressable flex w-19 shrink-0 flex-col items-center gap-2 sm:w-24'
                    >
                      <span
                        className={cn(
                          'flex size-19 items-center justify-center rounded-3xl transition-colors sm:size-24',
                          active ? 'bg-accent' : 'bg-surface shadow-card',
                        )}
                      >
                        <FoodImage src={image} alt={CATEGORY_LABELS[category]} className='size-14 rounded-2xl sm:size-18' />
                      </span>
                      <span className={cn('text-[13px] font-bold', active ? 'text-accent-text' : 'text-ink-muted')}>
                        {CATEGORY_LABELS[category]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {picks.length > 0 && (
                <section aria-labelledby='picks-heading'>
                  <div className='flex items-center justify-between'>
                    <h2 id='picks-heading' className='font-display text-xl font-bold'>
                      Chef’s picks
                    </h2>
                    <span className='rounded-full bg-highlight px-3 py-1 text-xs font-bold text-on-highlight'>
                      {picks.length} favourites
                    </span>
                  </div>
                  <ul className='no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0'>
                    {picks.map((item) => (
                      <li key={item.id} className='snap-start'>
                        <PickCard item={item} onOpen={() => setSelected(item)} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        {isLoading ? (
          <div className='mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4'>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className='h-60 rounded-3xl' />
            ))}
          </div>
        ) : sections.length === 0 ? (
          <EmptyState icon={<Search className='size-6' />} title='Nothing matches that'>
            Try a different word, or clear the search to see the whole menu.
          </EmptyState>
        ) : (
          sections.map(({ category, items }) => (
            <section
              key={category}
              ref={(el) => {
                sectionRefs.current[category] = el;
              }}
              data-category={category}
              aria-labelledby={`cat-${category}`}
              className='pt-8'
            >
              <div className='flex items-baseline justify-between'>
                <h2 id={`cat-${category}`} className='font-display text-2xl font-bold'>
                  {CATEGORY_LABELS[category]}
                </h2>
                <span className='text-sm font-semibold text-ink-subtle'>{items.length} items</span>
              </div>
              <ul className='mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4'>
                {items.map((item) => (
                  <li key={item.id}>
                    <MenuItemCard item={item} onOpen={() => setSelected(item)} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <p className='pt-10 text-center text-xs text-ink-subtle'>
          Please tell a member of staff about any allergies before ordering. Prices include tax.
        </p>
      </main>

      <ItemSheet item={selected} onOpenChange={(open) => !open && setSelected(null)} />
      <CartBar />
    </>
  );
}
