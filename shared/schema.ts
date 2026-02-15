import { pgTable, serial, text, integer, timestamp, boolean, jsonb, varchar, foreignKey } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// مفتاح التحقق السيادي
export const MASTER_VALIDATION_KEY = "GENERAL_EYE_ONLY_VALIDATION_STRING";

// جدول المستخدمين
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password: text('password').notNull(),
  fullName: varchar('full_name', { length: 100 }),
  bio: text('bio'),
  avatar: text('avatar'), // رابط الصورة الرمزية
  coverPhoto: text('cover_photo'),
  credits: integer('credits').default(300).notNull(),
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

// جدول العلاقات (متابعة / أصدقاء)
export const follows = pgTable('follows', {
  id: serial('id').primaryKey(),
  followerId: integer('follower_id').references(() => users.id, { onDelete: 'cascade' }),
  followingId: integer('following_id').references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'accepted', 'blocked'
  createdAt: timestamp('created_at').defaultNow()
});

// جدول المنشورات (صور / فيديو / نصوص)
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  content: text('content'),
  mediaUrl: text('media_url'), // رابط الصورة أو الفيديو
  mediaType: varchar('media_type', { length: 10 }), // 'image', 'video', 'none'
  thumbnailUrl: text('thumbnail_url'), // للفيديو
  isReel: boolean('is_reel').default(false), // إذا كان reel (فيديو قصير)
  duration: integer('duration'), // مدة الفيديو بالثواني
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
  mediaUrl: text('media_url'), // صورة أو فيديو في التعليق
  likesCount: integer('likes_count').default(0),
  language: varchar('language', { length: 2 }).default('ar'),
  isAITranslated: boolean('ai_translated').default(false),
  createdAt: timestamp('created_at').defaultNow()
});

// جدول مفاتيح API (للمطورين)
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  key: text('key').unique().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  price: integer('price').notNull(), // سعر المفتاح بالنقاط
  usage: integer('usage').default(0),
  limit: integer('limit').default(1000),
  isActive: boolean('is_active').default(true),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  permissions: jsonb('permissions').default({})
});

// جدول المعاملات (نظام النقاط)
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // 'credit_purchase', 'api_key_purchase', 'call_cost', 'reward'
  amount: integer('amount').notNull(),
  description: text('description'),
  reference: text('reference'), // مرجع مثل api_key_id أو call_id
  createdAt: timestamp('created_at').defaultNow()
});

// جدول المكالمات
export const calls = pgTable('calls', {
  id: serial('id').primaryKey(),
  callerId: integer('caller_id').references(() => users.id, { onDelete: 'cascade' }),
  receiverId: integer('receiver_id').references(() => users.id, { onDelete: 'cascade' }),
  callType: varchar('call_type', { length: 10 }).notNull(), // 'audio', 'video'
  status: varchar('status', { length: 20 }).default('initiated'), // 'initiated', 'accepted', 'rejected', 'ended'
  duration: integer('duration').default(0), // بالثواني
  cost: integer('cost').default(0), // التكلفة بالنقاط
  aiTranslated: boolean('ai_translated').default(false),
  sourceLanguage: varchar('source_language', { length: 2 }),
  targetLanguage: varchar('target_language', { length: 2 }),
  modelUsed: varchar('model_used', { length: 50 }), // '8B' أو غيره
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow()
});

// جدول الرسائل الخاصة
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  senderId: integer('sender_id').references(() => users.id, { onDelete: 'cascade' }),
  receiverId: integer('receiver_id').references(() => users.id, { onDelete: 'cascade' }),
  content: text('content'),
  mediaUrl: text('media_url'),
  mediaType: varchar('media_type', { length: 10 }),
  isRead: boolean('is_read').default(false),
  isAITranslated: boolean('ai_translated').default(false),
  createdAt: timestamp('created_at').defaultNow()
});

// جدول نماذج الذكاء الاصطناعي (8B إلخ)
export const aiModels = pgTable('ai_models', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  modelId: varchar('model_id', { length: 50 }).notNull(), // معرف النموذج في API
  provider: varchar('provider', { length: 50 }).notNull(), // 'openai', 'anthropic', 'local'
  parameters: varchar('parameters', { length: 10 }).default('8B'), // '8B', '70B'
  pricePerCall: integer('price_per_call').default(10), // سعر كل استخدام
  pricePerMinute: integer('price_per_minute').default(5), // سعر الدقيقة للمكالمات
  isActive: boolean('is_active').default(true),
  capabilities: jsonb('capabilities').default({}) // ['translation', 'sentiment', etc]
});

// جدول الإشعارات
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // 'like', 'comment', 'follow', 'call', 'message'
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
export const insertApiKeySchema = createInsertSchema(apiKeys);
export const insertCallSchema = createInsertSchema(calls);
export const insertMessageSchema = createInsertSchema(messages);

// أنواع TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type AIModel = typeof aiModels.$inferSelect;
