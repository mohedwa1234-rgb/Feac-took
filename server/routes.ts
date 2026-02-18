import express from 'express';
import { storage } from './storage';
import { insertUserSchema, insertGroqKeySchema } from '@shared/schema';
import { z } from 'zod';
import { generateAITranslation, translatePage, generateAIPost, analyzeSentiment, generateVoiceDubbing } from './ai-service';
import { authenticateToken, isAdmin, hashPassword } from './auth';
import passport from 'passport';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: true,
  },
};

const router = express.Router();

// تكوين multer لرفع الملفات
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_multer,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'));
    }
  }
});

// ========== المصادقة ==========
router.post('/api/register', async (req, res) => {
  try {
    const userData = insertUserSchema.parse(req.body);
    
    const existingUser = await storage.getUserByUsername(userData.username);
    if (existingUser) {
      return res.status(400).json({ message: 'اسم المستخدم موجود بالفعل' });
    }
    
    const existingEmail = await storage.getUserByEmail(userData.email);
    if (existingEmail) {
      return res.status(400).json({ message: 'البريد الإلكتروني موجود بالفعل' });
    }
    
    const hashedPassword = await hashPassword(userData.password);
    
    const user = await storage.createUser({
      ...userData,
      password: hashedPassword
    });
    
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'خطأ في تسجيل الدخول' });
      }
      return res.status(201).json({ 
        message: 'تم التسجيل بنجاح',
        user: { ...user, password: undefined }
      });
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'بيانات غير صالحة', errors: error.errors });
    } else {
      console.error(error);
      res.status(500).json({ message: 'خطأ في الخادم' });
    }
  }
});

router.post('/api/login', (req, res, next) => {
  passport.authenticate('local', (err: any, user: any, info: any) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || 'فشل تسجيل الدخول' });
    
    req.login(user, (err) => {
      if (err) return next(err);
      return res.json({ 
        message: 'تم تسجيل الدخول بنجاح',
        user: { ...user, password: undefined }
      });
    });
  })(req, res, next);
});

router.post('/api/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ message: 'خطأ في تسجيل الخروج' });
    res.json({ message: 'تم تسجيل الخروج بنجاح' });
  });
});

router.get('/api/me', authenticateToken, (req, res) => {
  res.json({ user: { ...req.user, password: undefined } });
});

// ========== المستخدمين ==========
router.get('/api/users/:id', async (req, res) => {
  try {
    const user = await storage.getUser(parseInt(req.params.id));
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب المستخدم' });
  }
});

router.put('/api/users/profile', authenticateToken, upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'cover', maxCount: 1 }
]), async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { fullName, bio } = req.body;
    
    const updateData: any = { fullName, bio };
    
    if (req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (files.avatar) {
        updateData.avatar = `/uploads/${files.avatar[0].filename}`;
      }
      if (files.cover) {
        updateData.coverPhoto = `/uploads/${files.cover[0].filename}`;
      }
    }
    
    const updatedUser = await storage.updateUser(userId, updateData);
    res.json({ user: { ...updatedUser, password: undefined } });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في تحديث الملف الشخصي' });
  }
});

// ========== المنشورات ==========
router.post('/api/posts', authenticateToken, upload.single('media'), async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { content, isReel } = req.body;
    
    const postData: any = {
      content,
      isReel: isReel === 'true'
    };
    
    if (req.file) {
      const file = req.file;
      const isVideo = file.mimetype.startsWith('video/');
      postData.mediaUrl = `/uploads/${file.filename}`;
      postData.mediaType = isVideo ? 'video' : 'image';
      if (isVideo) {
        postData.duration = 30;
      }
    }
    
    const post = await storage.createPost(userId, postData);
    res.status(201).json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في إنشاء المنشور' });
  }
});

router.get('/api/posts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const posts = await storage.getPosts(limit, offset);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب المنشورات' });
  }
});

router.get('/api/reels', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const reels = await storage.getReels(limit, offset);
    res.json(reels);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب الريلز' });
  }
});

router.post('/api/posts/:id/like', authenticateToken, async (req: any, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;
    
    const isLiked = await storage.isLiked(userId, postId);
    if (isLiked) {
      await storage.unlikePost(userId, postId);
      res.json({ liked: false });
    } else {
      await storage.likePost(userId, postId);
      res.json({ liked: true });
    }
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الإعجاب' });
  }
});

// ========== التعليقات ==========
router.post('/api/posts/:id/comments', authenticateToken, async (req: any, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;
    const { content } = req.body;
    
    const comment = await storage.createComment(userId, postId, content);
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في إضافة التعليق' });
  }
});

router.get('/api/posts/:id/comments', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const comments = await storage.getComments(postId);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب التعليقات' });
  }
});

