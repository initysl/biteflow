PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`type` text DEFAULT 'dine_in' NOT NULL,
	`source` text DEFAULT 'qr' NOT NULL,
	`table_id` text,
	`customer_name` text,
	`staff_id` text,
	`status` text NOT NULL,
	`notes` text,
	`subtotal_cents` integer NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer NOT NULL,
	`promo_code` text,
	`payment_method` text NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`payment_ref` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`preparing_at` text,
	`ready_at` text,
	`served_at` text,
	`paid_at` text,
	`completed_at` text,
	FOREIGN KEY (`table_id`) REFERENCES `restaurant_tables`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `staff_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "number", "table_id", "status", "notes", "subtotal_cents", "discount_cents", "total_cents", "promo_code", "payment_method", "payment_status", "payment_ref", "created_at", "preparing_at", "ready_at", "served_at", "paid_at", "completed_at") SELECT "id", "number", "table_id", "status", "notes", "subtotal_cents", "discount_cents", "total_cents", "promo_code", "payment_method", "payment_status", "payment_ref", "created_at", "preparing_at", "ready_at", "served_at", "paid_at", "completed_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_unique` ON `orders` (`number`);--> statement-breakpoint
CREATE INDEX `orders_table_idx` ON `orders` (`table_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
ALTER TABLE `staff_users` ADD `role` text DEFAULT 'manager' NOT NULL;