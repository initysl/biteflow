import { asc, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { CATEGORIES, type MenuItem } from '../../shared/schemas';
import { type MenuItemInput, menuItemInputSchema } from '../../shared/validation';
import type { DB } from '../db/client';
import { menuItems } from '../db/schema';
import { notFound, parse } from '../http';

type MenuRow = typeof menuItems.$inferSelect;

export function toMenuItem({ createdAt: _createdAt, ...row }: MenuRow): MenuItem {
  return row;
}

export function listMenu(db: DB): MenuItem[] {
  const rows = db.select().from(menuItems).orderBy(asc(menuItems.sortOrder), asc(menuItems.name)).all();
  const categoryRank = (c: string) => CATEGORIES.indexOf(c as (typeof CATEGORIES)[number]);
  return rows.map(toMenuItem).sort((a, b) => categoryRank(a.category) - categoryRank(b.category));
}

export function createMenuItem(db: DB, input: MenuItemInput): MenuItem {
  const data = parse(menuItemInputSchema, input);
  const last = db.select({ sortOrder: menuItems.sortOrder }).from(menuItems).all();
  const sortOrder = last.reduce((max, r) => Math.max(max, r.sortOrder), 0) + 1;
  const row = db
    .insert(menuItems)
    .values({ id: ulid(), ...data, sortOrder })
    .returning()
    .get();
  return toMenuItem(row);
}

export function updateMenuItem(db: DB, id: string, input: Partial<MenuItemInput>): MenuItem {
  const data = parse(menuItemInputSchema.partial(), input);
  const row = db.update(menuItems).set(data).where(eq(menuItems.id, id)).returning().get();
  if (!row) throw notFound('Menu item');
  return toMenuItem(row);
}

export function deleteMenuItem(db: DB, id: string): void {
  const res = db.delete(menuItems).where(eq(menuItems.id, id)).run();
  if (res.changes === 0) throw notFound('Menu item');
}

export function replaceMenu(db: DB, items: MenuItemInput[]): MenuItem[] {
  const parsed = items.map((i) => parse(menuItemInputSchema, i));
  db.transaction((tx) => {
    tx.delete(menuItems).run();
    parsed.forEach((data, i) =>
      tx
        .insert(menuItems)
        .values({ id: ulid(), ...data, sortOrder: i })
        .run(),
    );
  });
  return listMenu(db);
}
