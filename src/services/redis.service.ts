import { createClient } from 'redis';

// Создаем клиент ОДИН РАЗ при загрузке модуля
const client = createClient({
    url: 'redis://127.0.0.1:6379'
});

client.on('error', (err: any) => {
    if (!err.message.includes('Socket already opened')) {
        console.error('Redis Error:', err);
    }
});

let connectPromise: Promise<any> | null = null;

export const initRedis = async (): Promise<any> => {
    // 1. Если уже открыто — отдаем сразу
    if (client.isOpen) {
        return client;
    }

    // 2. Если сейчас в процессе открытия — ждем этот процесс
    if (connectPromise) {
        return connectPromise;
    }

    // 3. Запускаем подключение
    connectPromise = (async () => {
        try {
            // Проверяем еще раз статус перед коннектом
            if (!client.isOpen) {
                await client.connect();
                console.log('🚀 Redis подключен');
            }
            return client;
        } catch (err: any) {
            if (err.message.includes('Socket already opened')) {
                return client;
            }
            // Если упало — зануляем промис, чтобы следующая попытка создала новый
            connectPromise = null; 
            throw err;
        }
    })();

    return connectPromise;
};

export { client as redis };