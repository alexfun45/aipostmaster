import { Markup } from 'telegraf';

export const PostKeyboards = {
  imageSource: () => Markup.inlineKeyboard([
    [Markup.button.callback('🖼 Загрузить свою', 'img_source_UPLOAD')],
    [Markup.button.callback('🤖 Сгенерировать ИИ', 'img_source_AI')],
    [Markup.button.callback('🚫 Без картинки', 'img_source_NONE')]
  ]),

  frequency: () => Markup.inlineKeyboard([
    [Markup.button.callback('🎯 Единоразово', 'freq_ONCE')],
    [Markup.button.callback('⏳ Через промежуток', 'freq_INTERVAL')],
    [Markup.button.callback('📅 Раз в день', 'freq_DAILY')],
    [Markup.button.callback('🗓 Раз в неделю', 'freq_WEEKLY')],
    [Markup.button.callback('🌕 Раз в месяц', 'freq_MONTHLY')],
    [Markup.button.callback('⬅️ Назад', 'back_to_platforms')]
  ]),
  mass_frequency: () => Markup.inlineKeyboard([
    [Markup.button.callback('⏳ Раз в час', 'mfreq_HOUR')],
    [Markup.button.callback('📅 Раз в день', 'mfreq_DAY')],
    [Markup.button.callback('📅 Раз в 3 дня', 'mfreq_3DAY')],
    [Markup.button.callback('🗓 Раз в неделю', 'mfreq_WEEK')],
    [Markup.button.callback('🌕 Раз в месяц', 'mfreq_MONTH')],
    [Markup.button.callback('Введите интервал времени, через который пост может быть опубликован в формате [число][m|h|d](например 1m - интервал 1 минута, 3h - 3 часа, 7d - 7 дней)', 'mfreq_CUSTOM')],
  ]),
  type_frequency: () => Markup.inlineKeyboard([
    [Markup.button.callback('Раз в определенный период', 'freqmode_REGULAR')],
    [Markup.button.callback('В случайное время в диапазоне интервала', 'freqmode_RANDOM')],
  ]),
  contentMode: () => Markup.inlineKeyboard([
    [Markup.button.callback('📜 Один текст (статичный)', 'mode_STATIC')],
    [Markup.button.callback('🔄 Всегда новый (динамичный)', 'mode_DYNAMIC')]
  ]),

  platforms: (allPlatforms: any[], selectedIds: string[] = []) => {
    const buttons = allPlatforms
      .filter(p => p.isActive)
      .map(p => {
        const isSelected = selectedIds.includes(p.internalId);
        const icon = p.type === 'TELEGRAM' ? '🟦' : '🔵';
        const checkbox = isSelected ? '✅' : '⬜';
        return [Markup.button.callback(`${checkbox} ${icon} ${p.title || p.type}`, `toggle_post_plt_${p.internalId}`)];
      });
      
    buttons.push([
      Markup.button.callback('⬅️ Отмена', 'cancel_post'),
      Markup.button.callback('➡️ Далее', 'process_post_datetime')
    ]);
    return Markup.inlineKeyboard(buttons);
  }
};