// ========== العلاقات ==========
router.post('/api/follow/:userId', authenticateToken, async (req: any, res) => {
  try {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.userId);
    
    if (followerId === followingId) {
      return res.status(400).json({ message: 'لا يمكنك متابعة نفسك' });
    }
    
    await storage.followUser(followerId, followingId);
    res.json({ message: 'تمت المتابعة بنجاح' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في المتابعة' });
  }
});

router.delete('/api/follow/:userId', authenticateToken, async (req: any, res) => {
  try {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.userId);
    
    await storage.unfollowUser(followerId, followingId);
    res.json({ message: 'تم إلغاء المتابعة' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في إلغاء المتابعة' });
  }
});

// ========== مفاتيح Groq ==========
router.post('/api/groq-keys', authenticateToken, async (req: any, res) => {
  try {
    const { name, type, key } = req.body;
    const userId = req.user.id;
    
    if (!name || !type || !key) {
      return res.status(400).json({ message: 'الاسم والنوع والمفتاح مطلوبون' });
    }

    if (type !== 'free' && type !== 'paid') {
      return res.status(400).json({ message: 'نوع المفتاح غير صالح' });
    }
    
    const count = await storage.countUserGroqKeys(userId);
    if (count >= 10) {
      return res.status(400).json({ message: 'لا يمكن إضافة أكثر من 10 مفاتيح' });
    }
    
    const groqKey = await storage.createGroqKey(userId, name, type, key);
    
    const points = type === 'free' ? 400 : 2000;
    await storage.addCredits(userId, points, `إضافة مفتاح ${type === 'free' ? 'مجاني' : 'مدفوع'}`);
    
    res.status(201).json(groqKey);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في إضافة المفتاح' });
  }
});

router.get('/api/groq-keys', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const keys = await storage.getGroqKeys(userId);
    res.json(keys);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب المفاتيح' });
  }
});

router.delete('/api/groq-keys/:id', authenticateToken, async (req: any, res) => {
  try {
    const keyId = parseInt(req.params.id);
    const userId = req.user.id;
    const key = await storage.getGroqKeyById(keyId);
    if (!key || key.userId !== userId) {
      return res.status(404).json({ message: 'المفتاح غير موجود' });
    }
    await storage.deactivateGroqKey(keyId);
    res.json({ message: 'تم تعطيل المفتاح' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في حذف المفتاح' });
  }
});

// ========== نظام النقاط ==========
router.get('/api/credits', authenticateToken, async (req: any, res) => {
  try {
    const credits = await storage.getUserCredits(req.user.id);
    res.json({ credits });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب الرصيد' });
  }
});

router.get('/api/credits-info', authenticateToken, async (req: any, res) => {
  const lang = req.user.language || 'ar';
  const info = {
    ar: {
      callPerMinute: 'مكالمة مدبلجة: 10 نقاط/الدقيقة',
      videoDubbing: 'دبلجة فيديو كامل: 10 نقاط',
      translation: 'ترجمة نص: 3 نقاط',
      freeKey: 'إضافة مفتاح مجاني: +400 نقطة',
      paidKey: 'إضافة مفتاح مدفوع: +2000 نقطة'
    },
    en: {
      callPerMinute: 'Dubbed call: 10 credits/minute',
      videoDubbing: 'Full video dubbing: 10 credits',
      translation: 'Text translation: 3 credits',
      freeKey: 'Add free key: +400 credits',
      paidKey: 'Add paid key: +2000 credits'
    }
  };
  res.json(info[lang] || info.ar);
});

router.get('/api/transactions', authenticateToken, async (req: any, res) => {
  try {
    const transactions = await storage.getTransactions(req.user.id);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب المعاملات' });
  }
});

// ========== ترجمة النصوص ==========
router.post('/api/translate', authenticateToken, async (req: any, res) => {
  try {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ message: 'النص واللغة مطلوبان' });
    }

    await storage.deductCredits(req.user.id, 3, `ترجمة نص إلى ${targetLanguage}`);

    const translatedText = await generateAITranslation(text, targetLanguage, req.user.id);
    res.json({ translatedText });
  } catch (error: any) {
    if (error.message === 'رصيد غير كافٍ') {
      res.status(400).json({ message: 'رصيد غير كافٍ للترجمة' });
    } else {
      res.status(500).json({ message: error.message || 'خطأ في الترجمة' });
    }
  }
});

router.post('/api/translate-page', authenticateToken, async (req: any, res) => {
  try {
    const { html, targetLanguage } = req.body;
    if (!html || !targetLanguage) {
      return res.status(400).json({ message: 'النص واللغة مطلوبان' });
    }

    await storage.deductCredits(req.user.id, 10, `ترجمة صفحة كاملة إلى ${targetLanguage}`);

    const translatedHtml = await translatePage(html, targetLanguage, req.user.id);
    res.json({ translatedHtml });
  } catch (error: any) {
    if (error.message === 'رصيد غير كافٍ') {
      res.status(400).json({ message: 'رصيد غير كافٍ' });
    } else {
      res.status(500).json({ message: error.message || 'خطأ في الترجمة' });
    }
  }
});

