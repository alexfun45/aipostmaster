// aipostmaster_bot
import 'dotenv/config'
import telegraf from 'telegraf';

const { Telegraf, Markup, session } = telegraf;
const STATES = {
  
}

const bot = new Telegraf(process?.env?.TELEGRAM_BOT_TOKEN || "");

bot.start((ctx) => ctx.reply("Добро пожаловать в ИИ-бот автопостинга"));

bot.launch();

