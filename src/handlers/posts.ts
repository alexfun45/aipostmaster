import { Composer } from 'telegraf';
import type { botContext } from '../types/types.ts'
import {BotState} from '../types/types.ts'
import telegraf from 'telegraf';
import AIContentService from '../services/aiContentMaker.ts'

import {PostKeyboards} from '../keyboards/post.kb.ts'
import {startEditPost, handle_post_period, handle_post_text, set_post_interval, handle_interval_execution, setInternalTask, handle_generate_image, pushCurrentItemToMass, scheduleMassQueue} from '../logic/post.logic.ts'

const postModule = new Composer<botContext>();
const { Telegraf, Markup, session } = telegraf;
const aiService = new AIContentService();


postModule.hears('📝 Создать пост', async (ctx) => {
  ctx.session.state = BotState.AWAITING_POST_TEXT;
  ctx.session.draft = { selectedPlatforms: [] };
  
  await ctx.reply('Пришлите текст поста или просто идею, а я помогу её оформить. ✨');
});

postModule.hears('📦 Массовое создание', async (ctx) => {
  ctx.session.draft = { isMassMode: true, massItems: [], selectedPlatforms: [] };
  ctx.session.state = BotState.AWAITING_POST_TEXT;
  await ctx.reply('🚀 Режим массовой загрузки. Пришлите текст для ПЕРВОГО поста:');
});

// 1. ВАРИАНТ: БЕЗ КАРТИНКИ
postModule.action('img_source_NONE', async (ctx) => {
  ctx.session.draft.imageSource = 'NONE';
  if(ctx.session.draft.isMassMode){
    return await ctx.reply(`Пост без картинки`, Markup.inlineKeyboard([
      [Markup.button.callback('➕ Добавить еще пост', 'mass_add_next')],
      [Markup.button.callback('⚙️ Перейти к настройке всей пачки', 'process_mass_setup')]
    ]));
  }
  await ctx.answerCbQuery();
  // Переходим сразу к площадкам
  await ctx.editMessageText('Хорошо, пост будет без картинки.\nТеперь выберите площадки:', PostKeyboards.platforms(ctx.session.platforms, []))
});

// 2. ВАРИАНТ: ЗАГРУЗИТЬ СВОЮ
postModule.action('img_source_UPLOAD', async (ctx) => {
  ctx.session.draft.imageSource = 'UPLOAD';
  ctx.session.state = BotState.AWAITING_POST_IMAGE_UPLOAD;
  await ctx.answerCbQuery();
  await ctx.editMessageText('📤 Пожалуйста, отправьте изображение в чат (как фото, не как файл).');
});

// 3. ВАРИАНТ: СГЕНЕРИРОВАТЬ ИИ
postModule.action('img_source_AI', async (ctx) => {
  ctx.session.draft.imageSource = 'AI';
  ctx.session.state = BotState.AWAITING_POST_IMAGE_PROMPT; // Новый стейт
  await ctx.answerCbQuery();
  await ctx.editMessageText('🤖 Опишите идею для генерации изображения (на русском или английском):');
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


postModule.action(/^freq_(.+)$/, async (ctx) => {
  const freq = ctx.match[1];
  ctx.session.draft.frequency = freq;
  await ctx.answerCbQuery();

  if (freq === 'ONCE') {
    return ctx.reply('🚀 Пост будет отправлен сразу после генерации. Переходим к ИИ?', 
      Markup.inlineKeyboard([[Markup.button.callback('🤖 Генерировать', 'process_ai_start')]]));
  }

  if(freq === 'INTERVAL'){
    ctx.session.state = BotState.AWAITING_INTERVAL_VALUE;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('1 час', 'set_int_60'), Markup.button.callback('3 часа', 'set_int_180')],
      [Markup.button.callback('6 часов', 'set_int_360'), Markup.button.callback('12 часов', 'set_int_720')],
      [Markup.button.callback('⬅️ Назад', 'process_post_datetime')]
    ]);
  
    await ctx.editMessageText(
      '⏳ *Установка интервала*\n\nВыберите готовый вариант или **напишите числом в чат**, через сколько минут повторно отправлять пост:',
      { parse_mode: 'Markdown', ...keyboard }
    );
    return await ctx.answerCbQuery();
  }

  ctx.session.state = BotState.AWAITING_POST_DATETIME;
  await ctx.reply(
    '📅 Укажите дату и время первого запуска в формате:\n' +
    '`ДД.ММ.ГГГГ ЧЧ:ММ` (например, `15.04.2026 14:30`)\n\n' +
    'Я проверю, чтобы время не было в прошлом.',
    { parse_mode: 'Markdown' }
  );
});

postModule.action(/^set_int_(\d+)$/, async (ctx) => {
  const minutes = parseInt(ctx.match[1]);
  await setInternalTask(ctx, minutes);
  await ctx.answerCbQuery();
});


