import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const connectionString = process.env.DATABASE_URL;

// تكوين الاتصال مع Pooling
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
});

export const db = drizzle(client, { schema });

// دالة إنشاء الفهارس لتحسين الأداء
export async function createIndexes() {
  try {
    await client`
      CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
      CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_is_reel ON posts(is_reel) WHERE is_reel = true;
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
      CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
      CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_calls_caller_receiver ON calls(caller_id, receiver_id);
    `;
    console.log('✅ Indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
}