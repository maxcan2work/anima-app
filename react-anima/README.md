# Anima Web

Первая веб-версия приложения для просмотра аниме. Сейчас работает без бэкенда: каталог, карточка тайтла, mock-плеер, выбор серии и локальный прогресс в `localStorage`.

## Команды

```bash
npm install
npm run dev
npm run build
```

Dev-сервер Vite по умолчанию открывается на `http://localhost:5173`.

## Backend

По умолчанию веб-клиент обращается к API на `http://localhost:4000`.

Если нужен другой адрес, создай `.env`:

```env
VITE_API_URL="http://localhost:4000"
```

Вход через Discord ведет на backend endpoint:

```text
http://localhost:4000/auth/discord
```
