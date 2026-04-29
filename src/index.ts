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
    ['📝 Создать пост', '📦 Массовое создание', '⚙️ Настроить площадки'],
    ['📊 Активные рассылки', '🆘 Помощь']
  ]).resize()
  .persistent();
};

//const connectedClient = await initRedis(); 
const connectedClient = createClient();
connectedClient.on('error', err => console.log('Redis Client Error', err));
connectedClient.on('connect', () => console.log('Redis Connected!'));
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

bot.use(async (ctx, next) => {
  console.log(`Получено сообщение: ${ctx.message?.text || ctx.callbackQuery?.data}`);
  console.log(`Текущий стейт: ${ctx.session?.state}`);
  return next();
});

bot.start(async (ctx) => {
  ctx.session.state = BotState.IDLE;
  await ctx.reply("Добро пожаловать в ИИ-бот автопостинга", getMainMenu());
})

startScheduler(bot, connectedClient as any);

// подключение модуля настройки соцсетей
bot.use(setupModule)
bot.use(postModule)
bot.launch();


