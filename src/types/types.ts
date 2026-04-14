import {Context} from 'telegraf'

export const AvailableSocialPlatform = {
  TELEGRAM: 'TELEGRAM',
  VK: 'VK',
  INSTAGRAM: 'INSTAGRAM'
} as const;


export type SocialPlatform = 'TELEGRAM' | 'VK' | 'INSTAGRAM';

//export type SocialPlatformType = typeof AvailableSocialPlatform[keyof typeof AvailableSocialPlatform];

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
  AWAITING_SCHEDULE: 'AWAITING_SCHEDULE' 
} as const

export interface PostDraft {
  text?: string;
  imageUrl?: string;
  autoGenerateImage?: boolean;
  platform: 'TG' | 'VK' | 'INST';
  scheduleType?: 'NOW' | 'ONCE' | 'REPEAT';
  publishTime?: string;
}

type typeBotState = typeof BotState[keyof typeof BotState];

export interface botContext extends Context {
  session: {
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
  };
}