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
  //post(content: PostContent): Promise<boolean>;
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
  AWAITING_POST_PERIOD: 'AWAITING_POST_PERIOD',
  AWAITING_CHANNEL_VK_ID: 'AWAITING_CHANNEL_VK_ID',
  AWAITING_API_KEY: 'AWAITING_API_KEY'
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

export type PostFreqType = 'ONCE' | 'INTERVAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface MassDraftItem {
  text: string;
  platformId: string;
  imageFileId?: string;
  results: UserPlatform[]
}

type FREQ_MODE_TYPE = 'REGULAR' | 'RANDOM';

type result_type = {
  platformId: string,
  type: string,
  content: string
}

export type STATUS_TYPES = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface PostDraft {
  id?: string;
  userId?: number;
  rawText?: string;
  text?: string;
  isDynamic?: boolean;
  autoGenerateImage?: boolean;
  platform?: SocialPlatform;
  imageSource?: 'UPLOAD' | 'AI' | 'NONE'; // Откуда картинка
  imageFileId?: string; // Если загрузил пользователь
  imageUrl?: string;    // Если сгенерировал ИИ
  imagePrompt?: string; // Промпт для генерации
  selectedPlatforms?: string[];
  frequency?: PostFreqType;
  intervalValue?: string; 
  intervalMs?: string | number;
  scheduleMode?: string; // режим выбора времени при массовом автопостинге(REGUAL - в одно время или RANDOM - в случайное)
  scheduledAt?: number;
  massItems?: MassDraftItem[]; 
  status?: STATUS_TYPES;
  results?: UserPlatform[];
  isMassMode?: boolean;
  currentItem?: {
    text: string;
    imageFileId?: string;
  };
}

type typeBotState = typeof BotState[keyof typeof BotState];

export interface UserPlatform {
  type: SocialPlatform;
  internalId?: string;    // ID в самой соцсети (например, -100...)
  title?: string;         // Название (например, "Мой лайфстайл блог")
  content?: string;
  accessToken?: string;  // Токен (нужен для VK/Twitter, для TG не нужен)
  isActive: boolean;
}



export interface ITask {
  id: string,
  userId: number,
  results: UserPlatform[],
  imageFileId: string | null,
  imageSource: string,
  created_at: string,
  rawText?: string,
  scheduledAt: string,
  intervalMs?: number,
  isDynamic: boolean,
  status: STATUS_TYPES,
  frequency: string
}

export interface botContext extends Context {
  session: {
    platforms: UserPlatform[],
    activeTasks: PostDraft[] | null,
    state: typeBotState;
    currentSaveGroup: string;
    draft?: PostDraft;
  }
}

export interface MySessionData {
  state: BotState;
  platforms: UserPlatform[];
  currentSaveGroup: string;
  draft?: PostDraft;
}

export interface botSession {
  state: typeBotState;
  draft?: PostDraft
}