import { Composer } from 'telegraf';
import type { botContext } from '../types/types.ts'
import {BotState} from '../types/types.ts'
import telegraf from 'telegraf';
import AIContentService from '../services/aiContentMaker.ts'

const postModule = new Composer<botContext>();
const { Telegraf, Markup, session } = telegraf;
const aiService = new AIContentService();

postModule.hears('📝 Создать пост', async (ctx) => {
  ctx.session.state = BotState.AWAITING_POST_TEXT;
  ctx.session.draft = { selectedPlatforms: [] };
  
  await ctx.reply('Пришлите текст поста или просто идею, а я помогу её оформить. ✨');
});

async function startEditPost(ctx: botContext){
  ctx.session.state = BotState.AWAITING_POST_TEXT;
  ctx.session.draft = { selectedPlatforms: [] };
  
  await ctx.reply('Пришлите текст поста или просто идею, а я помогу её оформить. ✨');
}

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
  ctx.session.draft.scheduledAt = scheduledDate.toISOString();
  ctx.session.state = BotState.AWAITING_SCHEDULE;

  await ctx.reply(
    `✅ Время установлено: ${scheduledDate.toLocaleString('ru-RU')}\n` +
    `Периодичность: ${ctx.session.draft.frequency}`,
    Markup.inlineKeyboard([[Markup.button.callback('🤖 Генерировать варианты ИИ', 'process_ai_start')]])
  );
}

async function handle_post_text(ctx: botContext){
  if(!ctx.message?.text) return ;
  ctx.session.draft.rawText = ctx.message.text;
  
  const userPlatforms = ctx.session.platforms || [];
  
  // Проверяем, есть ли вообще активные площадки
  const activePlatforms = userPlatforms.filter(p => p.isActive);

  if (activePlatforms.length === 0) {
    return ctx.reply(
      '⚠️ У вас нет активных площадок. Пожалуйста, сначала добавьте и включите их в настройках.',
      Markup.inlineKeyboard([[Markup.button.callback('⚙️ Перейти в настройки', 'setup_list')]])
    );
  }

  // 4. ПЕРВЫЙ ВЫЗОВ функции генерации клавиатуры
  // По умолчанию передаем пустой массив выбранных ID [], так как пользователь еще ничего не выбрал
  const keyboard = getPostPlatformKeyboard(userPlatforms, []);

  await ctx.reply(
    '📝 *Текст принят!*\n\nТеперь выберите площадки, на которых нужно опубликовать этот пост:',
    { 
      parse_mode: 'Markdown',
      ...keyboard 
    }
  );
}

postModule.action('process_ai_start', async (ctx) => {
  const { rawText, selectedPlatforms } = ctx.session.draft;
  const allPlatforms = ctx.session.platforms || [];

  if (!selectedPlatforms || selectedPlatforms.length === 0) {
    return ctx.answerCbQuery('⚠️ Сначала выберите площадки!');
  }

  await ctx.answerCbQuery('🤖 Магия ИИ началась...');
  const statusMessage = await ctx.reply('⏳ Генерирую варианты для выбранных площадок... Пожалуйста, подождите.');

  try {
    const results = [];

    // Проходим по ID выбранных площадок
    for (const platformId of selectedPlatforms) {
      const platform = allPlatforms.find(p => p.internalId === platformId);
      if (!platform) continue;

      // Вызываем наш ИИ сервис
      const adaptedText = await aiService.adaptContent(rawText, platform.type);
      
      results.push({
        platformId: platform.internalId,
        title: platform.title,
        type: platform.type,
        content: adaptedText
      });
    }

    // Сохраняем в сессию, чтобы потом отправить при подтверждении
    ctx.session.draft.results = results;

    // Формируем предпросмотр
    let previewText = "📋 *Предпросмотр постов:*\n\n";
    results.forEach(res => {
      previewText += `📍 *${res.type}: ${res.title}*\n---\n${res.content}\n\n`;
    });

    await ctx.telegram.deleteMessage(ctx.chat!.id, statusMessage.message_id);
    
    await ctx.reply(previewText, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Всё верно, запланировать', 'post_confirm')],
        [Markup.button.callback('🔄 Перегенерировать', 'process_ai_start')],
        [Markup.button.callback('❌ Отмена', 'cancel_post')]
      ])
    });

  } catch (error) {
    console.error('AI Error:', error);
    await ctx.reply('❌ Произошла ошибка при генерации контента. Попробуйте позже.');
  }
});

postModule.action('cancel_post', async (ctx) => {
  ctx.session.state = BotState.IDLE;
  startEditPost(ctx);
})

postModule.action('post_confirm', async (ctx) => {
  const { results, scheduledAt, frequency } = ctx.session.draft;

  if (!results || results.length === 0) {
    return ctx.answerCbQuery('⚠️ Ошибка: данные поста утеряны.');
  }

  // Создаем объект задачи
  const newTask = {
    id: Date.now().toString(), // Уникальный ID задачи
    userId: ctx.from!.id,
    results, // Массив адаптированных текстов
    frequency,
    scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : Date.now(),
    status: 'PENDING',
    createdAt: Date.now()
  };

  // Сохраняем в список активных задач пользователя
  ctx.session.activeTasks ??= [];
  ctx.session.activeTasks.push(newTask);

  await ctx.answerCbQuery('✅ Задача запланирована!');
  
  const timeStr = scheduledAt 
    ? new Date(scheduledAt).toLocaleString('ru-RU') 
    : 'немедленно';

  await ctx.editMessageText(
    `🚀 *Пост успешно запланирован!*\n\n` +
    `📅 Время старта: ${timeStr}\n` +
    `🔁 Периодичность: ${frequency}\n\n` +
    `Вы можете просмотреть свои активные рассылки в главном меню.`,
    { parse_mode: 'Markdown' }
  );

  // Очищаем черновик для новых постов
  ctx.session.draft = { selectedPlatforms: [] };
  ctx.session.state = BotState.IDLE;
});

