// src/services/imageAi.service.ts
import axios from 'axios';
const IS_DEBUG_MODE = true;

// Тестовая картинка (например, логотип Node.js или любая стабильная ссылка)
const TEST_IMAGE_URL = 'https://picsum.photos/seed/picsum/800/600';
const TEST_TEXT = 'This is a test post generated in Debug Mode without spending tokens.';

export class ImageAiService {
  private apiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1/chat/completions";

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || ''; // Или отдельный ключ для OpenRouter
  }

  async generateImage(prompt: string): Promise<string | Buffer> {
  
    if (IS_DEBUG_MODE) {
      console.log(`[AI Mock] Generating image for prompt: ${prompt} (Debug Mode)`);
      // В режиме отладки мы возвращаем URL, а не Buffer.
      // Это потребует небольшого изменения в postModule.ts (см. Шаг 2)
      return TEST_IMAGE_URL; 
    }
    try {

      const response = await axios.post(
        this.baseUrl,
        {
          model: 'google/gemini-3.1-flash-image-preview', // Та самая Nano Banana 2
          messages: [
            {
              role: "user",
              content: `Generate an image based on this description: ${prompt}`
            }
          ],
          modalities: ['image', 'text']
        },
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "X-OpenRouter-Title": "Autoposting Bot",
          }
        }
      );

      const message = response.data.choices?.[0]?.message;
      if (message?.images && message.images.length > 0) {
        const base64Data = message.images[0].image_url.url;
        
        const base64Content = base64Data.split(',')[1];
        return Buffer.from(base64Content, 'base64');
      }

      throw new Error('Изображение не найдено в ответе модели');
    } catch (error) {
      console.error('Image AI Generation Error:', error);
      throw new Error('Не удалось сгенерировать изображение.');
    }
  }
}