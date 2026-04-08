import { Telegraf } from 'telegraf';
import {SocialPlatform, PostContent, IPoster} from '../types/types.ts'

export class TelegramPoster implements IPoster {
  platform = SocialPlatform.TELEGRAM;
  private bot: Telegraf;

  constructor(token: string) {
    this.bot = new Telegraf(token);
  }

  async post(content: PostContent): Promise<boolean> {
    try {
      if (content.imageUrl) {
        await this.bot.telegram.sendPhoto(process.env.TG_CHANNEL_ID!, content.imageUrl, {
          caption: content.text,
          parse_mode: 'Markdown'
        });
      } else {
        await this.bot.telegram.sendMessage(process.env.TG_CHANNEL_ID!, content.text, {
          parse_mode: 'Markdown'
        });
      }
      return true;
    } catch (e) {
      console.error('TG Post Error:', e);
      return false;
    }
  }
}