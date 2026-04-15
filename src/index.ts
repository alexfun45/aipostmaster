// aisocpostmaster_bot
import 'dotenv/config'
import telegraf from 'telegraf';
import { Redis } from '@telegraf/session/redis';
//import { initRedis } from './services/redis.service.ts';
import {BotState} from './types/types.ts'
import type { botSession, botContext } from './types/types.js';
import { createClient } from 'redis';
import {setupModule} from './handlers/setup.ts'

const { Telegraf, Markup, session } = telegraf;

const getMainMenu = () => {
  return Markup.keyboard([
    ['📝 Создать пост', '⚙️ Настроить площадки'],
    ['📊 Активные рассылки', '🆘 Помощь']
  ]).resize();
};

//const connectedClient = await initRedis(); 
const connectedClient = createClient();
const store = Redis({
    client: connectedClient,
    ttl: 0
    } 
  );

const bot = new Telegraf<botContext>(process?.env?.TELEGRAM_BOT_TOKEN || "");
bot.use(session({ 
  store,
  getSessionKey: (ctx) => {
    if (ctx.from) {
      return `${ctx.from.id}:${ctx.from.id}`;
    }
    return null;
  },
  defaultSession: () => ({ 
    state: BotState.IDLE,
    platforms: []
  }) 
}));

// подключение модуля настройки соцсетей
bot.use(setupModule)

bot.start((ctx) => ctx.reply("Добро пожаловать в ИИ-бот автопостинга", getMainMenu()));

bot.hears('📝 Создать пост', async (ctx: botContext) => {
  ctx.session.state = BotState.AWAITING_POST_TEXT;
  ctx.session.draft = { platform: 'TELEGRAM' };
  await ctx.reply('Введите текст поста (или отправьте идею, а я её адаптирую):');
});

bot.launch();


bot.on('message', async (ctx: botContext) => {
  const state = ctx.session.state;

  // 1. Обработка ввода ID канала
  if (state === BotState.AWAITING_CHANNEL_ID) {
    let channelId: string | undefined;

    // Проверяем, переслано ли сообщение или просто текст
    if ('forward_from_chat' in ctx?.message && ctx.message.forward_from_chat) {
      channelId = ctx.message.forward_from_chat?.id.toString();
    } else if ('text' in ctx.message) {
      channelId = ctx.message.text;
    }

    if (channelId && (channelId.startsWith('-100') || channelId.startsWith('@'))) {
      // Сохраняем в Redis через сессию
      ctx.session.draft = {
        ...ctx.session.draft,
        targetId: channelId,
        platform: 'TELEGRAM'
      };
      
      ctx.session.state = BotState.IDLE;
      await ctx.reply(`✅ Канал ${channelId} успешно привязан! Теперь вы можете создавать посты.`, getMainMenu());
    } else {
      await ctx.reply('❌ Некорректный формат. Отправьте ID (например, -100123456789) или перешлите сообщение из канала.');
    }
    return;
  }

  // 2. Обработка текста для поста
  if (state === BotState.AWAITING_POST_TEXT && 'text' in ctx?.message) {
    ctx.session.draft = { ...ctx.session.draft, text: ctx.message.text, platform: 'TG' };
    ctx.session.state = BotState.IDLE; // Временно сбрасываем, пока не настроим Gemini
    
    await ctx.reply(
      `📝 Текст получен!\n\n${ctx.message.text}\n\nЖелаете отправить его прямо сейчас или дать ИИ его улучшить?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Опубликовать как есть', 'publish_now')],
        [Markup.button.callback('🤖 Улучшить через ИИ', 'ai_refine')]
      ])
    );
    return;
  }
});