postModule.action(/^toggle_post_plt_(.+)$/, async (ctx) => {
  const platformId = ctx.match[1];
  
  // Инициализируем массив, если он еще не создан в сессии
  if (!ctx.session.draft.selectedPlatforms) {
    ctx.session.draft.selectedPlatforms = [];
  }

  const selectedPlatforms = ctx.session.draft.selectedPlatforms;
  const index = selectedPlatforms.indexOf(platformId);

  // Логика переключения (Toggle)
  if (index > -1) {
    selectedPlatforms.splice(index, 1); // Убираем ID
  } else {
    selectedPlatforms.push(platformId); // Добавляем ID
  }

  // Получаем список всех активных площадок пользователя
  const userPlatforms = ctx.session.platforms || [];

  try {
    // Обновляем только кнопки текущего сообщения
    await ctx.editMessageReplyMarkup(
      getPostPlatformKeyboard(userPlatforms, selectedPlatforms).reply_markup
    );
  } catch (error: any) {
    // Игнорируем ошибку "Message is not modified" от Telegram
    if (!error.description?.includes('message is not modified')) {
      console.error('Ошибка при обновлении чекбоксов:', error);
    }
  }

  await ctx.answerCbQuery();
});

const getPostPlatformKeyboard = (allPlatforms: any[], selectedIds: string[] = []) => {
  const buttons = allPlatforms
    .filter(p => p.isActive) // Показываем только те, что включены в настройках
    .map(p => {
      const isSelected = selectedIds.includes(p.internalId);
      const icon = p.type === 'TELEGRAM' ? '🟦' : '🔵';
      const checkbox = isSelected ? '✅' : '⬜';

      return [
        Markup.button.callback(
          `${checkbox} ${icon} ${p.title || p.type}`, 
          `toggle_post_plt_${p.internalId}`
        )
      ];
    });

  buttons.push([
    Markup.button.callback('⬅️ Отмена', 'cancel_post'),
    Markup.button.callback('➡️ Далее', 'process_post_datetime')
  ]);

  return Markup.inlineKeyboard(buttons);
};

postModule.action('process_post_datetime', (ctx)=>{
  ctx.session.state = BotState.AWAITING_POST_DATETIME;
  ctx.reply('Теперь выберите с какой периодичностью отправлять пост в выбранные соцсети:', getFrequencyMenu());
});

// обработка сообщений пользователя
postModule.on('message', async (ctx, next) => {

  // в состоянии AWAITING_POST_TEXT(ожидание текста поста) - сохранение черновика и переход в состяние AWAITING_POST_DATETIME(настройки периодичности и времени отправления)
  if (ctx.session.state === BotState.AWAITING_POST_TEXT && 'text' in ctx.message){
    await handle_post_text(ctx);
    //ctx.session.state = BotState.AWAITING_POST_DATETIME;
  }

  if (ctx.session.state === BotState.AWAITING_POST_DATETIME && 'text' in ctx.message){
    handle_post_period(ctx);
  }

});

postModule.hears('📊 Активные рассылки', async (ctx) => {
  const tasks = ctx.session.activeTasks || [];
  
  // Фильтруем только те, что еще не выполнены или цикличны
  const pendingTasks = tasks.filter(t => t.status === 'PENDING');

  if (pendingTasks.length === 0) {
    return ctx.reply('У вас пока нет активных запланированных рассылок. Создайте новый пост!');
  }

  await ctx.reply('📋 Ваши активные рассылки:');

  for (const task of pendingTasks) {
    const dateStr = new Date(task.scheduledAt).toLocaleString('ru-RU');
    const platforms = task.results.map((r: any) => r.type).join(', ');
    
    // Короткое превью текста
    const preview = task.results[0].content.substring(0, 50) + '...';

    const messageText = `🆔 *Задача:* \`${task.id}\`\n` +
                        `📅 *Старт:* ${dateStr}\n` +
                        `🔁 *Тип:* ${task.frequency}\n` +
                        `🌐 *Площадки:* ${platforms}\n` +
                        `📝 *Текст:* _${preview}_`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🛑 Остановить/Удалить', `delete_task_${task.id}`),
        // Можно добавить кнопку "Изменить время", если захочешь позже
      ]
    ]);

    await ctx.reply(messageText, { parse_mode: 'Markdown', ...keyboard });
  }
});

postModule.action(/^delete_task_(.+)$/, async (ctx) => {
  const taskId = ctx.match[1];
  const tasks = ctx.session.activeTasks || [];

  const taskIndex = tasks.findIndex(t => t.id === taskId);

  if (taskIndex > -1) {
    // Удаляем задачу из массива
    tasks.splice(taskIndex, 1);
    ctx.session.activeTasks = tasks;

    await ctx.answerCbQuery('Рассылка удалена');
    
    // Редактируем сообщение, чтобы показать, что задача аннулирована
    await ctx.editMessageText('❌ Эта рассылка была отменена и удалена.');
  } else {
    await ctx.answerCbQuery('Ошибка: задача не найдена', { show_alert: true });
  }
});

export default postModule;