postModule.action(/^mode_(.+)$/, async (ctx) => {
  const mode = ctx.match[1];
  ctx.session.draft.isDynamic = (mode === 'DYNAMIC');
  await ctx.answerCbQuery();

  // Теперь переходим к генерации первого варианта (превью)
  await ctx.reply('Теперь давайте добавим изображение:', 
  PostKeyboards.imageSource());
});


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
  const { 
    results, 
    scheduledAt, 
    frequency, 
    intervalMs, 
    imageFileId, 
    imageSource,
    rawText
  } = ctx.session.draft;

  console.log(`[Confirm] Сохраняю задачу. FileID в черновике: ${imageFileId}`);

  if (!results || results.length === 0) {
    return ctx.answerCbQuery('⚠️ Ошибка: данные поста утеряны.');
  }
  if (ctx.session.draft.isMassMode) {
    await scheduleMassQueue(ctx);
  } else {
    // Создаем объект задачи
    const newTask = {
      id: Date.now().toString(), // Уникальный ID задачи
      userId: ctx.from!.id,
      results, // Массив адаптированных текстов
      frequency,
      rawText,
      intervalMs: intervalMs || 0,
      isDynamic: ctx.session.draft.isDynamic || false,
      imageFileId: imageFileId || null, 
      imageSource: imageSource || 'NONE',
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
    }
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
      PostKeyboards.platforms(userPlatforms, selectedPlatforms).reply_markup
      //getPostPlatformKeyboard(userPlatforms, selectedPlatforms).reply_markup
    );
  } catch (error: any) {
    // Игнорируем ошибку "Message is not modified" от Telegram
    if (!error.description?.includes('message is not modified')) {
      console.error('Ошибка при обновлении чекбоксов:', error);
    }
  }

  await ctx.answerCbQuery();
});

postModule.action('process_post_datetime', (ctx)=>{
  console.log(`[Check] Переход к дате. FileID в сессии: ${ctx.session.draft?.imageFileId}`);
  ctx.session.state = BotState.AWAITING_POST_DATETIME;
  if(ctx.session.draft.isMassMode){
    ctx.reply('Выберите временной режим отправки постов', PostKeyboards.type_frequency());
  }
  else{
    ctx.reply('Теперь выберите с какой периодичностью отправлять пост в выбранные соцсети:', PostKeyboards.frequency())
  }
});

// пользователь выбрал регулярный постинг иил в случайное время 
postModule.action(/^freqmode_(.+)$/, (ctx) => {
  const freqmode = ctx.match[1];
  ctx.session.state = BotState.AWAITING_POST_PERIOD;
  ctx.session.draft.scheduleMode = freqmode;
  ctx.reply('Введите интервал времени, через который пост может быть опубликован', PostKeyboards.mass_frequency());
})

postModule.action(/^mfreq_(.+)$/, (ctx) => {
  const freq = ctx.match[1];
  
  switch(freq){
    case "HOUR": 
      ctx.session.draft.intervalValue = "1h";
      break;
    case "DAY":
      ctx.session.draft.intervalValue = "1d";
      break;
    case "3DAY":
      ctx.session.draft.intervalValue = "3d";
      break;
    case "WEEK":
      ctx.session.draft.intervalValue = "7d";
      break;
    case "MONTH":
      ctx.session.draft.intervalValue = "1m";
      break;
  }
  set_post_interval(ctx);
  
})


// обработка сообщений пользователя
postModule.on('message', async (ctx, next) => {

  // в состоянии AWAITING_POST_TEXT(ожидание текста поста) - сохранение черновика и переход в состяние AWAITING_POST_DATETIME(настройки периодичности и времени отправления)
  if (ctx.session.state === BotState.AWAITING_POST_TEXT && 'text' in ctx.message){
    await handle_post_text(ctx);
    //ctx.session.state = BotState.AWAITING_POST_DATETIME;
  }

  if(ctx.session.state === BotState.AWAITING_INTERVAL_VALUE && 'text' in ctx.message) {
    await handle_interval_execution(ctx);
  }

  if (ctx.session.state === BotState.AWAITING_POST_DATETIME && 'text' in ctx.message){
    await handle_post_period(ctx);
  }

  if(ctx.session.state === BotState.AWAITING_POST_IMAGE_PROMPT && 'text' in ctx.message){
    await handle_generate_image(ctx);
  }

  if(ctx.session.state === BotState.AWAITING_POST_PERIOD && 'text' in ctx.message){
    await set_post_interval(ctx);
  }
  
  return next();
});

postModule.on('photo', async (ctx, next) => {
  if (ctx.session.state !== BotState.AWAITING_POST_IMAGE_UPLOAD || !ctx.message.photo) {
    return next();
  }

  // Телеграм присылает массив разных размеров, берем самый большой (последний)
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  
  if (ctx.session.draft.isMassMode) {
    ctx.session.draft.currentItem!.imageFileId = photo.file_id;
    await pushCurrentItemToMass(ctx);

    const count = ctx.session.draft.massItems.length;
    await ctx.reply(`✅ Изображение загружено!`, Markup.inlineKeyboard([
      [Markup.button.callback('➕ Добавить еще пост', 'mass_add_next')],
      [Markup.button.callback('⚙️ Перейти к настройке всей пачки', 'process_mass_setup')]
    ]));
  } else {
    ctx.session.draft.imageFileId = photo.file_id;
    ctx.session.state = BotState.IDLE;
  }
  
  
  // Показываем превью и переходим к площадкам
  await ctx.replyWithPhoto(photo.file_id, {
    caption: 'Ваш пост будет выглядеть так.\nТеперь выберите площадки:',
    ...PostKeyboards.platforms(ctx.session.platforms, [])
  });
});

postModule.action('mass_add_next', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.state = BotState.AWAITING_POST_TEXT;
  await ctx.reply('Пришлите текст поста:');
})

postModule.action('process_mass_setup', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Настроим расписание для всей очереди. Сначала выберите площадки:', 
    PostKeyboards.platforms(ctx.session.platforms, []));
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