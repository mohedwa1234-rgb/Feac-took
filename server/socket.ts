import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { storage } from './storage';
import { generateAITranslation } from './ai-service';

let io: Server;
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
    console.log('🟢 متصل:', socket.id);

    socket.on('register-user', (userId: number) => {
      userSockets.set(userId, socket.id);
      socket.join(`user-${userId}`);
    });

    socket.on('start-call', async (data) => {
      try {
        const { callerId, receiverId, callType, sourceLanguage, targetLanguage, useAITranslation } = data;
        const callerCredits = await storage.getUserCredits(callerId);
        if (callerCredits < 10) {
          socket.emit('call-error', { message: 'رصيد غير كافٍ' });
          return;
        }
        const call = await storage.createCall({
          callerId, receiverId, callType, status: 'initiated',
          aiTranslated: useAITranslation, sourceLanguage, targetLanguage, startedAt: new Date()
        });
        const callId = call.id;
        activeCalls.set(callId, { ...data, socketId: socket.id, startTime: Date.now(), callId });
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('incoming-call', { callId, callerId, callType, sourceLanguage, targetLanguage, useAITranslation });
        }
        socket.emit('call-initiated', { callId });
      } catch (error) {
        console.error('خطأ في بدء المكالمة:', error);
        socket.emit('call-error', { message: 'فشل في بدء المكالمة' });
      }
    });

    socket.on('accept-call', async (data) => {
      const { callId, receiverId } = data;
      const call = activeCalls.get(callId);
      if (call) {
        await storage.updateCall(callId, { status: 'accepted' });
        const callerSocketId = userSockets.get(call.callerId);
        if (callerSocketId) {
          io.to(callerSocketId).emit('call-accepted', { callId, receiverId, socketId: socket.id });
        }
        socket.join(`call-${callId}`);
        const callerSocket = io.sockets.sockets.get(callerSocketId);
        if (callerSocket) callerSocket.join(`call-${callId}`);
        startCallBilling(callId, call.callerId);
      }
    });

    socket.on('reject-call', async (data) => {
      const { callId } = data;
      const call = activeCalls.get(callId);
      if (call) {
        await storage.updateCall(callId, { status: 'rejected', endedAt: new Date() });
        const callerSocketId = userSockets.get(call.callerId);
        if (callerSocketId) io.to(callerSocketId).emit('call-rejected', { callId });
        activeCalls.delete(callId);
      }
    });

    socket.on('end-call', async (data) => {
      const { callId } = data;
      const call = activeCalls.get(callId);
      if (call) {
        const duration = Math.floor((Date.now() - call.startTime) / 1000);
        const minutes = Math.ceil(duration / 60);
        const cost = minutes * 10;
        try {
          await storage.deductCredits(call.callerId, cost, `مكالمة ${call.callType} لمدة ${minutes} دقيقة`);
        } catch (error) {
          console.error('فشل خصم النقاط:', error);
        }
        await storage.updateCall(callId, { status: 'ended', endedAt: new Date(), duration, cost });
        io.to(`call-${callId}`).emit('call-ended', { callId, duration, cost });
        const room = io.sockets.adapter.rooms.get(`call-${callId}`);
        if (room) {
          for (const sid of room) {
            const sock = io.sockets.sockets.get(sid);
            if (sock) sock.leave(`call-${callId}`);
          }
        }
        activeCalls.delete(callId);
      }
    });

    socket.on('translate-audio', async (data) => {
      try {
        const { callId, audioData, targetLanguage } = data;
        // تحتاج userId حقيقي هنا، مؤقتاً نستخدم 1
        const translatedText = await generateAITranslation(audioData, targetLanguage, 1);
        socket.to(`call-${callId}`).emit('translated-audio', { callId, translatedText, targetLanguage });
      } catch (error) {
        console.error('خطأ في ترجمة الصوت:', error);
      }
    });

    socket.on('call-signal', (data) => {
      const targetSocketId = userSockets.get(data.targetId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call-signal', { callId: data.callId, signal: data.signal, from: socket.id });
      }
    });

    socket.on('private-message', async (data) => {
      try {
        const message = await storage.createMessage({
          senderId: data.senderId,
          receiverId: data.receiverId,
          content: data.content,
          mediaUrl: data.mediaUrl,
          createdAt: new Date()
        });
        const receiverSocketId = userSockets.get(data.receiverId);
        if (receiverSocketId) io.to(receiverSocketId).emit('new-message', message);
        socket.emit('message-sent', message);
      } catch (error) {
        console.error('خطأ في إرسال الرسالة:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔴 قطع الاتصال:', socket.id);
      for (const [callId, call] of activeCalls.entries()) {
        if (call.socketId === socket.id || call.receiverSocketId === socket.id) {
          io.to(`call-${callId}`).emit('call-ended', { callId, reason: 'disconnected' });
          activeCalls.delete(callId);
        }
      }
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

function startCallBilling(callId: number, userId: number) {
  let minutes = 0;
  const interval = setInterval(async () => {
    minutes++;
    const call = activeCalls.get(callId);
    if (!call) {
      clearInterval(interval);
      return;
    }
    try {
      await storage.deductCredits(userId, 10, `تكلفة مكالمة ${callId} - ${minutes} دقيقة`);
      io.to(`call-${callId}`).emit('call-billing', { callId, minutes, cost: minutes * 10 });
    } catch (error) {
      io.to(`call-${callId}`).emit('call-ended', { callId, reason: 'insufficient_credits', message: 'نفذ الرصيد' });
      clearInterval(interval);
    }
  }, 60000);
}