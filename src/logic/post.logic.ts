import type { botContext } from '../types/types.ts'
import {BotState} from '../types/types.ts'
import telegraf from 'telegraf';
const { Telegraf, Markup, session } = telegraf;
import { ImageAiService } from '../services/imageAi.service.ts';
import {PostKeyboards} from '../keyboards/post.kb.ts'
import {parseFullDate, parseIntervalToMs, parseUserDateTime} from '../utils/time.ts'
import AIContentService from '../services/aiContentMaker.ts'

const aiService = new AIContentService();
const imageAi = new ImageAiService();

export async function startEditPost(ctx: botContext){
  ctx.session.state = BotState.AWAITING_POST_TEXT;
  ctx.session.draft = { selectedPlatforms: [] };
  
  await ctx.reply('Пришлите текст поста или просто идею, а я помогу её оформить. ✨');
}

export async function handle_post_period(ctx: botContext){
  const dtText = ctx.message.text;
  let scheduledDate;
  try{
    //scheduledDate = parseFullDate(dtText);
    scheduledDate = parseUserDateTime(dtText);
    ctx.session.draft.scheduledAt = scheduledDate;
  } catch(error){
    return ctx.reply(error.message);
  }

  ctx.session.state = BotState.AWAITING_SCHEDULE;

  await ctx.reply(
    `✅ Время установлено: ${scheduledDate.toLocaleString('ru-RU')}\n` +
    `Периодичность: ${ctx.session.draft.frequency}`,
    Markup.inlineKeyboard([[Markup.button.callback('🤖 Генерировать варианты ИИ', 'process_ai_start')]])
  );
}

// получение и сохранение текста поста
export async function handle_post_text(ctx: botContext){
  const text = ctx.message?.text;
  if(!text) return ;
  
  if (ctx.session.draft.isMassMode) {
    ctx.session.draft.currentItem = { text };
  } else {
    ctx.session.draft.rawText = text;
  }

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

export async function handle_interval_execution(ctx: botContext){
  const minutes = parseInt(ctx.message.text);

  if (isNaN(minutes) || minutes <= 0) {
    return ctx.reply('⚠️ Пожалуйста, введите положительное число минут (например, 120).');
  }

  await setInternalTask(ctx, minutes);
}

export async function setIntervalTasks(ctx: botContext){
  const minutes = ctx.message.text;
  if (isNaN(minutes) || minutes <= 0) {
    return ctx.reply('⚠️ Пожалуйста, введите положительное число минут (например, 120).');
  }
}

export async function setInternalTask(ctx: any, minutes: number){
  // Устанавливаем время первого запуска — прямо сейчас + интервал
  const scheduledAt = Date.now() + minutes * 60000;
  
  ctx.session.draft.scheduledAt = scheduledAt;
  ctx.session.draft.intervalMs = minutes * 60000; // Сохраняем интервал для повторов
  ctx.session.draft.frequency = 'INTERVAL';

  await ctx.reply(
    `✅ Интервал установлен: повтор каждые ${minutes} мин.\n` +
    `Первый запуск: ${new Date(scheduledAt).toLocaleString('ru-RU')}`,
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Перейти к генерации ИИ', 'process_ai_start')]])
  );
  
}

// получение и установка интервала, в течение которого может быть опубликован следующий пост при массовом постинге
export async function set_post_interval(ctx: botContext){
  try{
    ctx.session.draft.intervalMs = parseIntervalToMs(ctx.message.text);
    ctx.session.draft.frequency = ctx.message.text;
  } catch(error){
    return ctx.reply(error.message);
  }
  ctx.session.state = BotState.AWAITING_POST_DATETIME;
  await ctx.reply(
    '📅 Укажите дату и время первого запуска в формате:\n' +
    '`ДД.ММ ЧЧ:ММ` (например, `15.04 14:30`)\n\n' +
    'Я проверю, чтобы время не было в прошлом.',
    { parse_mode: 'Markdown' }
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
      ctx.session.draft.imageSource = 'UPLOAD'; // Трактуем как загруженное (через file_id)
      //ctx.session.draft.imageUrl = undefined;

      //await ctx.telegram.deleteMessage(ctx.chat!.id, statusMessage.message_id);
      ctx.session.state = BotState.IDLE;
      await ctx.reply('Теперь выберите площадки:', PostKeyboards.platforms(ctx.session.platforms, []));
    }
  } catch (error) {
    await ctx.telegram.deleteMessage(ctx.chat!.id, statusMessage.message_id);
    console.error('--- ПОДРОБНАЯ ОШИБКА ГЕНЕРАЦИИ ---');
    console.error(error); 
    if (error.response) console.error('Ответ от Telegram:', error.response.description);
      await ctx.reply('❌ Ошибка генерации ИИ. Попробуйте загрузить свою картинку или выберите "Без картинки".', PostKeyboards.imageSource())
      //getImageSourceMenu());
  }
}

