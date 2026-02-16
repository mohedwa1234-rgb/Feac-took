import { eq, and, or, desc, sql, inArray } from 'drizzle-orm';
import { db } from './db';
import { 
  users, posts, comments, likes, follows, apiKeys, transactions, calls, messages, notifications, aiModels,
  type User, type NewUser, type Post, type Comment, type ApiKey, type Call, type Message, type Follow, type Notification,
  MASTER_VALIDATION_KEY
} from '@shared/schema';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { randomBytes } from 'crypto';

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // ========== المستخدمين ==========
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: NewUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  
  // ========== المنشورات ==========
  createPost(userId: number, data: Partial<Post>): Promise<Post>;
  getPost(id: number): Promise<Post | undefined>;
  getPosts(limit?: number, offset?: number): Promise<Post[]>;
  getReels(limit?: number, offset?: number): Promise<Post[]>;
  updatePost(id: number, data: Partial<Post>): Promise<Post>;
  deletePost(id: number): Promise<void>;
  
  // ========== الإعجابات ==========
  likePost(userId: number, postId: number): Promise<void>;
  unlikePost(userId: number, postId: number): Promise<void>;
  isLiked(userId: number, postId: number): Promise<boolean>;
  
  // ========== التعليقات ==========
  createComment(userId: number, postId: number, content: string): Promise<Comment>;
  getComments(postId: number): Promise<Comment[]>;
  deleteComment(id: number): Promise<void>;
  
  // ========== العلاقات (أصدقاء / متابعة) ==========
  followUser(followerId: number, followingId: number): Promise<void>;
  unfollowUser(followerId: number, followingId: number): Promise<void>;
  getFollowers(userId: number): Promise<User[]>;
  getFollowing(userId: number): Promise<User[]>;
  areFriends(userId1: number, userId2: number): Promise<boolean>;
  
  // ========== مفاتيح API ==========
  createApiKey(userId: number, name: string, price: number): Promise<ApiKey>;
  getApiKeys(userId: number): Promise<ApiKey[]>;
  getAllApiKeys(): Promise<ApiKey[]>;
  getApiKey(key: string): Promise<ApiKey | undefined>;
  validateApiKey(key: string): Promise<boolean>;
  useApiKey(key: string): Promise<void>;
  
  // ========== نظام النقاط ==========
  addCredits(userId: number, amount: number, description: string): Promise<User>;
  deductCredits(userId: number, amount: number, description: string): Promise<User>;
  getUserCredits(userId: number): Promise<number>;
  getTransactions(userId: number): Promise<Transaction[]>;
  
  // ========== المكالمات ==========
  createCall(data: Partial<Call>): Promise<Call>;
  updateCall(id: number, data: Partial<Call>): Promise<Call>;
  getCall(id: number): Promise<Call | undefined>;
  
  // ========== الرسائل ==========
  createMessage(data: Partial<Message>): Promise<Message>;
  getMessagesBetween(userId1: number, userId2: number): Promise<Message[]>;
  markMessagesAsRead(userId: number, senderId: number): Promise<void>;
  
  // ========== الإشعارات ==========
  createNotification(data: Partial<Notification>): Promise<Notification>;
  getNotifications(userId: number, limit?: number): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<void>;
  
  // ========== التحقق السيادي ==========
  validateMasterKey(key: string): boolean;
  
  // ========== جلسات ==========
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production'
      },
      createTableIfMissing: true
    });
  }

  // ========== المستخدمين ==========
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(insertUser: NewUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      credits: 300,
      createdAt: new Date()
    }).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const [user] = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // ========== المنشورات ==========
  async createPost(userId: number, data: Partial<Post>): Promise<Post> {
    const [post] = await db.insert(posts).values({
      userId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return post;
  }

  async getPost(id: number): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post;
  }

  async getPosts(limit: number = 20, offset: number = 0): Promise<Post[]> {
    return await db.select()
      .from(posts)
      .where(eq(posts.isReel, false))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getReels(limit: number = 10, offset: number = 0): Promise<Post[]> {
    return await db.select()
      .from(posts)
      .where(eq(posts.isReel, true))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async updatePost(id: number, data: Partial<Post>): Promise<Post> {
    const [post] = await db.update(posts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    return post;
  }

  async deletePost(id: number): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  }

  // ========== الإعجابات ==========
  async likePost(userId: number, postId: number): Promise<void> {
    await db.transaction(async (tx) => {
      // إضافة الإعجاب
      await tx.insert(likes).values({ userId, postId, createdAt: new Date() });
      
      // زيادة عداد الإعجابات في المنشور
      await tx.update(posts)
        .set({ likesCount: sql`${posts.likesCount} + 1` })
        .where(eq(posts.id, postId));
    });
  }

  async unlikePost(userId: number, postId: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(likes)
        .where(and(eq(likes.userId, userId), eq(likes.postId, postId)));
      
      await tx.update(posts)
        .set({ likesCount: sql`${posts.likesCount} - 1` })
        .where(eq(posts.id, postId));
    });
  }

  async isLiked(userId: number, postId: number): Promise<boolean> {
    const [like] = await db.select()
      .from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.postId, postId)));
    return !!like;
  }

  // ========== التعليقات ==========
  async createComment(userId: number, postId: number, content: string): Promise<Comment> {
    return await db.transaction(async (tx) => {
      const [comment] = await tx.insert(comments).values({
        userId,
        postId,
        content,
        createdAt: new Date()
      }).returning();
      
      await tx.update(posts)
        .set({ commentsCount: sql`${posts.commentsCount} + 1` })
        .where(eq(posts.id, postId));
      
      return comment;
    });
  }

  async getComments(postId: number): Promise<Comment[]> {
    return await db.select()
      .from(comments)
      .where(eq(comments.postId, postId))
      .orderBy(desc(comments.createdAt));
  }

  async deleteComment(id: number): Promise<void> {
    await db.delete(comments).where(eq(comments.id, id));
  }

  // ========== العلاقات ==========
  async followUser(followerId: number, followingId: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.insert(follows).values({
        followerId,
        followingId,
        status: 'accepted',
        createdAt: new Date()
      });
      
      await tx.update(users)
        .set({ followingCount: sql`${users.followingCount} + 1` })
        .where(eq(users.id, followerId));
      
      await tx.update(users)
        .set({ followersCount: sql`${users.followersCount} + 1` })
        .where(eq(users.id, followingId));
    });
  }

  async unfollowUser(followerId: number, followingId: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(follows)
        .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
      
      await tx.update(users)
        .set({ followingCount: sql`${users.followingCount} - 1` })
        .where(eq(users.id, followerId));
      
      await tx.update(users)
        .set({ followersCount: sql`${users.followersCount} - 1` })
        .where(eq(users.id, followingId));
    });
  }

  async getFollowers(userId: number): Promise<User[]> {
    const followers = await db.select({
      follower: users
    })
    .from(follows)
    .where(eq(follows.followingId, userId))
    .innerJoin(users, eq(follows.followerId, users.id));
    
    return followers.map(f => f.follower);
  }

  async getFollowing(userId: number): Promise<User[]> {
    const following = await db.select({
      following: users
    })
    .from(follows)
    .where(eq(follows.followerId, userId))
    .innerJoin(users, eq(follows.followingId, users.id));
    
    return following.map(f => f.following);
  }

  async areFriends(userId1: number, userId2: number): Promise<boolean> {
    const [follow] = await db.select()
      .from(follows)
      .where(
        or(
          and(eq(follows.followerId, userId1), eq(follows.followingId, userId2)),
          and(eq(follows.followerId, userId2), eq(follows.followingId, userId1))
        )
      );
    return !!follow;
  }

  // ========== مفاتيح API ==========
  async createApiKey(userId: number, name: string, price: number): Promise<ApiKey> {
    const key = `ft_${randomBytes(32).toString('hex')}`;
    const [apiKey] = await db.insert(apiKeys).values({
      userId,
      name,
      key,
      price,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 يوم
    }).returning();
    return apiKey;
  }

  async getApiKeys(userId: number): Promise<ApiKey[]> {
    return await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async getAllApiKeys(): Promise<ApiKey[]> {
    return await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.isActive, true))
      .orderBy(desc(apiKeys.createdAt));
  }

  async getApiKey(key: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.key, key));
    return apiKey;
  }

  async validateApiKey(key: string): Promise<boolean> {
    const apiKey = await this.getApiKey(key);
    if (!apiKey || !apiKey.isActive) return false;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return false;
    if (apiKey.usage >= apiKey.limit) return false;
    return true;
  }

  async useApiKey(key: string): Promise<void> {
    await db.update(apiKeys)
      .set({ usage: sql`${apiKeys.usage} + 1` })
      .where(eq(apiKeys.key, key));
  }

  // ========== نظام النقاط ==========
  async addCredits(userId: number, amount: number, description: string): Promise<User> {
    return await db.transaction(async (tx) => {
      const [user] = await tx.select().from(users)
        .where(eq(users.id, userId))
        .for('update');
      
      if (!user) throw new Error('المستخدم غير موجود');

      const [updatedUser] = await tx.update(users)
        .set({ credits: sql`${users.credits} + ${amount}` })
        .where(eq(users.id, userId))
        .returning();
      
      await tx.insert(transactions).values({
        userId,
        type: 'credit_add',
        amount,
        description,
        createdAt: new Date()
      });
      
      return updatedUser;
    });
  }

  async deductCredits(userId: number, amount: number, description: string): Promise<User> {
    return await db.transaction(async (tx) => {
      const [user] = await tx.select().from(users)
        .where(eq(users.id, userId))
        .for('update');
      
      if (!user) throw new Error('المستخدم غير موجود');
      if (user.credits < amount) throw new Error('رصيد غير كافٍ');
      
      const [updatedUser] = await tx.update(users)
        .set({ credits: sql`${users.credits} - ${amount}` })
        .where(eq(users.id, userId))
        .returning();
      
      await tx.insert(transactions).values({
        userId,
        type: 'credit_deduct',
        amount: -amount,
        description,
        createdAt: new Date()
      });
      
      return updatedUser;
    });
  }

  async getUserCredits(userId: number): Promise<number> {
    const user = await this.getUser(userId);
    return user?.credits || 0;
  }

  async getTransactions(userId: number): Promise<Transaction[]> {
    return await db.select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  // ========== المكالمات ==========
  async createCall(data: Partial<Call>): Promise<Call> {
    const [call] = await db.insert(calls).values({
      ...data,
      createdAt: new Date()
    }).returning();
    return call;
  }

  async updateCall(id: number, data: Partial<Call>): Promise<Call> {
    const [call] = await db.update(calls)
      .set(data)
      .where(eq(calls.id, id))
      .returning();
    return call;
  }

  async getCall(id: number): Promise<Call | undefined> {
    const [call] = await db.select().from(calls).where(eq(calls.id, id));
    return call;
  }

  // ========== الرسائل ==========
  async createMessage(data: Partial<Message>): Promise<Message> {
    const [message] = await db.insert(messages).values({
      ...data,
      createdAt: new Date()
    }).returning();
    return message;
  }

  async getMessagesBetween(userId1: number, userId2: number): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(
        or(
          and(eq(messages.senderId, userId1), eq(messages.receiverId, userId2)),
          and(eq(messages.senderId, userId2), eq(messages.receiverId, userId1))
        )
      )
      .orderBy(messages.createdAt);
  }

  async markMessagesAsRead(userId: number, senderId: number): Promise<void> {
    await db.update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.senderId, senderId), eq(messages.receiverId, userId)));
  }

  // ========== الإشعارات ==========
  async createNotification(data: Partial<Notification>): Promise<Notification> {
    const [notification] = await db.insert(notifications).values({
      ...data,
      createdAt: new Date()
    }).returning();
    return notification;
  }

  async getNotifications(userId: number, limit: number = 20): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  // ========== التحقق السيادي ==========
  validateMasterKey(key: string): boolean {
    return key === MASTER_VALIDATION_KEY;
  }
}

export const storage = new DatabaseStorage();