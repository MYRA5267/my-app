# MYRA — подготовка к мобильным платформам (Capacitor)

Снимок текущего состояния Android/iOS-обёртки в дополнение к issues **#39 (Android)**
и **#40 (iOS)**. Тот же веб-билд (`dist/`) переиспользуется без изменений —
`capacitor.config.json` → `webDir: "dist"`, `appId: "app.myra.music"`.

## Что уже сделано (проверено в коде)

- [x] `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`
      установлены (`package.json`)
- [x] `appId`/`appName` — `app.myra.music`/`MYRA`, не плейсхолдер `com.example.app`
- [x] `npx cap sync` проходит на обеих платформах (проверено при первом подключении)
- [x] Поворот экрана заблокирован на Android (`AndroidManifest.xml`,
      `android:configChanges` включает `orientation`) — см. issue закрытую задачу
- [x] `env(safe-area-inset-*)` уже используется в `theme.css`/`overlays.tsx`/`player.tsx` —
      не голый расчёт под чёлку/жесты, а нативный CSS env
- [x] `isWeakEnvironment()` (`lib.tsx`) детектит `"Capacitor" in window` наравне со
      слабым Android WebView и включает `fx-simple` (см. CLAUDE.md, «Performance»)
- [x] CI: `build.yml` собирает unsigned/debug APK на каждый пуш во всех трёх ветках,
      unsigned iOS build-check на `main` + ручной запуск

## Явные пробелы (проверено — отсутствует в коде)

- [ ] **Аппаратная кнопка «назад» (Android)** — `@capacitor/app` не установлен,
      `App.addListener("backButton", ...)` нигде не вызывается. Сейчас системная
      кнопка «назад» либо сворачивает приложение, либо ведёт себя как обычная
      история браузера WebView — не закрывает открытые шторки/полноэкранный плеер
      явно. Нужно решить: перехватывать её и закрывать верхнюю открытую шторку
      (`Sheet`/`FullPlayer`) прежде, чем сворачивать приложение
- [ ] **Deep links** — в `AndroidManifest.xml` только стандартный
      `LAUNCHER`-intent-filter, схемы (`myra://`) или App Links (`https://` + verified
      domain) не настроены. Понадобится, если появится «поделиться треком» со
      ссылкой, открывающей именно приложение, а не браузер
- [ ] **Подписанные релизные сборки** — Android keystore и Apple Developer
      сертификаты не заведены (issue #39/#40); `build.yml` производит только
      unsigned/debug артефакты
- [ ] **Push-уведомления** — не реализованы ни на одной платформе (тот же вывод,
      что и в issue #38 для PWA)
- [ ] **Нативное фоновое воспроизведение** — сейчас управление медиа идёт только
      через Media Session API внутри WebView (см. `App.tsx`); полноценный foreground
      service (Android) или background audio mode (iOS) поверх Capacitor не подключены.
      CLAUDE.md явно запрещает обещать это в текстах интерфейса до реальной интеграции —
      актуально и сейчас

## Проверить на реальном устройстве перед бета-тестом

- [ ] Media Session: play/pause/next/prev/`seekto` из шторки уведомлений и локскрина
      (добавлено в Этапе 5 — `setPositionState`/`seekto` в `App.tsx`), не только в
      Chromium/desktop-эмуляции
- [ ] Поведение при потере/восстановлении сети внутри WebView — офлайн-страница
      (`public/offline.html`) рассчитана на браузерный service worker; уточнить,
      регистрируется ли SW внутри Capacitor WebView так же, как в обычном браузере,
      или там достаточно того, что все ассеты и так локальные (`webDir: dist`)
- [ ] Safe area на реальных вырезах/жестовой навигации (эмулятор часто не показывает
      те же инсеты, что реальное устройство)
- [ ] Клавиатура поверх полей ввода (Auth, чат поддержки, комментарии) — Capacitor
      WebView и обычный мобильный Safari/Chrome иногда ведут себя по-разному с `vh`

## Не делается до отдельного подтверждения

- Обещание нативного фонового воспроизведения в UI/маркетинге
- Подписанные релизные сборки без готовых keystore/сертификатов
- Публикация в Google Play/App Store (зависит от issues #39/#40/#44, включая
  юридическую часть — issue #42, «Лицензирование»)
