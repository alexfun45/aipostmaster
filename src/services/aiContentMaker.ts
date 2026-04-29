import 'dotenv/config'
import { ChatOpenAI } from "@langchain/openai"
import { PromptTemplate } from '@langchain/core/prompts'
import {AvailableSocialPlatform} from '../types/types.ts'
import type {SocialPlatform} from '../types/types.ts'
import type {SocialPlatformType} from '../types/types.ts'


export class AIContentService {
  private model: any;

  constructor() {
    
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "http://localhost:3000", // Обязательно для OpenRouter
          "X-OpenRouter-Title": "Autoposting Content Project",
          'Content-Type': 'application/json',
        },
      },
      model: "google/gemini-3.1-flash-lite-preview", 
      temperature: 0.3,
    }); 
  }

  async adaptContent(originalText: string, platformType: AvailableSocialPlatform): Promise<string> {

    const instructions = {
      [AvailableSocialPlatform.TELEGRAM]: "Сделай пост структурированным, используй эмодзи и html. Сохраняй абзацы.",
      [AvailableSocialPlatform.VK]: "Напиши пост в дружелюбном стиле, добавь призыв к обсуждению в комментариях.",
      [AvailableSocialPlatform.INSTAGRAM]: "Сделай текст коротким, ярким, добавь 5-10 релевантных хештегов в конце."
    };

    const template = PromptTemplate.fromTemplate(
      `Ты — эксперт по SMM. Твоя задача адаптировать текст под конкретную соцсеть.
      Платформа: {platform}
      Инструкция: {instruction}
      
      Оригинальный текст:
      {context}
      
      Выдай только готовый текст поста без лишних пояснений.`
    );

    const chain = template.pipe(this.model);

    const result: any = await chain.invoke({
      platform: platformType,
      instruction: instructions[platformType],
      context: originalText
    });
    return result.content;
    }
}

export default AIContentService