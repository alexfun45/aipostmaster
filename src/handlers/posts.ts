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

const getFrequencyMenu = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎯 Единоразово', 'freq_ONCE')],
    [Markup.button.callback('⏳ Через промежуток', 'freq_INTERVAL')],
    [Markup.button.callback('📅 Раз в день', 'freq_DAILY')],
    [Markup.button.callback('🗓 Раз в неделю', 'freq_WEEKLY')],
    [Markup.button.callback('🌕 Раз в месяц', 'freq_MONTHLY')],
    [Markup.button.callback('⬅️ Назад', 'back_to_platforms')]
  ]);
};

postModule.action(/^freq_(.+)$/, async (ctx) => {
  const freq = ctx.match[1];
  ctx.session.draft.frequency = freq;
  await ctx.answerCbQuery();

  if (freq === 'ONCE') {
    return ctx.reply('🚀 Пост будет отправлен сразу после генерации. Переходим к ИИ?', 
      Markup.inlineKeyboard([[Markup.button.callback('🤖 Генерировать', 'process_ai_start')]]));
  }

  ctx.session.state = BotState.AWAITING_POST_DATETIME;
  await ctx.reply(
    '📅 Укажите дату и время первого запуска в формате:\n' +
    '`ДД.ММ.ГГГГ ЧЧ:ММ` (например, `15.04.2026 14:30`)\n\n' +
    'Я проверю, чтобы время не было в прошлом.',
    { parse_mode: 'Markdown' }
  );
});

async function handle_post_period(ctx: botContext){
  const dtText = ctx.message.text;
    
  // Регулярка для проверки формата ДД.ММ.ГГГГ ЧЧ:ММ
  const dtRegex = /^(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}):(\d{2})$/;
  const match = dtText.match(dtRegex);

  if (!match) {
    return ctx.reply('❌ Неверный формат! Напишите дату вот так: `15.04.2026 14:30`');
  }

  const [_, day, month, year, hour, minute] = match;
  const scheduledDate = new Date(+year, +month - 1, +day, +hour, +minute);
  const now = new Date();

  // Проверка на корректность даты (например, 32 января)
  if (isNaN(scheduledDate.getTime())) {
    return ctx.reply('❌ Похоже, такой даты не существует. Проверьте числа.');
  }

  // Проверка на будущее время
  if (scheduledDate <= now) {
    return ctx.reply('❌ Время должно быть в будущем! Сейчас: ' + now.toLocaleString('ru-RU'));
  }

  // Сохраняем в сессию
  ctx.session?.draft?.scheduledAt = scheduledDate.toISOString();
  ctx.session.state = BotState.AWAITING_SCHEDULE;

  await ctx.reply(
    `✅ Время установлено: ${scheduledDate.toLocaleString('ru-RU')}\n` +
    `Периодичность: ${ctx.session.draft.frequency}`,
    Markup.inlineKeyboard([[Markup.button.callback('🤖 Генерировать варианты ИИ', 'process_ai_start')]])
  );
}

async function handle_select_platfroms(ctx: botContext){

}

async function handle_post_text(ctx: botContext){
  if(!ctx.message?.text) return ;
  ctx?.session?.draft.rawText = ctx.message?.text;
  

  const platforms = ctx.session.platforms?.filter(p => p.isActive) || [];

  if (platforms.length === 0) {
    return ctx.reply('⚠️ У вас нет активных площадок. Сначала настройте и запустите их в меню настроек.');
  }

  const buttons = allPlatforms.map(p => {
    const isSelected = selectedIds.includes(p.internalId);
    const checkbox = isSelected ? '✅' : '⬜';
    
    return [
      Markup.button.callback(
        `${checkbox} ${p.type}: ${p.title}`, 
        `toggle_post_plt_${p.internalId}`
      )
    ];
  });
  //buttons.push([Markup.button.callback('🚀 Далее (Генерация ИИ)', 'process_ai_start')]);

  buttons.push([Markup.button.callback('Далее', 'process_post_datetime')]);

  await ctx.reply('Текст получен! Теперь выберите площадки для публикации:', Markup.inlineKeyboard(buttons));
}

postModule.action(/^toggle_post_plt_(.+)$/, async (ctx) => {
  const platformId = ctx.match[1];
  
  // Инициализируем массив, если его нет
  if (!ctx.session.draft.selectedPlatforms) {
    ctx.session.draft.selectedPlatforms = [];
  }

  const selectedIndex = ctx.session.draft.selectedPlatforms.indexOf(platformId);

  if (selectedIndex > -1) {
    // Если уже выбран — удаляем (убираем галочку)
    ctx.session.draft.selectedPlatforms.splice(selectedIndex, 1);
  } else {
    // Если не выбран — добавляем (ставим галочку)
    ctx.session.draft.selectedPlatforms.push(platformId);
  }

  // Получаем только активные площадки пользователя для перерисовки
  const activePlatforms = ctx.session.platforms?.filter(p => p.isActive) || [];

  // Обновляем только кнопки, чтобы сообщение не "прыгало"
  try {
    await ctx.editMessageReplyMarkup(
      getPlatformSelectionKeyboard(activePlatforms, ctx.session.draft.selectedPlatforms).reply_markup
    );
  } catch (error) {
    // Telegram выдает ошибку, если нажать на кнопку, которая не меняет состояние (уже нажата)
    // Просто игнорируем её
  }

  await ctx.answerCbQuery();
});

postModule.action('process_post_datetime', (ctx)=>{
  ctx.session.state = BotState.AWAITING_POST_DATETIME;
  ctx.reply('Теперь выберите с какой периодичностью отправлять пост в выбранные соцсети:', getFrequencyMenu);
});

// обработка сообщений пользователя
postModule.on('message', async (ctx, next) => {

  // в состоянии AWAITING_POST_TEXT(ожидание текста поста) - сохранение черновика и переход в состяние AWAITING_POST_DATETIME(настройки периодичности и времени отправления)
  if (ctx.session.state === BotState.AWAITING_POST_TEXT && 'text' in ctx.message){
    handle_post_text(ctx);
    ctx.session.state = BotState.AWAITING_POST_DATETIME;
  }

  if (ctx.session.state === BotState.AWAITING_POST_DATETIME && 'text' in ctx.message){
    handle_post_period(ctx);
  }

});

export default postModule;