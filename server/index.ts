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
    maxAge: 1000 * 60 * 60 * 24 * 7, // أسبوع
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

// CORS للتطوير
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
}

// المسارات
app.use(routes);

// خدمة الملفات الثابتة في الإنتاج
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}

// تهيئة Socket.io
initializeSocket(httpServer);

// بدء الخادم
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // إنشاء فهارس قاعدة البيانات
  try {
    await createIndexes();
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
});