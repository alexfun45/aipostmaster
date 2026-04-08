import {Context} from 'telegraf'

export enum SocialPlatform {
  TELEGRAM = 'tg',
  VK = 'vk',
  INSTAGRAM = 'inst'
}

export interface PostContent {
  text: string;
  imageUrl?: string;
}

export interface IPoster {
  platform: SocialPlatform;
  post(content: PostContent): Promise<boolean>;
}

export enum BotState {
  IDLE = 'IDLE',
  AWAITING_CHANNEL_ID = 'AWAITING_CHANNEL_ID',
  AWAITING_POST_TEXT = 'AWAITING_POST_TEXT',
  AWAITING_POST_IMAGE = 'AWAITING_POST_IMAGE',
  AWAITING_SCHEDULE = 'AWAITING_SCHEDULE'
}

export interface PostDraft {
  text?: string;
  imageUrl?: string;
  autoGenerateImage?: boolean;
  platform: 'TG' | 'VK' | 'INST';
  scheduleType?: 'NOW' | 'ONCE' | 'REPEAT';
  publishTime?: string;
}


export interface botContext extends Context {
  session: {
    state: BotState;
    draft?: PostDraft;
  }
}

export interface botSession {
  state: BotState;
  draft?: {
    platform: string;
    text?: string;
    targetId?: string;
  };
}