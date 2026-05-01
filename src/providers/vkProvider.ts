import { Telegraf } from 'telegraf';
import type {SocialPlatform, PostContent, IPoster} from '../types/types.ts'
import axios from 'axios';
import FormData from 'form-data';

export class VKPoster implements IPoster {

  private owner_id: string;
  private api_key: string;

  constructor(owner_id: string, api_key: string) {
    this.owner_id = owner_id;
    this.api_key = api_key;
  }

  async uploadPhotoToVk(imageBuffer: Buffer) {
    try {
      // Шаг 1: Получаем URL для загрузки
      // Важно: owner_id для этого метода пишется БЕЗ минуса
      const cleanOwnerId = this.owner_id.replace('-', '');
      const serverResponse = await axios.get('https://api.vk.com/method/photos.getWallUploadServer', {
        params: {
          group_id: cleanOwnerId,
          access_token: this.api_key,
          v: '5.131'
        }
      });
  
      const uploadUrl = serverResponse.data.response.upload_url;
  
      // Шаг 2: Загружаем файл на сервер VK
      const formData = new FormData();
      formData.append('photo', imageBuffer, { filename: 'image.jpg' });
  
      const uploadResponse = await axios.post(uploadUrl, formData, {
        headers: formData.getHeaders()
      });
  
      const { server, photo, hash } = uploadResponse.data;
  
      // Шаг 3: Сохраняем фото в ВК
      const saveResponse = await axios.get('https://api.vk.com/method/photos.saveWallPhoto', {
        params: {
          group_id: cleanOwnerId,
          server,
          photo,
          hash,
          access_token: this.api_key,
          v: '5.131'
        }
      });
  
      const photoData = saveResponse.data.response[0];
      // Формируем строку аттачмента: photo{owner_id}_{photo_id}
      return `photo${photoData.owner_id}_${photoData.id}`;
  
    } catch (error) {
      console.error('Ошибка загрузки фото в VK:', error);
      throw error;
    }
  }

  async post(message: string, ownerId: string, accessToken: string, image_link) {
    // 1. Очищаем текст от HTML-тегов
    const cleanMessage = message.replace(/<\/?[^>]+(>|$)/g, "");
    
    const url = 'https://api.vk.com/method/wall.post';
    
    // Параметры запроса
    const data = new URLSearchParams();
    data.append('owner_id', this.owner_id);
    data.append('from_group', '1');
    data.append('message', cleanMessage);
    data.append('access_token', this.api_key);
    data.append('v', '5.131');
    if(image_link){
      const response = await axios.get(image_link.href, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      const attachment = await this.uploadPhotoToVk(buffer);
      data.append('attachments', attachment);
    }
    try {
      const response = await axios.post(url, data);
      
      if (response.data.error) {
        console.error('Ошибка VK API:', response.data.error);
        throw new Error(response.data.error.error_msg);
      }
      
      console.log('Пост в ВК опубликован! ID:', response.data.response.post_id);
      return response.data.response.post_id;
    } catch (error) {
      console.error('Ошибка при публикации в ВК:', error);
      throw error;
    }
  }
}