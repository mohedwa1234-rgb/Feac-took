import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { createServer } from 'http';
import { storage } from './storage';
import { setupAuth } from './auth';
import routes from './routes';
import { initializeSocket } from './socket';
import { createIndexes } from './db';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// إعداد الجلسات
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  store: storage.sessionStore,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

// إعداد Passport
app.use(passport.initialize());
app.use(passport.session());
setupAuth(passport);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS للتطوير - مهم جداً لـ Render
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-master-key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// المسارات
app.use('/api', routes);

// خدمة الملفات الثابتة - مهم جداً
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// في الإنتاج، خدمة ملفات الواجهة الأمامية
if (process.env.NODE_ENV === 'production') {
  // خدمة الملفات الثابتة من مجلد dist
  const clientDistPath = path.join(__dirname, '../public');
  app.use(express.static(clientDistPath));
  
  // أي مسار آخر يعيد index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// تهيئة Socket.io
initializeSocket(httpServer);

// تصدير التطبيق لـ Vercel/Render
export default app;

// بدء الخادم فقط إذا لم يكن في بيئة Render/Vercel
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    try {
      await createIndexes();
    } catch (error) {
      console.error('❌ Error creating indexes:', error);
    }
  });
}