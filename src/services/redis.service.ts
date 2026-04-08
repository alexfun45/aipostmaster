import { createClient } from 'redis';

let client: any = null;
let connectPromise: Promise<any> | null = null; // Храним процесс подключения

export const initRedis = async (): Promise<any> => {
  if (!client) {
      client = createClient({
          url: 'redis://127.0.0.1:6379'
      });
      client.on('error', (err: any) => {
        // Игнорируем ошибки сокета, которые возникают при повторных попытках
        if (!err.message.includes('Socket already opened')) {
            console.error('Redis Error:', err);
        }
    });
  }

  // Если клиент уже открыт библиотекой сессий, просто возвращаем его
  if (client.isOpen) {
    return client;
    }

    if (connectPromise) {
        return connectPromise;
    }
connectPromise = (async () => {
    try {
        console.log('connect socket');
        await client.connect();
        console.log('🚀 Redis подключен вручную');
        return client;
    } catch (err: any) {
        if (err.message.includes('Socket already opened')) {
            return client;
        }
        connectPromise = null; // Сбрасываем, чтобы можно было попробовать еще раз
        throw err;
    }
  return client;
}
)();
return connectPromise;
}

export { client as redis };