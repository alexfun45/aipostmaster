// aipostmaster_bot
import 'dotenv/config'
import telegraf from 'telegraf';
import { Redis } from '@telegraf/session/redis';
import { initRedis } from './services/redis.service.ts';
import {BotState} from './types/types.ts'
import type { botSession, botContext } from './types/types.js';

const { Telegraf, Markup, session } = telegraf;
const STATES = {
  
}

const getMainMenu = () => {
  return Markup.keyboard([
    ['📝 Создать пост', '⚙️ Настроить площадки'],
    ['📊 Активные рассылки', '🆘 Помощь']
  ]).resize();
};

const getPlatformMenu = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Telegram (Активно)', 'setup_tg')],
    [Markup.button.callback('VK (Скоро)', 'setup_vk')],
    [Markup.button.callback('Instagram (Скоро)', 'setup_inst')]
  ]);
};

const connectedClient = await initRedis(); 
const store = Redis({
    client: connectedClient
    } 
  );

const bot = new Telegraf<botContext>(process?.env?.TELEGRAM_BOT_TOKEN || "");

bot.start((ctx) => ctx.reply("Добро пожаловать в ИИ-бот автопостинга", getMainMenu()));

bot.hears('📝 Создать пост', async (ctx: botContext) => {
  ctx.session.state = BotState.AWAITING_POST_TEXT;
  ctx.session.draft = { platform: 'TG' };
  await ctx.reply('Введите текст поста (или отправьте идею, а я её адаптирую):');
});

bot.hears('⚙️ Настроить площадки', setup);

bot.launch();

function setup(ctx: botContext){
  
}

