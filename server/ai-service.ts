import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
});

// ترجمة النصوص باستخدام نموذج 8B (افتراضي)
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
    // نستخدم نموذج GPT-3.5-turbo الذي يعادل تقريباً 8B
    const model = modelSize === '8B' ? 'gpt-3.5-turbo' : 'gpt-4';
    
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `أنت مترجم محترف. ترجم النص التالي إلى ${
            targetLanguage === 'ar' ? 'العربية' : 'الإنجليزية'
          } بدقة واحترافية. حافظ على المعنى والسياق.`
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
      model: "gpt-3.5-turbo", // 8B
      messages: [
        {
          role: "system",
          content: "أنشئ منشوراً جذاباً ومناسباً لوسائل التواصل الاجتماعي بناء على المدخلات التالية. استخدم لغة مهذبة وجذابة."
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

// تحليل المشاعر في النص
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