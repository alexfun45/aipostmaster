import { Composer } from 'telegraf';
import type { botContext } from '../types/types.ts'
import {BotState} from '../types/types.ts'
import telegraf from 'telegraf';

const setupModule = new Composer<botContext>();
const { Telegraf, Markup, session } = telegraf;

const getPlatformMenu = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Telegram (Активно)', 'setup_tg')],
    [Markup.button.callback('VK (Скоро)', 'setup_vk')],
    [Markup.button.callback('Instagram (Скоро)', 'setup_inst')]
  ]);
};

setupModule.hears('⚙️ Настроить площадки', setup);

async function setup(ctx: botContext){
  const platforms = ctx.session.platforms || [];
  if (platforms.length === 0) {
    return ctx.reply(
      'У вас пока нет подключенных площадок.',
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ Добавить Telegram канал', 'setup_tg')]
      ])
    );
  }

  const buttons = platforms.map(p => [
    Markup.button.callback(
      `${p.type === 'TELEGRAM' ? '🔹telegram:' : '🔸vk:'} ${p.title || p.internalId}(${(p.isActive)?'активна':'остановлена'})`, 
      `manage_plt_${p.internalId}`
    )
  ]);

  buttons.push([Markup.button.callback('➕ Добавить еще', 'add_platform_choice')]);

  await ctx.reply('Ваши подключенные площадки:', Markup.inlineKeyboard(buttons));
}

setupModule.action('add_platform_choice', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Что именно вы хотите подключить?', getPlatformMenu());
});

const getPlatformManagementMenu = (platform: any) => {
  const platformId = platform.internalId;
  const statusIcon = platform.isActive ? '🟢' : '🔴';
  const statusText = platform.isActive ? 'Активна' : 'Остановлена';
  const toggleText = platform.isActive ? '⏸ Остановить' : '▶️ Запустить';

  const text = `Управление площадкой:\n\n` +
               `Тип: ${platform.type}\n` +
               `Название: ${platform.title}\n` +
               `Статус: ${statusIcon} ${statusText}`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(toggleText, `toggle_plt_${platformId}`)],
    [Markup.button.callback('🗑 Удалить', `delete_plt_${platformId}`)],
    [Markup.button.callback('⬅️ Назад', 'setup_list')]
  ]);

  return { text, keyboard };
};

// Управление конкретной площадкой (удаление/проверка)
setupModule.action(/^manage_plt_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const platformId = ctx.match[1];
  const platform = ctx.session.platforms?.find(p => p.internalId === platformId);
  
  const { text, keyboard } = getPlatformManagementMenu(platform);
  await ctx.editMessageText(text, keyboard);
  await ctx.answerCbQuery();
});

setupModule.action(/^delete_plt_(.+)$/, async (ctx) => {
  const platformId = ctx.match[1];
  const platform = ctx.session.platforms?.find(p => p.internalId === platformId);
  if (platform){
    const filteredPlatforms = ctx.session.platforms?.filter((plf=>plf!=platformId));
    ctx.session.platforms = filteredPlatforms;
    await ctx.answerCbQuery('Подписка удалена');
  }
});

// Обработчик переключения статуса
setupModule.action(/^toggle_plt_(.+)$/, async (ctx) => {
  const platformId = ctx.match[1];
  const platform = ctx.session.platforms?.find(p => p.internalId === platformId);

  if (platform) {
    platform.isActive = !platform.isActive; // Переключаем boolean
    const { text, keyboard } = getPlatformManagementMenu(platform);
    
    await ctx.editMessageText(text, keyboard); // Текст и кнопки обновятся мгновенно
    await ctx.answerCbQuery(`Статус: ${platform.isActive ? 'Активен' : 'Пауза'}`);
  }
});


setupModule.action('setup_list', setup);

setupModule.action('setup_tg', async (ctx: botContext) => {
  // Убираем часики на кнопке
  await ctx.answerCbQuery();
  
  // Устанавливаем стейт
  ctx.session.state = BotState.AWAITING_CHANNEL_ID;
  
  await ctx.reply(
    '📢 *Настройка канала*\n\n' +
  'Добавьте меня в администраторы вашего канала. После добавления я автоматически привяжу его к вашему профилю',
    Markup.inlineKeyboard([
      [Markup.button.callback('❌ Отмена', 'cancel_setup')]
    ])
  );
});

setupModule.on('my_chat_member', async (ctx: botContext) => {
  const chat = ctx?.myChatMember.chat;
  if (ctx?.myChatMember.new_chat_member.status === 'administrator') {
    await ctx.telegram.sendMessage(ctx?.myChatMember.from.id, `✅ Вижу, вы добавили меня в канал "${chat?.title}" (ID: ${chat.id})`);
    const channelInfo = {
      type: 'TELEGRAM',
      internalId: chat.id.toString(),
      title: chat?.title,
      isActive: true
    };
    //ctx.session.platforms ??= [];
    if (!ctx.session.platforms.find(p => p.internalId === channelInfo.internalId)) {
      ctx.session.platforms.push(channelInfo);
      await ctx.telegram.sendMessage(ctx?.myChatMember.from.id, 
        `✅ Канал "${chat.title}" автоматически добавлен в ваши площадки!`);
    }
    else{
      await ctx.telegram.sendMessage(ctx?.myChatMember.from.id, 'Этот канал уже есть в списке добавленных')
    }
  }
});

setupModule.action('cancel_setup', async (ctx: botContext) => {
  await ctx.answerCbQuery();
  ctx.session.state = BotState.IDLE;
})

export {setupModule}