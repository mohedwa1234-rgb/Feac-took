import Groq from 'groq-sdk';
import { storage } from './storage';

async function getGroqClientForUser(userId: number): Promise<{ client: Groq; keyId: number }> {
  const key = await storage.getActiveGroqKey(userId);
  if (!key) {
    throw new Error('لا يوجد مفتاح Groq نشط. الرجاء إضافة مفتاح.');
  }
  const client = new Groq({ apiKey: key.key });
  return { client, keyId: key.id };
}

export async function generateAITranslation(
  text: string,
  targetLanguage: string,
  userId: number
): Promise<string> {
  try {
    const { client, keyId } = await getGroqClientForUser(userId);
    const completion = await client.chat.completions.create({
      messages: [
        { role: 'system', content: `أنت مترجم محترف. ترجم النص التالي إلى ${targetLanguage} بدقة.` },
        { role: 'user', content: text }
      ],
      model: 'llama3-8b-8192',
      temperature: 0.3,
      max_tokens: 4000
    });
    await storage.incrementGroqKeyUsage(keyId);
    return completion.choices[0]?.message?.content || text;
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error('فشلت الترجمة');
  }
}

export async function translatePage(
  html: string,
  targetLanguage: string,
  userId: number
): Promise<string> {
  try {
    const { client, keyId } = await getGroqClientForUser(userId);
    const completion = await client.chat.completions.create({
      messages: [
        { role: 'system', content: `أنت مترجم محترف. ترجم النص التالي إلى ${targetLanguage} مع الحفاظ على علامات HTML.` },
        { role: 'user', content: html }
      ],
      model: 'llama3-8b-8192',
      temperature: 0.3,
      max_tokens: 8000
    });
    await storage.incrementGroqKeyUsage(keyId);
    return completion.choices[0]?.message?.content || html;
  } catch (error) {
    console.error('Page translation error:', error);
    return html;
  }
}

export async function generateAIPost(
  prompt: string,
  userId: number
): Promise<string> {
  try {
    const { client, keyId } = await getGroqClientForUser(userId);
    const completion = await client.chat.completions.create({
      messages: [
        { role: 'system', content: 'أنشئ منشوراً جذاباً لوسائل التواصل الاجتماعي بناءً على المدخلات.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama3-8b-8192',
      temperature: 0.7,
      max_tokens: 500
    });
    await storage.incrementGroqKeyUsage(keyId);
    return completion.choices[0]?.message?.content || prompt;
  } catch (error) {
    console.error('Post generation error:', error);
    return prompt;
  }
}

export async function analyzeSentiment(
  text: string,
  userId: number
): Promise<string> {
  try {
    const { client, keyId } = await getGroqClientForUser(userId);
    const completion = await client.chat.completions.create({
      messages: [
        { role: 'system', content: 'حلل المشاعر في النص التالي وأجب بكلمة واحدة فقط: positive, negative, أو neutral' },
        { role: 'user', content: text }
      ],
      model: 'llama3-8b-8192',
      temperature: 0.3,
      max_tokens: 10
    });
    await storage.incrementGroqKeyUsage(keyId);
    return completion.choices[0]?.message?.content?.toLowerCase() || 'neutral';
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return 'neutral';
  }
}

export async function generateVoiceDubbing(
  text: string,
  targetLanguage: string,
  voiceId?: string
): Promise<Buffer> {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is required for voice dubbing');
  }
  try {
    const selectedVoiceId = voiceId || (targetLanguage === 'ar' ? '21m00Tcm4TlvDq8ikWAM' : 'EXAVITQu4vr4xnSDxMaL');
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      })
    });
    if (!response.ok) throw new Error(`ElevenLabs error: ${response.statusText}`);
    const audioBuffer = await response.arrayBuffer();
    return Buffer.from(audioBuffer);
  } catch (error) {
    console.error('Voice dubbing error:', error);
    throw error;
  }
}