router.post('/api/generate-post', authenticateToken, async (req: any, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ message: 'الموضوع مطلوب' });
    }

    await storage.deductCredits(req.user.id, 5, 'إنشاء منشور بالذكاء الاصطناعي');

    const post = await generateAIPost(prompt, req.user.id);
    res.json({ post });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'خطأ في إنشاء المنشور' });
  }
});

router.post('/api/analyze-sentiment', authenticateToken, async (req: any, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ message: 'النص مطلوب' });
    }

    await storage.deductCredits(req.user.id, 2, 'تحليل مشاعر');

    const sentiment = await analyzeSentiment(text, req.user.id);
    res.json({ sentiment });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'خطأ في التحليل' });
  }
});

// ========== دبلجة الفيديو ==========
router.post('/api/dub-video', authenticateToken, upload.single('video'), async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { targetLanguage } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'الرجاء رفع فيديو' });
    }

    await storage.deductCredits(userId, 10, `دبلجة فيديو إلى ${targetLanguage}`);

    const videoUrl = `/uploads/${req.file.filename}`;
    const job = await storage.createVideoDubbingJob(userId, videoUrl, targetLanguage);

    res.json({ message: 'تم استلام الفيديو وجاري معالجته', jobId: job.id });
  } catch (error: any) {
    if (error.message === 'رصيد غير كافٍ') {
      res.status(400).json({ message: 'رصيد غير كافٍ لدبلجة الفيديو' });
    } else {
      res.status(500).json({ message: error.message || 'خطأ في دبلجة الفيديو' });
    }
  }
});

router.get('/api/dub-jobs', authenticateToken, async (req: any, res) => {
  try {
    const jobs = await storage.getVideoDubbingJobs(req.user.id);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب المهام' });
  }
});

// ========== دبلجة الصوت ==========
router.post('/api/dub-to-speech', authenticateToken, async (req, res) => {
  try {
    const { text, language } = req.body;
    if (!text || !language) {
      return res.status(400).json({ message: 'النص واللغة مطلوبان' });
    }
    const audioBuffer = await generateVoiceDubbing(text, language);
    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ========== الإشعارات ==========
router.get('/api/notifications', authenticateToken, async (req: any, res) => {
  try {
    const notifications = await storage.getNotifications(req.user.id);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب الإشعارات' });
  }
});

router.post('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await storage.markNotificationAsRead(parseInt(req.params.id));
    res.json({ message: 'تم تحديث الإشعار' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في تحديث الإشعار' });
  }
});

// ========== مسارات الإدارة ==========
router.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const masterKey = req.headers['x-master-key'];
    if (!storage.validateMasterKey(masterKey as string)) {
      return res.status(403).json({ message: 'غير مصرح' });
    }
    const users = await storage.getAllUsers();
    const safeUsers = users.map(({ password, ...rest }) => rest);
    res.json(safeUsers);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب المستخدمين' });
  }
});

router.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const masterKey = req.headers['x-master-key'];
    if (!storage.validateMasterKey(masterKey as string)) {
      return res.status(403).json({ message: 'غير مصرح' });
    }
    const users = await storage.getAllUsers();
    const totalUsers = users.length;
    const totalCredits = users.reduce((sum, u) => sum + u.credits, 0);
    const activeUsers = users.filter(u => u.isActive).length;
    res.json({ totalUsers, totalCredits, activeUsers });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب الإحصائيات' });
  }
});

router.post('/api/admin/users/:userId/toggle', authenticateToken, isAdmin, async (req, res) => {
  try {
    const masterKey = req.headers['x-master-key'];
    if (!storage.validateMasterKey(masterKey as string)) {
      return res.status(403).json({ message: 'غير مصرح' });
    }
    const userId = parseInt(req.params.userId);
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    await storage.updateUser(userId, { isActive: !user.isActive });
    res.json({ message: 'تم تحديث حالة المستخدم' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في تحديث المستخدم' });
  }
});

router.post('/api/admin/credits/:userId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const masterKey = req.headers['x-master-key'];
    if (!storage.validateMasterKey(masterKey as string)) {
      return res.status(403).json({ message: 'غير مصرح' });
    }
    const userId = parseInt(req.params.userId);
    const { amount, description } = req.body;
    await storage.addCredits(userId, amount, description || 'إضافة من الإدارة');
    res.json({ message: 'تم إضافة الرصيد بنجاح' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في إضافة الرصيد' });
  }
});

// خدمة الملفات الثابتة
router.use('/uploads', express.static('uploads'));

export default router;