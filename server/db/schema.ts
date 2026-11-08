import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#cbd5e1'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
})

export const dailyItems = sqliteTable('daily_items', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'),
  date: text('date').notNull(),
  type: text('type').notNull().default('task'),
  title: text('title').notNull(),
  isCompleted: integer('is_completed').notNull().default(0),
  categoryId: text('category_id').default('uncategorized'),
  estimatedSessions: integer('estimated_sessions').notNull().default(4),
  completedSessions: integer('completed_sessions').notNull().default(0),
  loggedSeconds: integer('logged_seconds').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
})
