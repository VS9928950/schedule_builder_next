# Установка: с GitHub, с Docker и без

Предполагается, что репозиторий уже на GitHub (см. раздел «Первый раз на GitHub» ниже).

## Требования

- **Node.js 20+** (LTS), если ставите без Docker.
- **Docker** и **Docker Compose** (v2), если ставите в контейнере.

## С Docker

1. Клонируйте репозиторий:

   ```bash
   git clone https://github.com/YOUR_USER/YOUR_REPO.git
   cd YOUR_REPO
   ```

2. Создайте файл **`.env`** в корне (рядом с `docker-compose.yml`):

   ```bash
   cp .env.example .env
   ```

   Откройте `.env` и задайте **`SB_SECRET`** — длинная случайная строка (не коммитьте `.env` в git).

3. Соберите и запустите:

   ```bash
   docker compose up -d --build
   ```

4. Откройте в браузере: **http://localhost:3000**

Данные (`data/store.json` и загрузки) хранятся в Docker-томе **`app_data`**, а не в рабочей копии репозитория.

Остановка: `docker compose down` (том по умолчанию сохранится; чтобы удалить и данные: `docker compose down -v` — осторожно).

## Без Docker

1. Клонируйте репозиторий и перейдите в каталог проекта.

2. Установите зависимости и соберите приложение:

   ```bash
   npm ci
   npm run build
   ```

3. Задайте секрет сессии и запустите:

   ```bash
   export SB_SECRET="замените-на-длинную-случайную-строку"
   npm start
   ```

   В Windows PowerShell:

   ```powershell
   $env:SB_SECRET = "замените-на-длинную-случайную-строку"
   npm start
   ```

4. Откройте **http://localhost:3000**

Каталог **`data/`** создастся рядом с проектом при первом использовании — его нужно бэкапить на продакшене.

Разработка без Docker: `npm run dev` (см. корневой README).

---

## Первый раз: залить проект на GitHub

### 1. Создайте пустой репозиторий на GitHub

На [github.com/new](https://github.com/new): имя репозитория, **без** галочек «Add README / .gitignore / license» (чтобы не было конфликта с локальным проектом).

### 2. На своём компьютере в каталоге проекта

Убедитесь, что в репозитории **нет** секретов и папки **`data/`** (они в `.gitignore`).

```powershell
cd "путь\к\schedule_builder_next"

git init
git add .
git commit -m "Initial commit: Schedule Builder Next.js"

git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

Подставьте **ваш** URL репозитория. Если GitHub просит логин: используйте **Personal Access Token** вместо пароля, или [GitHub CLI](https://cli.github.com/) (`gh auth login`).

### 3. Что не должно попасть в Git

Уже учтено в **`.gitignore`**: `node_modules/`, `.next/`, `data/`, `.env`, `.env*.local`.

Не коммитьте **`SB_SECRET`** и пользовательские данные.

### 4. Ссылка для других

После публикации можно дать:

- Клонирование: `git clone https://github.com/YOUR_USER/YOUR_REPO.git`
- Установка: этот файл (**[install.md](install.md)**) или короткий блок в README со ссылкой сюда.
