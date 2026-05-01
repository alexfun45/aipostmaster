import { Composer } from 'telegraf';
import type { botContext, UserPlatform} from '../types/types.ts'
import {BotState} from '../types/types.ts'
import axios from 'axios';
import telegraf from 'telegraf';

const setupModule = new Composer<botContext>();
const { Telegraf, Markup, session } = telegraf;


const getPlatformMenu = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Telegram (Активно)', 'setup_tg')],
    [Markup.button.callback('VK', 'setup_vk')],
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
        [Markup.button.callback('➕ Добавить Telegram канал', 'setup_tg')],
        [Markup.button.callback('➕ Добавить vk группу', 'setup_vk')]
      ])
    );
  }
  console.log('площадки', platforms);
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
    const filteredPlatforms = ctx.session.platforms?.filter((plf=>plf.internalId!=platformId));
    ctx.session.platforms = filteredPlatforms;
    ctx.reply('Платформа удалена');
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

setupModule.action('setup_vk', async (ctx: botCOntext) => {
  await ctx.answerCbQuery();

  ctx.session.state = BotState.AWAITING_CHANNEL_VK_ID
  await ctx.reply(
    '📢 *Настройка канала*\n\n' +
    'Добавьте id группы vk(ее можно найти в адресной строке https://vk.ru/club123456789, id группы будет 123456789)',
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

async function getVkGroupName(groupId: string, token: string) {
  try {
    // Убираем минус, если пользователь его ввел, так как для этого метода нужен чистый ID
    const cleanId = groupId.replace('-', '');
    
    const response = await axios.get('https://api.vk.com/method/groups.getById', {
      params: {
        group_id: cleanId,
        access_token: token,
        v: '5.131'
      }
    });

    return response.data.response[0].name; // Возвращает реальное название группы
  } catch (e) {
    return 'Новая группа VK'; // Фолбэк, если что-то пошло не так
  }
} 

async function save_vk_group_id(ctx: botContext, group_id: string){
  ctx.session.platforms ??= [];
  console.log('Добавляю группу vk', group_id);
  if(!/\d+/.test(group_id))
    return ctx.reply('Вы ввели некорректное значение id группы. Ключ доступа должен содержать последовательность цифр');
  if (!ctx.session.platforms.find(p => ( (p.type === 'VK') && (p.internalId === group_id)))){
    ctx.session.currentSaveGroup = '-' + group_id;
    await ctx.reply(`Теперь введите api ключ доступа к группе`);
    ctx.session.state = BotState.AWAITING_API_KEY;
  }
  else{
    await ctx.telegram.sendMessage(ctx?.myChatMember.from.id, 'Этот канал уже есть в списке добавленных')
  }
}

async function save_vk_api_key(ctx: botContext, api_key: string){
    console.log('Добавляю api key группы vk', api_key);
    console.log('id группы', ctx.session.currentSaveGroup);
        const groupName = await getVkGroupName(ctx.session.currentSaveGroup, api_key);
        const channelInfo = {
          type: 'VK',
          internalId: ctx.session.currentSaveGroup,
          isActive: true,
          title: groupName,
          accessToken: api_key
        };
        ctx.session.platforms.push(channelInfo);
        ctx.session.currentSaveGroup = null;
        ctx.session.state = BotState.IDLE;
        return ctx.reply(`Группа vk ${groupName} добавлена в ваши площадки`);
}

// обработка сообщений пользователя
setupModule.on('message', async (ctx, next) => {
  const text = ctx.message?.text;
  if (ctx.session.state === BotState.AWAITING_CHANNEL_VK_ID && 'text' in ctx.message) {
    return await save_vk_group_id(ctx, text);
  }

  if(ctx.session.state === BotState.AWAITING_API_KEY && 'text' in ctx.message){
    return await save_vk_api_key(ctx, text);
  }
 
  return next();
})

export default setupModule