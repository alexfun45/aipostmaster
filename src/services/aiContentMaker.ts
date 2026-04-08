import 'dotenv/config'
import { ChatOpenAI } from "@langchain/openai"
import { PromptTemplate } from '@langchain/core/prompts'
import {SocialPlatform} from '../types/types.ts'


export class AIContentService {
  private model: any;

  constructor(apiKey: string) {
    
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

  async adaptContent(originalText: string, platform: SocialPlatform): Promise<string> {

    const prompts = {
      [SocialPlatform.TELEGRAM]: "Сделай пост структурированным, используй эмодзи и Markdown.",
      [SocialPlatform.VK]: "Напиши пост в дружелюбном стиле, добавь призыв к обсуждению.",
      [SocialPlatform.INSTAGRAM]: "Сделай текст коротким, ярким, добавь 5-10 релевантных хештегов."
    };

    const template = PromptTemplate.fromTemplate(
      `Адаптируй этот текст для платформы: {platform}. Инструкция: {instruction}. context: {context}`
    );

   const result = await template.invoke({
      platform: platform,
      instruction: prompts[platform],
      context: originalText
   });
    
   return result.toString();
  }
}