import { Telegraf } from 'telegraf';
import Redis from 'redis';
import type { botContext } from '../types/types.ts';
import AIContentService from '../services/aiContentMaker.ts'

const aiService = new AIContentService();

export function startScheduler(bot: Telegraf<botContext>, redis: Redis) {
  setInterval(async () => {
    try {
      // Ищем все ключи сессий. В Redis они обычно лежат с префиксом
      const keys = await redis.keys('*:*'); 

      if (keys.length === 0){
         console.log('нет сессий');
         return;
      }

      for (const key of keys) {
        const rawData = await redis.get(key);
        if (!rawData) continue;

        const sessionData = JSON.parse(rawData);
        if (!sessionData.activeTasks || sessionData.activeTasks.length === 0) continue;

        let isChanged = false;
        const now = Date.now();
        for (const task of sessionData.activeTasks) {
          if (task.status === 'PENDING' && now >= task.scheduledAt) {
            console.log(`[Scheduler] Выполняю задачу: ${task.id}`);
            
            await executeTask(bot, task);
            updateTaskAfterExecution(task);
            
            isChanged = true;
          }
        }

        // Если мы изменили статус задачи (выполнили или перенесли), сохраняем сессию обратно
        if (isChanged) {
          await redis.set(key, JSON.stringify(sessionData));
        }
      }
    } catch (error) {
      console.error('[Scheduler Error]:', error);
    }
  }, 30000);
  //}, 60000); 
}

async function executeTask(bot: any, task: any) {
  const { imageSource, imageFileId, imageUrl, results, isDynamic, rawText } = task;
  console.log(`[Scheduler] === СРАБОТАЛ ПЛАНИРОВЩИК ===`);
  console.log(`[Scheduler] Задача ID: ${task.id}`);
  console.log(`[Scheduler] Данные медиа: FileID="${task.imageFileId}", Source="${task.imageSource}"`);
  for (const res of results) {
    let finalCaption = "";
    try {
      if (res.type === 'TELEGRAM') {
        let content = res.content;
        if(isDynamic){
          try {
            // Вызываем ИИ заново, используя исходный текст задачи
            content = await aiService.adaptContent(rawText, res.type);
          } catch (e) {
            console.error('Ошибка динамической генерации, использую старый текст');
          }
        }
        finalCaption = content.substring(0, 4096) + "..."; 
        if (imageFileId) {
          console.log(`[Scheduler] Шлю ФОТО (file_id) в ${res.platformId}`);
          await bot.telegram.sendPhoto(res.platformId, imageFileId, { 
            //caption: finalCaption,
            //parse_mode: 'HTML' 
          });
          await bot.telegram.sendMessage(res.platformId, finalCaption, { 
            parse_mode: 'HTML' 
          })
        } 
        else if (imageUrl) {
          await bot.telegram.sendPhoto(res.platformId, imageUrl, { 
            //caption: finalCaption,
            //parse_mode: 'HTML' 
          });
          await bot.telegram.sendMessage(res.platformId, finalCaption, { 
            parse_mode: 'HTML' 
          })
        } 
        // Если вообще ничего нет
        else {
          console.log(`[Scheduler] Шлю ТОЛЬКО ТЕКСТ в ${res.platformId}`);
          await bot.telegram.sendMessage(res.platformId, finalCaption, { 
            parse_mode: 'HTML' 
          });
        }
      }
      console.log(`✅ Отправлено в ${res.type}`);
    } catch (e) {
      if (e.description?.includes('can\'t parse entities')) {
        console.error('Ошибка разметки ИИ, шлю чистым текстом...');
        finalCaption = res.content.substring(0, 1020) + "..."; 
        // 3. Фолбэк: если разметка битая, очищаем её регуляркой и шлем без parse_mode
        const cleanText = finalCaption.replace(/[*_`]/g, '');
        return await bot.telegram.sendPhoto(res.platformId, imageFileId, {
          caption: cleanText
        });
      }
      console.error(`❌ Ошибка отправки на ${res.platformId}:`, e);
      throw e;
    }
  }
}

function updateTaskAfterExecution(task: any) {
    if (task.frequency === 'ONCE') {
        task.status = 'COMPLETED';
    } else if(task.frequency === 'INTERVAL'){
      const interval = task.intervalMs || (60 * 60000); // По умолчанию час, если забыли
      task.scheduledAt = Date.now() + interval;
      task.status = 'PENDING'; // Оставляем активной
      console.log(`[Scheduler] Задача ${task.id} перенесена на ${new Date(task.scheduledAt).toISOString()}`);
    }
    else {
        // Логика переноса времени: +1 день, +1 неделя и т.д.
        const dayMs = 24 * 60 * 60 * 1000;
        if (task.frequency === 'DAILY') task.scheduledAt += dayMs;
        if (task.frequency === 'WEEKLY') task.scheduledAt += dayMs * 7;
       
    }
}