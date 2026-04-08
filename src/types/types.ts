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