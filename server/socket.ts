import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { storage } from './storage';
import { generateAITranslation } from './ai-service';

let io: Server;

// تخزين جلسات المكالمات النشطة
const activeCalls = new Map();
const userSockets = new Map();

export function initializeSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.CLIENT_URL 
        : 'http://localhost:5173',
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('🟢 مستخدم متصل:', socket.id);

    // تسجيل المستخدم
    socket.on('register-user', (userId: number) => {
      userSockets.set(userId, socket.id);
      socket.join(`user-${userId}`);
      console.log(`👤 مستخدم ${userId} مسجل`);
    });

    // بدء مكالمة
    socket.on('start-call', async (data: {
      callerId: number,
      receiverId: number,
      callType: 'audio' | 'video',
      sourceLanguage?: string,
      targetLanguage?: string,
      useAITranslation: boolean
    }) => {
      try {
        const { callerId, receiverId, callType, sourceLanguage, targetLanguage, useAITranslation } = data;

        // التحقق من الرصيد (5 نقاط للدقيقة)
        const callerCredits = await storage.getUserCredits(callerId);
        if (callerCredits < 5) {
          socket.emit('call-error', { message: 'رصيد غير كافٍ للمكالمة' });
          return;
        }

        // إنشاء سجل المكالمة
        const call = await storage.createCall({
          callerId,
          receiverId,
          callType,
          status: 'initiated',
          aiTranslated: useAITranslation,
          sourceLanguage,
          targetLanguage,
          startedAt: new Date()
        });

        const callId = call.id;
        activeCalls.set(callId, {
          ...data,
          socketId: socket.id,
          startTime: Date.now(),
          callId
        });

        // إرسال طلب المكالمة للمستقبل
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('incoming-call', {
            callId,
            callerId,
            callType,
            sourceLanguage,
            targetLanguage,
            useAITranslation
          });
        }

        socket.emit('call-initiated', { callId });
      } catch (error) {
        console.error('خطأ في بدء المكالمة:', error);
        socket.emit('call-error', { message: 'فشل في بدء المكالمة' });
      }
    });

    // قبول المكالمة
    socket.on('accept-call', async (data: { callId: number, receiverId: number }) => {
      const { callId, receiverId } = data;
      const call = activeCalls.get(callId);

      if (call) {
        await storage.updateCall(callId, { status: 'accepted' });

        // إشعار المتصل
        const callerSocketId = userSockets.get(call.callerId);
        if (callerSocketId) {
          io.to(callerSocketId).emit('call-accepted', {
            callId,
            receiverId,
            socketId: socket.id
          });
        }

        // إنشاء غرفة خاصة للمكالمة
        const roomName = `call-${callId}`;
        socket.join(roomName);
        
        const callerSocket = io.sockets.sockets.get(callerSocketId);
        if (callerSocket) {
          callerSocket.join(roomName);
        }

        // بدء عد التكلفة
        startCallBilling(callId, call.callerId);
      }
    });

    // رفض المكالمة
    socket.on('reject-call', async (data: { callId: number }) => {
      const { callId } = data;
      const call = activeCalls.get(callId);

      if (call) {
        await storage.updateCall(callId, { status: 'rejected', endedAt: new Date() });

        const callerSocketId = userSockets.get(call.callerId);
        if (callerSocketId) {
          io.to(callerSocketId).emit('call-rejected', { callId });
        }

        activeCalls.delete(callId);
      }
    });

    // إنهاء المكالمة
    socket.on('end-call', async (data: { callId: number }) => {
      const { callId } = data;
      const call = activeCalls.get(callId);

      if (call) {
        const duration = Math.floor((Date.now() - call.startTime) / 1000); // بالثواني
        const minutes = Math.ceil(duration / 60);
        const cost = minutes * 5; // 5 نقاط لكل دقيقة

        // خصم النقاط
        try {
          await storage.deductCredits(call.callerId, cost, `مكالمة ${call.callType} لمدة ${minutes} دقيقة`);
        } catch (error) {
          console.error('فشل خصم النقاط:', error);
        }

        await storage.updateCall(callId, { 
          status: 'ended', 
          endedAt: new Date(),
          duration,
          cost
        });

        // إشعار جميع الأطراف
        io.to(`call-${callId}`).emit('call-ended', { callId, duration, cost });

        // مغادرة الغرفة
        const room = io.sockets.adapter.rooms.get(`call-${callId}`);
        if (room) {
          for (const socketId of room) {
            const sock = io.sockets.sockets.get(socketId);
            if (sock) sock.leave(`call-${callId}`);
          }
        }

        activeCalls.delete(callId);
      }
    });

    // ترجمة صوتية فورية (WebRTC + AI)
    socket.on('translate-audio', async (data: {
      callId: number,
      audioData: string,
      sourceLanguage: string,
      targetLanguage: string
    }) => {
      try {
        const { callId, audioData, sourceLanguage, targetLanguage } = data;

        // استخدام نموذج 8B للترجمة
        const translatedText = await generateAITranslation(audioData, targetLanguage, '8B');

        // إرسال الترجمة للمستقبل
        socket.to(`call-${callId}`).emit('translated-audio', {
          callId,
          translatedText,
          targetLanguage
        });
      } catch (error) {
        console.error('خطأ في ترجمة الصوت:', error);
      }
    });

    // إرسال إشارات WebRTC (للـ Peer-to-Peer)
    socket.on('call-signal', (data: { callId: number, signal: any, targetId: number }) => {
      const targetSocketId = userSockets.get(data.targetId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call-signal', {
          callId: data.callId,
          signal: data.signal,
          from: socket.id
        });
      }
    });

    // رسالة خاصة
    socket.on('private-message', async (data: {
      senderId: number,
      receiverId: number,
      content: string,
      mediaUrl?: string
    }) => {
      try {
        const message = await storage.createMessage({
          senderId: data.senderId,
          receiverId: data.receiverId,
          content: data.content,
          mediaUrl: data.mediaUrl,
          createdAt: new Date()
        });

        const receiverSocketId = userSockets.get(data.receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('new-message', message);
        }

        socket.emit('message-sent', message);
      } catch (error) {
        console.error('خطأ في إرسال الرسالة:', error);
      }
    });

    // قطع الاتصال
    socket.on('disconnect', () => {
      console.log('🔴 مستخدم قطع الاتصال:', socket.id);
      
      // إنهاء جميع مكالمات المستخدم
      for (const [callId, call] of activeCalls.entries()) {
        if (call.socketId === socket.id || call.receiverSocketId === socket.id) {
          io.to(`call-${callId}`).emit('call-ended', { callId, reason: 'disconnected' });
          activeCalls.delete(callId);
        }
      }

      // إزالة المستخدم من الخريطة
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          break;
        }
      }
    });
  });

  return io;
}

// دالة حساب التكلفة كل دقيقة
function startCallBilling(callId: number, userId: number) {
  let minutes = 0;
  const interval = setInterval(async () => {
    minutes++;
    const call = activeCalls.get(callId);
    
    if (!call) {
      clearInterval(interval);
      return;
    }

    // خصم 5 نقاط كل دقيقة
    if (minutes % 1 === 0) { // كل دقيقة حقيقية (60 ثانية)
      try {
        await storage.deductCredits(userId, 5, `تكلفة مكالمة ${callId} - ${minutes} دقيقة`);
        io.to(`call-${callId}`).emit('call-billing', {
          callId,
          minutes,
          cost: minutes * 5
        });
      } catch (error) {
        // إذا نفذ الرصيد، أنهي المكالمة
        io.to(`call-${callId}`).emit('call-ended', {
          callId,
          reason: 'insufficient_credits',
          message: 'نفذ الرصيد، تم إنهاء المكالمة'
        });
        clearInterval(interval);
      }
    }
  }, 60000); // كل دقيقة

  return interval;
}