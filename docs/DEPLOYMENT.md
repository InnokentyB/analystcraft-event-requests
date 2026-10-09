# Самостоятельная публикация
Репозиторий и собственный GHCR-образ опубликованы 09.10.2026 по поручению владельца. Приложение на ВайбХостинге ещё не зарегистрировано и не развёрнуто; приглашения не использовались.
Контракт проверен 09.10.2026 по `LLMDevopsMVP/src/application-manifest.ts`, `src/deployment-service.ts`, `src/mcp-server.ts` и `LLMDevops/VIBEHOSTING_DEMO_QUICKSTART_2026-10-08.md`.

## Контракт
Manifest v1 имеет только version, kind, source, build, http, env, resources — см. deploy/manifest.template.json. Полный sourceCommit и image передаются отдельно в register_project, а не внутрь manifest. Stateless HTTP, 0.0.0.0:8080, GET /health → 200. 500 millicores, 256 МБ, без env/секретов/томов/БД. Runtime Node отдаёт статику; сборка выполнена заранее. Образ публичный GHCR, immutable `@sha256:…`; рекомендуем linux/amd64, либо multi-platform amd64/arm64.

## Владелец выполняет отдельно
1. Принять UAT локально. Запустить Docker Desktop и выполнить контейнерный smoke:

```sh
docker build --platform linux/amd64 -t analystcraft-events:local .
docker run --rm -d --name analystcraft-events-smoke --memory=256m --cpus=0.5 -p 18081:8080 analystcraft-events:local
curl --fail http://localhost:18081/health
E2E_BASE_URL=http://127.0.0.1:18081 npm run test:e2e
docker stop analystcraft-events-smoke
```

2. Создать отдельный публичный GitHub-репозиторий, опубликовать этот чистый commit. Не менять старый demo/starter. Адрес репозитория пока неизвестен. Свою авторизацию использовать обычным способом, не помещать токены в файлы приложения.
3. Собрать и опубликовать собственный образ (OWNER/REPOSITORY заменить; имя GHCR lowercase):

```sh
git status --short
git rev-parse HEAD
docker buildx build --platform linux/amd64 --tag ghcr.io/OWNER/REPOSITORY:$(git rev-parse HEAD) --push .
docker buildx imagetools inspect ghcr.io/OWNER/REPOSITORY:COMMIT
```

Проверьте Package visibility → Public и доступность без авторизации. Реальный digest берётся из вывода сборки/inspect, нельзя брать чужой. Образ должен быть собран именно из указанного commit, без незакоммиченных изменений.
4. Подготовить MCP-input локально (значения пока не получены):

```sh
node scripts/prepare-release.mjs https://github.com/OWNER/REPOSITORY ghcr.io/owner/repository@sha256:ACTUAL_DIGEST
```

Скрипт проверяет форму аргументов и чистый Git; не доказывает наличие образа и не выполняет сетевых действий. Полученный outputs/register-project.json содержит manifest, sourceCommit, image.
5. В своём MCP-клиенте выполнить get_account и проверить возможность размещения НОВОГО проекта. Пилот допускает один проект на аккаунт: текущий аккаунт уже может быть занят демо. **Не регистрировать поверх текущего приложения.** Нужен отдельно разрешённый владельцем аккаунт/слот; самостоятельно не расходовать оставшиеся приглашения. Затем register_project с полученным input, plan_deployment, проверить план, явная точная фраза `DEPLOY plan_…`, deploy_project и deployment_status. При изменении текущего контракта сверить tool schema перед действием.
6. Проверить публичный HTTPS /health, полный маршрут и reload уже на публичном origin. Данные localhost туда не переезжают. На одном origin все браузеры имеют свои независимые заявки. До первой версии откатывать нечего; для следующего релиза сохранить предыдущий собственный digest и использовать rollback workflow текущего MCP. Откат образа не откатывает localStorage.

## Резерв Railway
Отдельный новый сервис из этого Dockerfile/репозитория или собственного образа, порт 8080, health path /health, без томов и секретов. Настроить target port 8080 в домене; сервер также поддерживает PORT (по умолчанию 8080). Проверить тот же e2e на публичном URL. Внешних действий в этой работе не выполнялось.

## Честный остаток
Docker Desktop запущен; container build/run, /health и 16/16 e2e локально и в CI успешны. GitHub: https://github.com/InnokentyB/analystcraft-event-requests. Проверенная revision: ddce68cad3868c625579965cd0b99f4c84b7b7d4. Публичный GHCR image: ghcr.io/innokentyb/analystcraft-event-requests@sha256:b6dde0818cdd66f6b3d059ad44ed6c27fffbe82e562b73b7d9f41122a08c4c9e. Анонимный manifest inspect успешен; OCI revision совпадает с CI commit. CI: https://github.com/InnokentyB/analystcraft-event-requests/actions/runs/37926412953.

Остаются разрешение на одно приглашение, отдельный аккаунт/слот, регистрация, plan/deploy через MCP, публичный HTTPS smoke и owner UAT. Текущий аккаунт занят демо p0. Публикация образа не равна размещению приложения.
