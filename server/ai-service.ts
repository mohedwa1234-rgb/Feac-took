import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
});

// ترجمة النصوص
export async function generateAITranslation(
  text: string, 
  targetLanguage: string,
  modelSize: '8B' | '70B' = '8B'
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set, returning original text');
    return text;
  }

  try {
    const model = modelSize === '8B' ? 'gpt-3.5-turbo' : 'gpt-4';
    
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `أنت مترجم محترف. ترجم النص التالي إلى ${
            targetLanguage === 'ar' ? 'العربية' : 'الإنجليزية'
          } بدقة واحترافية.`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });
    
    return response.choices[0].message.content || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}

// إنشاء منشور بالذكاء الاصطناعي
export async function generateAIPost(prompt: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return prompt;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "أنشئ منشوراً جذاباً ومناسباً لوسائل التواصل الاجتماعي بناء على المدخلات التالية."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    });
    
    return response.choices[0].message.content || prompt;
  } catch (error) {
    console.error('Post generation error:', error);
    return prompt;
  }
}

// تحليل المشاعر
export async function analyzeSentiment(text: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return 'neutral';
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "حلل المشاعر في النص التالي وأجب بكلمة واحدة فقط: positive, negative, أو neutral"
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 10
    });
    
    return response.choices[0].message.content?.toLowerCase() || 'neutral';
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return 'neutral';
  }
}

// دالة دبلجة الصوت (تحويل النص إلى كلام باستخدام ElevenLabs)
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
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    return Buffer.from(audioBuffer);
  } catch (error) {
    console.error('Voice dubbing error:', error);
    throw error;
  }
}