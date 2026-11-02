import { expect, test, type Page } from '@playwright/test';

/**
 * The whole service loop across two browsers: a diner orders from their phone,
 * the kitchen and floor work it in the staff console, and both sides update live.
 */
test('diner order flows through kitchen, floor and bill in real time', async ({ browser, request }) => {
  const { tableId, token } = await (await request.get('/api/demo/table')).json();

  const staffCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const staff = await staffCtx.newPage();
  await staff.goto('/staff/login');
  await expect(staff.getByRole('heading', { name: 'Staff sign in' })).toBeVisible();
  await staff.keyboard.type('1234');
  await expect(staff).toHaveURL(/\/staff\/kitchen/);

  const dinerCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const diner = await dinerCtx.newPage();
  await diner.goto(`/t/${tableId}?k=${token}`);
  await expect(diner.getByRole('heading', { name: /Good food/ })).toBeVisible();

  // Diner builds and sends an order to pay later.
  await diner.getByRole('button', { name: 'View Classic Tiramisu' }).click();
  await diner.getByRole('button', { name: /Add to order/ }).click();
  await diner.getByRole('button', { name: 'Add House Mint Lemonade to order' }).click();
  await diner.getByRole('button', { name: /View order/ }).click();
  await diner.getByText('Pay later').click();
  await diner.getByRole('button', { name: 'Send order to kitchen' }).click();
  await expect(diner).toHaveURL(/\/orders$/);
  const orderHeading = diner.getByRole('heading', { name: /Order #\d+/ });
  await expect(orderHeading).toBeVisible();
  const number = (await orderHeading.textContent())!.match(/\d+/)![0];

  // Kitchen receives it live and works it.
  const ticket = staff.getByRole('article', { name: `Order ${number}, table ${tableId}` });
  await expect(ticket).toBeVisible();
  await ticket.getByRole('button', { name: 'Start' }).click();
  await expect(diner.getByText('The kitchen is cooking your order.')).toBeVisible();
  await staff
    .getByRole('article', { name: `Order ${number}, table ${tableId}` })
    .getByRole('button', { name: 'Mark ready' })
    .click();
  await expect(diner.getByText('Plated and on its way to your table.')).toBeVisible();

  // Diner calls for water; the floor sees it and resolves it.
  await callStaff(diner);
  await staff.getByRole('link', { name: /Floor/ }).first().click();
  const helpRow = staff.getByRole('listitem').filter({ hasText: `Table ${tableId} · Water` });
  await expect(helpRow).toBeVisible();
  await helpRow.getByRole('button', { name: 'Done' }).click();
  await expect(diner.getByRole('button', { name: 'Call staff', exact: true })).toBeVisible();

  // Serve, request the bill, take payment.
  await staff
    .getByRole('listitem')
    .filter({ hasText: `Run #${number}` })
    .getByRole('button', { name: 'Served' })
    .click();
  await diner.getByRole('button', { name: 'Request the bill' }).click();
  await diner.getByText('Split evenly').click();
  await diner.getByRole('dialog').getByRole('button', { name: 'Request the bill' }).click();
  await expect(diner.getByText('Bill requested — a server is on the way')).toBeVisible();

  const billRow = staff.getByRole('listitem').filter({ hasText: `Table ${tableId} wants the bill` });
  await expect(billRow).toBeVisible();
  await billRow.getByRole('button', { name: 'Take payment' }).click();
  await staff.getByRole('button', { name: /Mark .* as paid/ }).click();
  await expect(staff.getByText(`Table ${tableId} settled`)).toBeVisible();

  await expect(diner.getByText('Paid', { exact: true })).toBeVisible();
  await expect(diner.getByRole('button', { name: 'Receipt' })).toBeVisible();
});

async function callStaff(diner: Page) {
  await diner.getByRole('button', { name: 'Call staff', exact: true }).click();
  await diner.getByRole('button', { name: /^Water/ }).click();
  await expect(diner.getByRole('button', { name: /Help is on the way/ })).toBeVisible();
}

test('table links without a valid token are read-only', async ({ page }) => {
  await page.goto('/t/1');
  await expect(page.getByText('Scan the QR code on your table')).toBeVisible();
  await expect(page.getByRole('button', { name: /to order$/ })).toHaveCount(0);
});

test('staff console requires sign-in', async ({ page }) => {
  await page.goto('/staff/kitchen');
  await expect(page).toHaveURL(/\/staff\/login/);
  await page.keyboard.type('0000');
  await expect(page.getByText('That PIN didn’t match')).toBeVisible();
});
