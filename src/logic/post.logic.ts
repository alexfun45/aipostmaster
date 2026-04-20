import type { botContext } from '../types/types.ts'
import {BotState} from '../types/types.ts'
import telegraf from 'telegraf';
const { Telegraf, Markup, session } = telegraf;
import { ImageAiService } from '../services/imageAi.service.ts';
import {PostKeyboards} from '../keyboards/post.kb.ts'

const imageAi = new ImageAiService();

export async function startEditPost(ctx: botContext){
  ctx.session.state = BotState.AWAITING_POST_TEXT;
  ctx.session.draft = { selectedPlatforms: [] };
  
  await ctx.reply('Пришлите текст поста или просто идею, а я помогу её оформить. ✨');
}

export async function handle_post_period(ctx: botContext){
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

// получение и сохранение текста поста
export async function handle_post_text(ctx: botContext){
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

  await ctx.reply('📝 Текст принят!\nТеперь выберите режим контента:', PostKeyboards.contentMode());
}

export async function handle_interval_execution(ctx){
  const minutes = parseInt(ctx.message.text);

  if (isNaN(minutes) || minutes <= 0) {
    return ctx.reply('⚠️ Пожалуйста, введите положительное число минут (например, 120).');
  }

  await setInternalTask(ctx, minutes);
}

export async function setInternalTask(ctx: any, minutes: number){
  // Устанавливаем время первого запуска — прямо сейчас + интервал
  const scheduledAt = Date.now() + minutes * 60000;
  
  ctx.session.draft.scheduledAt = scheduledAt;
  ctx.session.draft.intervalMs = minutes * 60000; // Сохраняем интервал для повторов
  ctx.session.draft.frequency = 'INTERVAL';
  //ctx.session.state = BotState.IDLE;

  await ctx.reply(
    `✅ Интервал установлен: повтор каждые ${minutes} мин.\n` +
    `Первый запуск: ${new Date(scheduledAt).toLocaleString('ru-RU')}`,
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Перейти к генерации ИИ', 'process_ai_start')]])
  );
  
}

export async function handle_generate_image(ctx: botContext){
  const prompt = ctx.message.text;
  ctx.session.draft.imagePrompt = prompt;

  const statusMessage = await ctx.reply('🤖 Магия ИИ началась... Генерирую изображение по вашему описанию. Это может занять до 20 секунд.');

  try {
    const imageData = await imageAi.generateImage(prompt);
    let sentMessage;

    if (typeof imageData === 'string') {
      // Это URL из заглушки
      sentMessage = await ctx.replyWithPhoto({ url: imageData }, {
        caption: `✅ Тестовое изображение сгенерировано (Бесплатно)!`,
      });
    } else {
      // Это Buffer из реального ИИ
      sentMessage = await ctx.replyWithPhoto({ source: imageData }, {
        caption: `✅ Изображение сгенерировано по запросу: _${prompt}_`,
        parse_mode: 'Markdown',
      });
    }

    // Сохраняем file_id самого большого фото из отправленного сообщения
    const photo = sentMessage.photo[sentMessage.photo.length - 1];

    ctx.session.draft.imageFileId = photo.file_id;
    ctx.session.draft.imageSource = 'UPLOAD'; // Трактуем как загруженное (через file_id)
    //ctx.session.draft.imageUrl = undefined;

    //await ctx.telegram.deleteMessage(ctx.chat!.id, statusMessage.message_id);
    ctx.session.state = BotState.IDLE;
    await ctx.reply('Теперь выберите площадки:', PostKeyboards.platforms(ctx.session.platforms, []));
  } catch (error) {
    await ctx.telegram.deleteMessage(ctx.chat!.id, statusMessage.message_id);
    console.error('--- ПОДРОБНАЯ ОШИБКА ГЕНЕРАЦИИ ---');
    console.error(error); 
    if (error.response) console.error('Ответ от Telegram:', error.response.description);
      await ctx.reply('❌ Ошибка генерации ИИ. Попробуйте загрузить свою картинку или выберите "Без картинки".', PostKeyboards.imageSource())
      //getImageSourceMenu());
  }
}
