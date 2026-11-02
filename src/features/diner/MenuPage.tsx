import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, CATEGORY_LABELS, type Category, type MenuItem } from '@shared/schemas';
import { cn } from '@/lib/cn';
import { useConfig, useMenu } from '@/lib/queries';
import { EmptyState, Skeleton } from '@/ui/Display';
import { CartBar } from './CartBar';
import { useDiner } from './DinerLayout';
import { ItemSheet } from './ItemSheet';
import { FeaturedCard, MenuItemCard } from './MenuItemCard';

const HEADER_OFFSET = 64 + 56; // site header + category bar

export function MenuPage() {
  const { table } = useDiner();
  const { data: config } = useConfig();
  const { data: menu, isLoading } = useMenu();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('starters');
  const sectionRefs = useRef<Partial<Record<Category, HTMLElement | null>>>({});
  const navRef = useRef<HTMLDivElement>(null);

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
  const featured = (menu ?? []).filter((m) => m.featured && m.available);

  // Scroll-spy: highlight the category whose section is under the sticky bar.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveCategory(visible[0].target.getAttribute('data-category') as Category);
      },
      { rootMargin: `-${HEADER_OFFSET + 8}px 0px -60% 0px` },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [sections.length, q]);

  // Keep the active chip in view inside the horizontally scrolling bar.
  useEffect(() => {
    navRef.current
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
      <main className='mx-auto max-w-5xl pb-36'>
        {/* Hero */}
        <section className='px-4 pt-8 pb-6 sm:px-6 sm:pt-12'>
          <p className='text-sm font-medium tracking-wide text-accent uppercase'>{table.label}</p>
          <h1 className='mt-2 font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl'>
            Good food,
            <br className='sm:hidden' /> straight to your table.
          </h1>
          <p className='mt-3 max-w-xl text-[15px] text-ink-muted sm:text-base'>
            Order whenever you’re ready — everything goes straight to the {config?.restaurantName ?? 'kitchen'} kitchen, and you
            can follow it live.
          </p>
        </section>

        {/* Chef's picks */}
        {!q && featured.length > 0 && (
          <section aria-labelledby='featured-heading' className='pb-4'>
            <h2 id='featured-heading' className='px-4 font-display text-xl font-semibold sm:px-6'>
              Chef’s picks
            </h2>
            <div className='no-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 sm:scroll-px-6 sm:px-6'>
              {featured.map((item) => (
                <FeaturedCard key={item.id} item={item} onOpen={() => setSelected(item)} />
              ))}
            </div>
          </section>
        )}

        {/* Category bar */}
        <div className='sticky top-16 z-20 border-b border-line/70 bg-canvas/90 backdrop-blur-xl'>
          <div className='flex h-14 items-center gap-2 px-4 sm:px-6'>
            {searchOpen ? (
              <div className='relative flex-1'>
                <Search className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle' />
                <input
                  autoFocus
                  type='search'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Search dishes, drinks, “vegan”…'
                  aria-label='Search the menu'
                  className='h-10 w-full rounded-full border border-line-strong bg-surface pr-4 pl-9 text-[15px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/15'
                />
              </div>
            ) : (
              <nav ref={navRef} aria-label='Menu sections' className='no-scrollbar -mx-1 flex flex-1 gap-1 overflow-x-auto px-1'>
                {sections.map(({ category }) => (
                  <button
                    key={category}
                    type='button'
                    data-chip={category}
                    onClick={() => jumpTo(category)}
                    aria-current={activeCategory === category ? 'true' : undefined}
                    className={cn(
                      'pressable h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-150',
                      activeCategory === category ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    {CATEGORY_LABELS[category]}
                  </button>
                ))}
              </nav>
            )}
            <button
              type='button'
              onClick={() => {
                setSearchOpen((v) => !v);
                setQuery('');
              }}
              aria-label={searchOpen ? 'Close search' : 'Search the menu'}
              className='pressable inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink'
            >
              {searchOpen ? <X className='size-5' /> : <Search className='size-5' />}
            </button>
          </div>
        </div>

        {/* Sections */}
        {isLoading ? (
          <div className='grid gap-3 px-4 pt-6 sm:grid-cols-2 sm:px-6'>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className='h-32' />
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
              className='px-4 pt-8 sm:px-6'
            >
              <h2 id={`cat-${category}`} className='font-display text-2xl font-semibold tracking-tight'>
                {CATEGORY_LABELS[category]}
              </h2>
              <ul className='mt-4 grid gap-3 sm:grid-cols-2'>
                {items.map((item) => (
                  <li key={item.id}>
                    <MenuItemCard item={item} onOpen={() => setSelected(item)} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <p className='px-4 pt-10 text-center text-xs text-ink-subtle sm:px-6'>
          Please tell a member of staff about any allergies before ordering. Prices include tax.
        </p>
      </main>

      <ItemSheet item={selected} onOpenChange={(open) => !open && setSelected(null)} />
      <CartBar />
    </>
  );
}
