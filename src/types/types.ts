import { constants } from 'fs';
import {Context} from 'telegraf'

export const AvailableSocialPlatform = {
  TELEGRAM: 'TELEGRAM',
  VK: 'VK',
  INSTAGRAM: 'INSTAGRAM'
} as const;


export type SocialPlatform = 'TELEGRAM' | 'VK' | 'INSTAGRAM';

export type AvailableSocialPlatform = typeof AvailableSocialPlatform[keyof typeof AvailableSocialPlatform];

export interface SocialPlatformType{
  [AvailableSocialPlatform: string]: string
}

export interface PostContent {
  text: string;
  imageUrl?: string;
}

export interface IPoster {
  platform: SocialPlatform;
  post(content: PostContent): Promise<boolean>;
}

export const BotState = {
  IDLE: 'IDLE',
  AWAITING_CHANNEL_ID: 'AWAITING_CHANNEL_ID',
  AWAITING_POST_TEXT: 'AWAITING_POST_TEXT',
  AWAITING_POST_IMAGE: 'AWAITING_POST_IMAGE',
  AWAITING_POST_DATETIME: 'AWAITING_POST_DATETIME',
  AWAITING_INTERVAL_VALUE: 'AWAITING_INTERVAL_VALUE',
  AWAITING_SCHEDULE: 'AWAITING_SCHEDULE',
  AWAITING_POST_IMAGE_UPLOAD: 'AWAITING_POST_IMAGE_UPLOAD',
  AWAITING_POST_IMAGE_PROMPT: 'AWAITING_POST_IMAGE_PROMPT',
  AWAITING_RANDOM_INTERVAL_DATETIME: 'AWAITING_RANDOM_INTERVAL_DATETIME',
  AWAITING_POST_PERIOD: 'AWAITING_POST_PERIOD'
} as const

export type BotState = typeof BotState[keyof typeof BotState];

export const PostFrequency = {
  ONCE:'ONCE',
  INTERVAL: 'INTERVAL', // Через промежуток
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY'
} as const

export type PostFrequency = typeof PostFrequency[keyof typeof PostFrequency];

export interface MassDraftItem {
  text: string;
  imageFileId?: string;
}

type FREQ_MODE_TYPE = 'REGULAR' | 'RANDOM';

export interface PostDraft {
  rawText?: string;
  text?: string;
  isDynamic?: boolean;
  autoGenerateImage?: boolean;
  platform?: SocialPlatform;
  imageSource?: 'UPLOAD' | 'AI' | 'NONE'; // Откуда картинка
  imageFileId?: string; // Если загрузил пользователь
  imageUrl?: string;    // Если сгенерировал ИИ
  imagePrompt?: string; // Промпт для генерации
  selectedPlatforms: string[];
  frequency?: PostFrequency | 'string';
  intervalValue?: string; // В минутах или часах
  freqmode?: string;
  scheduledAt?: string;
  massItems?: MassDraftItem[]; 
  isMassMode?: boolean;
  currentItem?: {
    text: string;
    imageFileId?: string;
  };
}

type typeBotState = typeof BotState[keyof typeof BotState];

export interface UserPlatform {
  type: 'TELEGRAM' | 'VK' | 'TWITTER';
  internalId: string;    // ID в самой соцсети (например, -100...)
  title: string;         // Название (например, "Мой лайфстайл блог")
  accessToken?: string;  // Токен (нужен для VK/Twitter, для TG не нужен)
  isActive: boolean;
}

export interface botContext extends Context {
  session: {
    platforms: UserPlatform[],
    state: typeBotState;
    draft?: PostDraft;
  }
}

export interface botSession {
  state: typeBotState;
  draft?: {
    platform: string;
    text?: string;
    targetId?: string;
    imageSource?: 'UPLOAD' | 'AI' | 'NONE'; // Откуда картинка
    imageFileId?: string; // Если загрузил пользователь
    imageUrl?: string;    // Если сгенерировал ИИ
    imagePrompt?: string; // Промпт для генерации
  };
}