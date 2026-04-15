import { Composer } from 'telegraf';
import type { botContext } from '../types/types.ts'
import {BotState} from '../types/types.ts'
import telegraf from 'telegraf';

const postModule = new Composer<botContext>();
const { Telegraf, Markup, session } = telegraf;

postModule.hears('📝 Создать пост', async (ctx) => {
  ctx.session.state = BotState.AWAITING_POST_TEXT;
  ctx.session.draft = { selectedPlatforms: [] };
  
  await ctx.reply('Пришлите текст поста или просто идею, а я помогу её оформить. ✨');
});

// 2. Получение текста и предложение выбрать площадки
postModule.on('message', async (ctx, next) => {
  if (ctx.session.state !== BotState.AWAITING_POST_TEXT || !('text' in ctx.message)) {
    return next();
  }

  ctx.session.draft.rawText = ctx.message.text;
  ctx.session.state = BotState.IDLE; // Сбрасываем стейт ввода

  const platforms = ctx.session.platforms?.filter(p => p.isActive) || [];

  if (platforms.length === 0) {
    return ctx.reply('⚠️ У вас нет активных площадок. Сначала настройте и запустите их в меню настроек.');
  }

  const buttons = platforms.map(p => [
    Markup.button.callback(`[ ] ${p.type}: ${p.title}`, `toggle_post_plt_${p.internalId}`)
  ]);
  
  buttons.push([Markup.button.callback('🚀 Далее (Генерация ИИ)', 'process_ai_start')]);

  await ctx.reply('Текст получен! Теперь выберите площадки для публикации:', Markup.inlineKeyboard(buttons));
});

export default postModule;