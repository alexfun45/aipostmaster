// функция преобразования входной строки интервала в untixtime
export function parseIntervalToMs(input: string): number | null {
  const regex = /^(\d{1,4}+)\s?([m|h|d])$/i;
  const match = input.toLowerCase().match(regex);

  if (!match) throw new Error('❌ Неверный формат! Напишите интервал как в примере: `2d(2 дня) или 3h(3 часа) или 1m(1 месяц)`');

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    'm': 60 * 1000,
    'мин': 60 * 1000,
    'h': 60 * 60 * 1000,
    'час': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000,
    'д': 24 * 60 * 60 * 1000,
    'дн': 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] || 0);
}

// функция преобразования входной строки даты в ISO дату
export function parseFullDate(input: string): string {
  const dtRegex = /^(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}):(\d{2})$/;
  const match = input.match(dtRegex);

  if (!match) {
    throw new Error('❌ Невервот так:ный формат! Напишите дату  `15.04.2026 14:30`');
  }

  const [_, day, month, year, hour, minute] = match;
  const scheduledDate = new Date(+year, +month - 1, +day, +hour, +minute);
  const now = new Date();

  // Проверка на корректность даты (например, 32 января)
  if (isNaN(scheduledDate.getTime())) {
    throw new Error('❌ Похоже, такой даты не существует. Проверьте числа.');
  }

  // Проверка на будущее время
  if (scheduledDate <= now) {
    throw new Error('❌ Время должно быть в будущем! Сейчас: ' + now.toLocaleString('ru-RU'));
  }
  return scheduledDate.toISOString();
}