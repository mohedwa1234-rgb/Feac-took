import bcrypt from 'bcryptjs';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { storage } from './storage';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function setupAuth(passport: passport.PassportStatic) {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: 'اسم المستخدم غير صحيح' });
        }
        const isValid = await comparePasswords(password, user.password);
        if (!isValid) {
          return done(null, false, { message: 'كلمة المرور غير صحيحة' });
        }
        if (!user.isActive) {
          return done(null, false, { message: 'الحساب معطل' });
        }
        await storage.updateUser(user.id, { lastLogin: new Date() });
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );
}

export function authenticateToken(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'غير مصرح، الرجاء تسجيل الدخول' });
}

export function isAdmin(req: any, res: any, next: any) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'غير مصرح، صلاحيات مسؤول مطلوبة' });
}