// Сохраняем текущий черновик в массив "корзины"
export async function pushCurrentItemToMass(ctx: any) {
  const { currentItem, massItems = [] } = ctx.session.draft;
  
  if (currentItem) {
    massItems.push({ ...currentItem });
    ctx.session.draft.massItems = massItems;
    ctx.session.draft.currentItem = undefined; // Очищаем для следующего
  }
}

// Финальное создание задач из набора
export async function scheduleMassQueue(ctx: any) {
  const { massItems, scheduledAt, intervalMs, selectedPlatforms } = ctx.session.draft;
  const startTs = new Date(scheduledAt).getTime();
  const isRandom = ctx.session.draft.scheduleMode === 'RANDOM';
  const baseInterval = ctx.session.draft.intervalMs;
  massItems.forEach((item: any, index: number) => {
    let currentPostTime: number;
    const taskTs = startTs + (index * (intervalMs || 0));
    
    if (index === 0) {
      currentPostTime = startTs; // Первый пост всегда в указанное время
    } else {
      if (isRandom) {
        // Генерируем разброс +/- 20%
        const jitterPercent = 0.2; 
        const jitter = (Math.random() * 2 - 1) * (baseInterval * jitterPercent);
        currentPostTime = startTs + baseInterval + jitter;
      } else {
        currentPostTime = startTs + baseInterval;
      }
    }

    const newTask = {
      id: `m_${Date.now()}_${index}`,
      userId: ctx.from.id,
      // Массовые посты пока шлем "как есть", адаптируя под площадки
      results: item.results, /*selectedPlatforms.map((pId: string) => {
        const plt = ctx.session.platforms.find((p: any) => p.internalId === pId);
        return { platformId: pId, type: plt.type, content: item.content };
      }),*/
      imageFileId: item.imageFileId || null,
      scheduledAt: currentPostTime,
      status: 'PENDING',
      frequency: 'ONCE' // Каждый пост в пачке — разовый
    };
    ctx.session.activeTasks ??= [];
    ctx.session.activeTasks.push(newTask);
  });

  const timeStr = startTs 
      ? new Date(startTs).toLocaleString('ru-RU') 
      : 'немедленно';
  
  await ctx.editMessageText(
        `🚀 *Посты успешно запланирован!*\n\n` +
        `📅 Время старта: ${timeStr}\n` +
        `Вы можете просмотреть свои активные рассылки в главном меню.`,
        { parse_mode: 'Markdown' }
      );
  
}

