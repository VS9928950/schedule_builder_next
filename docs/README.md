# Документация Schedule Builder

Оглавление:

1. **[Установка с GitHub: Docker и без](install.md)** — клонирование, первый push на GitHub, `docker compose`, `npm start`.
2. **[Portainer: стек из Git (GitHub)](portainer-git.md)** — чеклист: Basic+PAT, версия CE, таймауты прокси, поля формы.
3. **[contrib/](../contrib/README.md)** — готовые фрагменты для Nginx (таймауты под Portainer + Git).
4. **[Архитектура и данные](architecture.md)** — стек, маршруты, модель проекта и сборок, где лежат файлы.
5. **[Развёртывание](deployment.md)** — продакшен, переменные окружения, бэкапы, обновления, post-deploy smoke checks.
6. **[Разработка](development.md)** — соглашения, проверка типов, layout/auth contracts, полезные точки входа в код.
7. **Auth hardening** — в `architecture.md` и `deployment.md`: подтверждение email, восстановление пароля, rate-limit auth и лимиты Excel загрузок.

Короткий обзор продукта и запуск с нуля — в корневом **[README.md](../README.md)**.

Дополнительно по инциденту May 2026:

- `architecture.md` — разбор регрессий и финального состояния layout/auth.
- `deployment.md` — проверка `/login -> /sign-in`, UI smoke checks и Docker permissions (`/app/data`).
- В текущей версии также задокументированы:
  - day-filter во вкладках `Аудитории`, `ВКС`, `Трансляции`, `Перевод`, `Волонтеры`, `Ответственные`;
  - выбор ответственного + проверка пересечений (пары конфликтов);
  - экспорт по областям (`view`) для `print`/`tilda`, включая `Архитектуру` и `tech-schedule`.
