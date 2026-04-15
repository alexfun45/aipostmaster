// aisocpostmaster_bot
import 'dotenv/config'
import telegraf from 'telegraf';
import { Redis } from '@telegraf/session/redis';
//import { initRedis } from './services/redis.service.ts';
import {BotState} from './types/types.ts'
import type { botSession, botContext } from './types/types.js';
import { createClient } from 'redis';
import setupModule from './handlers/setup.ts'
import postModule from './handlers/posts.ts'
import {startScheduler} from './services/scheduler.service.ts'

const { Telegraf, Markup, session } = telegraf;

const getMainMenu = () => {
  return Markup.keyboard([
    ['📝 Создать пост', '⚙️ Настроить площадки'],
    ['📊 Активные рассылки', '🆘 Помощь']
  ]).resize();
};

//const connectedClient = await initRedis(); 
const connectedClient = createClient();
//await connectedClient.connect();
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

startScheduler(bot, connectedClient as any);

// подключение модуля настройки соцсетей
bot.use(setupModule)
bot.use(postModule)


bot.start((ctx) => ctx.reply("Добро пожаловать в ИИ-бот автопостинга", getMainMenu()));

/*
bot.hears('📝 Создать пост', async (ctx: botContext) => {
  ctx.session.state = BotState.AWAITING_POST_TEXT;
  ctx.session.draft = { platform: 'TELEGRAM' };
  await ctx.reply('Введите текст поста (или отправьте идею, а я её адаптирую):');
});
*/

bot.launch();


