# MYRA

MYRA — музыкальное приложение с каталогом, персональным потоком, профилями
артистов и социальной лентой. Один React-клиент выпускается как Web/PWA,
Android-приложение через Capacitor и Windows-приложение через Electron.

## Локальный запуск

Требования: Node.js 22+, pnpm 11.9.0, для Android — Android Studio/JDK 21.

```bash
pnpm install
pnpm dev
```

Переменные окружения перечислены в `.env.example`. В клиент можно передавать
только переменные `VITE_*`; service-role и ключи платежей хранятся исключительно
в Supabase Edge Functions.

## Проверка перед релизом

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Сборки

```bash
# Web/PWA
pnpm build

# Android: после web-сборки
pnpm exec cap sync android
cd android
./gradlew assembleDebug
./gradlew bundleRelease

# Windows
pnpm build
pnpm electron:build
```

Подробные действия владельца релиза, включая подпись Android/Windows, Supabase,
домены и магазины, находятся в `docs/RELEASE_1_0_CHECKLIST.md`.
