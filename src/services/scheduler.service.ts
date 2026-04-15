import { Telegraf } from 'telegraf';
import Redis from 'redis';
import type { botContext } from '../types/types.ts';

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
  }, 60000); 
}

async function executeTask(bot: any, task: any, session: any) {
  for (const res of task.results) {
    try {
      if (res.type === 'TELEGRAM') {
        await bot.telegram.sendMessage(res.platformId, res.content, { parse_mode: 'Markdown' });
      }
      // Здесь добавишь логику для VK и других платформ
      console.log(`✅ Пост отправлен на ${res.type} (${res.title})`);
    } catch (e) {
      console.error(`❌ Ошибка отправки на ${res.platformId}:`, e);
    }
  }
}

function updateTaskAfterExecution(task: any) {
    if (task.frequency === 'ONCE') {
        task.status = 'COMPLETED';
    } else {
        // Логика переноса времени: +1 день, +1 неделя и т.д.
        const dayMs = 24 * 60 * 60 * 1000;
        if (task.frequency === 'DAILY') task.scheduledAt += dayMs;
        if (task.frequency === 'WEEKLY') task.scheduledAt += dayMs * 7;
        // и так далее...
    }
}