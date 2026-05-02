# Установка через Portainer (только Git → GitHub)

Цель: любой человек с Portainer и Docker поднимает стек **только из репозитория**, без ручного `git clone` на сервере.

## Обязательный чеклист (сверху вниз)

1. **Portainer Community Edition** не ниже **2.27.1** (внизу UI указана версия). В **2.27.0** у части установок ломался re-deploy из Git ([issue #12575](https://github.com/portainer/portainer/issues/12575)); в **2.27.1** исправлено.
2. Если Portainer открывается **через Nginx / Traefik / Caddy** — увеличьте таймауты до **900 s** на upstream Portainer. Иначе клон репозитория при деплое **обрывается по таймауту прокси** (часто маскируется как `TLS handshake timeout` / `context deadline exceeded`). Готовый фрагмент для Nginx: **[`contrib/nginx-portainer-timeouts.conf`](../contrib/nginx-portainer-timeouts.conf)**.
3. **GitHub + приватный репозиторий:** в Portainer в блоке аутентификации выберите **Authorization type: Basic** (не «Token»). Официально: *«GitHub … expect **Basic Auth**, even when using a … token»* — [документация Portainer](https://docs.portainer.io/user/docker/stacks/add#option-3-git-repository).  
   - **Username:** логин GitHub (например `VS9928950`).  
   - **Password / Personal Access Token:** вставьте **только PAT** (classic: право **`repo`**; fine-grained: **Contents: Read** для этого репозитория).
4. **Repository URL:** `https://github.com/VS9928950/schedule_builder_next.git` (или ваш форк — тот же формат).
5. **Repository reference:** `refs/heads/main` или `main`.
6. **Compose path:** `docker-compose.yml` (файл в **корне** репозитория).
7. В **Environment variables** стека задайте **`SB_SECRET`** — длинная случайная строка (например `openssl rand -hex 32` на любом ПК). Это секрет **приложения** (сессии), не PAT.
8. После смены прокси или обновления Portainer при необходимости: **`sudo systemctl restart docker`**, подождать ~1 мин, снова **Deploy the stack**.

---

## Поля формы (кратко)

| Поле | Значение |
|------|----------|
| Stack name | например `schedule-builder` |
| Build method | **Repository** |
| Repository URL | `https://github.com/VS9928950/schedule_builder_next.git` |
| Repository reference | `main` или `refs/heads/main` |
| Compose path | `docker-compose.yml` |
| Authentication | Вкл. для **private** |
| Authorization type | **Basic** |
| Username | GitHub login |
| Password | PAT |

---

## Проверки на сервере

**Хост до GitHub:**

```bash
curl -vI --max-time 20 https://github.com
```

**Та же сеть, что у контейнера `portainer`** (имя контейнера может отличаться):

```bash
docker run --rm --network container:portainer curlimages/curl:8.5.0 -sI --max-time 25 https://github.com | head -5
```

Ожидается **`HTTP/2 200`**. Если здесь ошибка — чинить Docker/сеть; если здесь **200**, а деплой из Git падает — почти всегда **прокси перед Portainer** или **версия Portainer** / тип **Basic** для GitHub.

**Полный Git с хоста (проверка PAT для приватного репо):**

```bash
export GH_TOKEN='ваш_PAT'
GIT_TERMINAL_PROMPT=0 git ls-remote --heads "https://${GH_TOKEN}@github.com/VS9928950/schedule_builder_next.git"
unset GH_TOKEN
```

---

## Публичный репозиторий

Если репозиторий **public**, **Authentication** выключите. Тогда PAT для клона не нужен (удобно для «другого человека» и второго сервера без передачи секретов GitHub).

---

## Диагностика по сообщению об ошибке

| Сообщение | Что проверить в первую очередь |
|-----------|----------------------------------|
| `TLS handshake timeout` / `context deadline exceeded` | Прокси перед Portainer (таймауты 900s), версия Portainer ≥ 2.27.1, `systemctl restart docker` |
| `401` / `repository not found` | Приватный репо: Basic + верный PAT + правильный URL |
| `invalid reference format` | Поле **Repository reference** (ветка `main`) |
