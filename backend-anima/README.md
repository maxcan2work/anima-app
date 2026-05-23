# Anima Backend

Первый backend для Anima: Express API, Prisma, SQLite, Discord OAuth, профиль пользователя и список просмотра.

## Запуск

```bash
npm install
npm run prisma:migrate -- --name init
npm run seed
npm run dev
```

API по умолчанию работает на `http://localhost:4000`.

## Discord OAuth

1. Создай приложение в Discord Developer Portal.
2. В OAuth2 добавь redirect URL:

```text
http://localhost:4000/auth/discord/callback
```

3. Заполни `.env`:

```env
DISCORD_CLIENT_ID="..."
DISCORD_CLIENT_SECRET="..."
DISCORD_REDIRECT_URI="http://localhost:4000/auth/discord/callback"
```

После этого вход начинается с:

```text
http://localhost:4000/auth/discord
```

## Endpoints

- `GET /health`
- `GET /auth/discord`
- `GET /auth/discord/callback`
- `POST /logout`
- `GET /me`
- `GET /anime`
- `GET /me/anime`
- `PUT /me/anime/:animeId`

## Репозиторий

Для проекта удобнее monorepo:

```text
anima/
  react-anima/
  backend-anima/
  desktop-anima/
  mobile-anima/
```

На GitHub это будет один репозиторий `anima`, внутри которого лежат отдельные приложения. Git submodules лучше не использовать на старте: они нужны, когда подпроекты действительно живут как независимые репозитории с отдельными версиями.