export async function runAiGeneration(ctx: any) {
  const { isMassMode, massItems, rawText, selectedPlatforms } = ctx.session.draft;
  const allPlatforms = ctx.session.platforms || [];

  await ctx.answerCbQuery('🤖 Магия ИИ началась...');
  const statusMessage = await ctx.reply('⏳ Адаптирую контент... Пожалуйста, подождите.');

  try {
    if (isMassMode) {
      for (const item of massItems) {
        const currentResults = [];
        for (const platformId of selectedPlatforms) {
          const platform = allPlatforms.find(p => p.internalId === platformId);
          if (!platform) continue;
          //console.log(`генерирую пост для текста: ${item.text}`);
          const adaptedText = await aiService.adaptContent(item.text, platform.type);
          //console.log(`Сгенерировал: ${adaptedText}`);
          currentResults.push({
            platformId: platform.internalId,
            type: platform.type,
            content: adaptedText
          });
        }
        item.results = currentResults;       
      }
      const updatedMassItems = JSON.parse(JSON.stringify(massItems));
      ctx.session.draft = Object.assign({}, ctx.session.draft, { massItems: updatedMassItems });
      console.log('✅ Данные записаны в сессию:', ctx.session.draft.massItems);
    } else {
      const results = [];
      for (const platformId of selectedPlatforms) {
        const platform = allPlatforms.find(p => p.internalId === platformId);
        if (!platform) continue;
        const adaptedText = await aiService.adaptContent(rawText!, platform.type);
        results.push({ platformId: platform.internalId, title: platform.title, type: platform.type, content: adaptedText });
      }
      ctx.session.draft.results = results;
    }

    // Удаляем лоадер и показываем результат
    await ctx.telegram.deleteMessage(ctx.chat!.id, statusMessage.message_id);
    await showAiPreview(ctx);

  } catch (error) {
    console.error('AI Error:', error);
    await ctx.reply('❌ Ошибка при генерации контента.');
  }
}

export function generateMassPreviewText(ctx): string {
  let text = "📊 *Предпросмотр адаптированных постов*\n\n";
  const massItems = ctx.session.draft?.massItems;
  console.log('PREVIEW DEBUG:', massItems);
  massItems.forEach((item, index) => {
    // Берем контент из первого результата (обычно это основная платформа)
    // Если ИИ еще не отработал, берем исходный raw-текст
    const aiContent = item.results && item.results.length > 0 
      ? item.results[0].content 
      : item.text;

    // Очищаем текст от Markdown-разметки для превью, чтобы не сломать отображение списка
    const cleanText = aiContent
      .replace(/[*_`]/g, '') // Убираем жирный, курсив и код
      .substring(0, 200)      // Берем чуть больше символов для наглядности
      .trim();

    const hasImage = item.imageFileId ? "🖼️" : "📝";
    const platforms = item.results?.map((r: any) => r.type).join(', ') || 'не адаптировано';

    text += `*${index + 1}.* ${hasImage} ${cleanText}...\n`;
    text += `   └ _Площадки: ${platforms}_\n\n`;
  });

  text += `_Всего в очереди: ${massItems.length}_`;
  return text;
}

export async function showAiPreview(ctx) {
  const { isMassMode, massItems, results } = ctx.session.draft;

  if (isMassMode) {
    console.log('show ai preview massItems', massItems);
    const summary = `✅ Все тексты (постов: ${massItems.length}) адаптированы ИИ и готовы к проверке.`;
    await ctx.reply(summary, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Предпросмотр всей пачки', 'mass_preview_all')],
        [Markup.button.callback('🔄 Перегенерировать всё', 'reprocess_ai')], // Новая кнопка
        [Markup.button.callback('✅ Всё верно, запланировать', 'post_confirm')],
        [Markup.button.callback('❌ Отмена', 'cancel_post')]
      ])
    });
  } else {
    let previewText = "📋 *Предпросмотр поста:*\n\n";
    results.forEach(res => {
      previewText += `📍 *${res.type}*\n---\n${res.content}\n\n`;
    });

    await ctx.reply(previewText, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Всё верно, запланировать', 'post_confirm')],
        [Markup.button.callback('🔄 Перегенерировать', 'reprocess_ai')],
        [Markup.button.callback('❌ Отмена', 'cancel_post')]
      ])
    });
  }
}