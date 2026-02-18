import { pgTable, serial, text, integer, timestamp, boolean, jsonb, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const MASTER_VALIDATION_KEY = "GENERAL_EYE_ONLY_VALIDATION_STRING";

// جدول المستخدمين
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password: text('password').notNull(),
  fullName: varchar('full_name', { length: 100 }),
  bio: text('bio'),
  avatar: text('avatar'),
  coverPhoto: text('cover_photo'),
  credits: integer('credits').default(100).notNull(),
  role: varchar('role', { length: 20 }).default('user').notNull(),
  language: varchar('language', { length: 2 }).default('ar').notNull(),
  isActive: boolean('is_active').default(true),
  isVerified: boolean('is_verified').default(false),
  followersCount: integer('followers_count').default(0),
  followingCount: integer('following_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  lastLogin: timestamp('last_login'),
  metadata: jsonb('metadata').default({})
});

// جدول العلاقات (متابعة)
export const follows = pgTable('follows', {
  id: serial('id').primaryKey(),
  followerId: integer('follower_id').references(() => users.id, { onDelete: 'cascade' }),
  followingId: integer('following_id').references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).default('pending'),
  createdAt: timestamp('created_at').defaultNow()
});

// جدول المنشورات
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  content: text('content'),
  mediaUrl: text('media_url'),
  mediaType: varchar('media_type', { length: 10 }),
  thumbnailUrl: text('thumbnail_url'),
  isReel: boolean('is_reel').default(false),
  duration: integer('duration'),
  likesCount: integer('likes_count').default(0),
  commentsCount: integer('comments_count').default(0),
  sharesCount: integer('shares_count').default(0),
  viewsCount: integer('views_count').default(0),
  language: varchar('language', { length: 2 }).default('ar'),
  isAIGenerated: boolean('ai_generated').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// جدول الإعجابات
export const likes = pgTable('likes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  postId: integer('post_id').references(() => posts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow()
});

// جدول التعليقات
export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  postId: integer('post_id').references(() => posts.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  mediaUrl: text('media_url'),
  likesCount: integer('likes_count').default(0),
  language: varchar('language', { length: 2 }).default('ar'),
  isAITranslated: boolean('ai_translated').default(false),
  createdAt: timestamp('created_at').defaultNow()
});

// جدول مفاتيح Groq (لكل مستخدم 10 خانات)
export const groqKeys = pgTable('groq_keys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  key: text('key').notNull(), // مفتاح Groq API
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 10 }).default('free').notNull(), // 'free' or 'paid'
  points: integer('points').default(400), // النقاط الممنوحة (400 مجاني، 2000 مدفوع)
  isActive: boolean('is_active').default(true),
  usageCount: integer('usage_count').default(0),
  monthlyLimit: integer('monthly_limit'), // حد الاستخدام الشهري (اختياري)
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'), // تاريخ انتهاء المفتاح المجاني
  lastUsed: timestamp('last_used')
});

// جدول المكالمات
export const calls = pgTable('calls', {
  id: serial('id').primaryKey(),
  callerId: integer('caller_id').references(() => users.id, { onDelete: 'cascade' }),
  receiverId: integer('receiver_id').references(() => users.id, { onDelete: 'cascade' }),
  callType: varchar('call_type', { length: 10 }).notNull(),
  status: varchar('status', { length: 20 }).default('initiated'),
  duration: integer('duration').default(0),
  cost: integer('cost').default(0),
  aiTranslated: boolean('ai_translated').default(false),
  sourceLanguage: varchar('source_language', { length: 2 }),
  targetLanguage: varchar('target_language', { length: 2 }),
  modelUsed: varchar('model_used', { length: 50 }),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow()
});

// جدول طلبات دبلجة الفيديو
export const videoDubbingJobs = pgTable('video_dubbing_jobs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  videoUrl: text('video_url').notNull(),
  targetLanguage: varchar('target_language', { length: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  cost: integer('cost').default(10),
  resultUrl: text('result_url'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at')
});

// جدول المعاملات
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  amount: integer('amount').notNull(),
  description: text('description'),
  reference: text('reference'),
  createdAt: timestamp('created_at').defaultNow()
});

// جدول الإشعارات
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  actorId: integer('actor_id').references(() => users.id),
  postId: integer('post_id').references(() => posts.id),
  content: text('content'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow()
});

// دوال التحقق
export const insertUserSchema = createInsertSchema(users).extend({
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  email: z.string().email('البريد الإلكتروني غير صالح'),
  username: z.string().min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل').max(50)
});

export const insertPostSchema = createInsertSchema(posts);
export const insertCommentSchema = createInsertSchema(comments);
export const insertGroqKeySchema = createInsertSchema(groqKeys).omit({ userId: true, usageCount: true, lastUsed: true });
export const insertCallSchema = createInsertSchema(calls);
export const insertVideoDubbingSchema = createInsertSchema(videoDubbingJobs);

// أنواع TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type GroqKey = typeof groqKeys.$inferSelect;
export type NewGroqKey = typeof groqKeys.$inferInsert;
export type Call = typeof calls.$inferSelect;
export type VideoDubbingJob = typeof videoDubbingJobs.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Follow = typeof follows.$inferSelect;