import bcrypt from 'bcryptjs';
import { eq, ne } from 'drizzle-orm';
import { ulid } from 'ulid';
import type { DB } from '../db/client';
import { staffUsers } from '../db/schema';

export const OWNER_ID = 'owner';

/**
 * Keeps staff accounts in line with configuration on every boot:
 * - the first account is created from STAFF_DEMO_PIN;
 * - in demo mode that public PIN is always a plain `staff` account, so
 *   visitors can run service but never delete, replace or reset data;
 * - MANAGER_PIN, when set, owns a private `manager` account.
 */
export function syncStaffAccounts(db: DB, opts: { staffPin: string; managerPin?: string; demoMode: boolean }) {
  const others = db.select().from(staffUsers).where(ne(staffUsers.id, OWNER_ID)).all();

  if (others.length === 0) {
    db.insert(staffUsers)
      .values({
        id: ulid(),
        name: opts.demoMode ? 'Demo staff' : 'Manager',
        role: opts.demoMode ? 'staff' : 'manager',
        pinHash: bcrypt.hashSync(opts.staffPin, 10),
      })
      .run();
  } else if (opts.demoMode) {
    for (const u of others) {
      if (u.role !== 'staff' && bcrypt.compareSync(opts.staffPin, u.pinHash)) {
        db.update(staffUsers).set({ role: 'staff', name: 'Demo staff' }).where(eq(staffUsers.id, u.id)).run();
      }
    }
  }

  if (opts.managerPin) {
    const owner = db.select().from(staffUsers).where(eq(staffUsers.id, OWNER_ID)).get();
    if (!owner) {
      db.insert(staffUsers)
        .values({ id: OWNER_ID, name: 'Owner', role: 'manager', pinHash: bcrypt.hashSync(opts.managerPin, 10) })
        .run();
    } else if (owner.role !== 'manager' || !bcrypt.compareSync(opts.managerPin, owner.pinHash)) {
      db.update(staffUsers)
        .set({ role: 'manager', pinHash: bcrypt.hashSync(opts.managerPin, 10) })
        .where(eq(staffUsers.id, OWNER_ID))
        .run();
    }
  }
}
