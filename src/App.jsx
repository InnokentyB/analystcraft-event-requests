import React, { useState, useEffect, useRef } from "react";
import {
  CalendarDays,
  LayoutList,
  Plus,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Search,
  Clock,
  CheckCircle2,
  ClipboardList,
  Users,
  ArrowRight,
} from "lucide-react";
import {
  KEY,
  TASKS,
  ROLES,
  LABELS,
  status,
  actionFor,
  read,
  history,
  requirements,
  demo,
} from "./model";
const empty = {
  title: "",
  goal: "",
  audience: "",
  date: "",
  owner: "",
  budget: "",
};
const date = (d) =>
  d
    ? new Intl.DateTimeFormat("ru", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(d + "T12:00:00"))
    : "Дата не указана";
function initial() {
  try {
    return { events: read(), problem: "" };
  } catch {
    return {
      events: [],
      problem:
        "Данные браузера повреждены или недоступны. Существующее хранилище не изменено. Проверьте доступ к хранилищу браузера; сохраните его копию перед восстановлением.",
    };
  }
}
function Badge({ event }) {
  const s = status(event);
  return (
    <span className={"badge " + s}>
      <span className="dot" />
      {LABELS[s]}
    </span>
  );
}
export default function App() {
  const [loaded] = useState(initial),
    [events, setEvents] = useState(loaded.events),
    [problem, setProblem] = useState(loaded.problem),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [role, setRole] = useState(() => {
    try {
      const saved = sessionStorage.getItem("event-role");
      return ROLES[saved] ? saved : "employee";
    } catch {
      return "employee";
    }
  });
  const [route, setRoute] = useState(location.hash.slice(1) || "/"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [form, setForm] = useState(empty),
    [editing, setEditing] = useState(false),
    [comment, setComment] = useState("");
  const heading = useRef(null),
    firstFocus = useRef(true);
  useEffect(() => {
    const onHash = () => {
      setRoute(location.hash.slice(1) || "/");
      setError("");
      setNotice("");
      setEditing(false);
      setComment("");
    };
    window.addEventListener("hashchange", onHash);
    const onStorage = (e) => {
      if (e.key === KEY) {
        try {
          setEvents(read());
          setProblem("");
          setNotice("Список обновлён из другой вкладки.");
          setEditing(false);
        } catch {
          setProblem("Данные браузера повреждены. Хранилище не изменено.");
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    heading.current?.focus();
  }, [route, editing]);
  function go(path) {
    setError("");
    setNotice("");
    setEditing(false);
    setComment("");
    if (path === route) setRoute(path);
    else location.hash = path;
  }
  function save(next) {
    if (problem) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setEvents(next);
      setError("");
      return true;
    } catch {
      setError(
        "Не удалось сохранить данные в браузере. Освободите место или разрешите хранилище и повторите действие. Изменения не сохранены.",
      );
      return false;
    }
  }
  function changeRole(value) {
    setRole(value);
    setError("");
    try {
      sessionStorage.setItem("event-role", value);
    } catch {}
    setEditing(false);
    setComment("");
  }
  const id = route.split("/")[2],
    current = events.find((e) => e.id === id),
    isNew = route === "/new",
    plan = route.endsWith("/plan");
  const editable =
    current &&
    role === "employee" &&
    ["draft", "returned"].includes(current.status);
  function update(transform) {
    if (!current) return;
    return save(events.map((e) => (e.id === id ? transform(e) : e)));
  }
  function submitForm(ev) {
    ev.preventDefault();
    if (role !== "employee") return;
    const values = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim()]),
    );
    if (!values.title) {
      setError("Укажите название мероприятия.");
      return;
    }
    if (
      values.budget !== "" &&
      (!Number.isFinite(Number(values.budget)) || Number(values.budget) < 0)
    ) {
      setError("Бюджет должен быть неотрицательным числом.");
      return;
    }
    if (isNew) {
      const created = {
        ...values,
        id: crypto.randomUUID(),
        status: "draft",
        tasks: [],
        history: [history("Заявка создана", role)],
      };
      if (save([...events, created])) go("/request/" + created.id);
    } else if (editable) {
      if (
        save(
          events.map((e) =>
            e.id === id
              ? {
                  ...e,
                  ...values,
                  history: [
                    ...e.history,
                    history("Данные заявки обновлены", role),
                  ],
                }
              : e,
          ),
        )
      )
        setEditing(false);
    }
  }
  function submit() {
    if (!editable) return;
    const missing = requirements(current);
    if (missing.length) {
      setError("Перед отправкой укажите: " + missing.join(", ") + ".");
      return;
    }
    update((e) => ({
      ...e,
      status: "review",
      history: [
        ...e.history,
        history(
          e.status === "returned"
            ? "Повторно отправлена на согласование"
            : "Отправлена на согласование",
          role,
        ),
      ],
    }));
  }
  function decide(approve) {
    if (role !== "organizer" || current?.status !== "review") return;
    if (!approve && !comment.trim()) {
      setError(
        "Добавьте комментарий: что нужно исправить перед повторной отправкой.",
      );
      return;
    }
    const saved = update((e) => ({
      ...e,
      status: approve ? "preparation" : "returned",
      tasks: approve ? TASKS.map((label) => ({ label, done: false })) : [],
      history: [
        ...e.history,
        history(
          approve ? "Заявка согласована" : "Заявка возвращена на доработку",
          role,
          comment.trim(),
        ),
      ],
    }));
    if (saved) setComment("");
  }
  function toggle(index) {
    if (role !== "owner" || current?.status !== "preparation") return;
    update((e) => {
      const tasks = e.tasks.map((t, i) =>
        i === index ? { ...t, done: !t.done } : t,
      );
      const wasReady = status(e) === "ready",
        nowReady = tasks.every((t) => t.done);
      return {
        ...e,
        tasks,
        history: [
          ...e.history,
          history(
            (tasks[index].done ? "Выполнено: " : "Снята отметка: ") +
              tasks[index].label,
            role,
          ),
          ...(wasReady !== nowReady
            ? [
                history(
                  nowReady
                    ? "Мероприятие готово"
                    : "Мероприятие снова требует подготовки",
                  role,
                ),
              ]
            : []),
        ],
      };
    });
  }
  function addDemo() {
    const additions = demo(events);
    if (!additions.length) {
      setNotice("Демо-заявки уже добавлены. Ваши заявки сохранены.");
      return;
    }
    if (save([...events, ...additions]))
      setNotice(
        "Добавлены 3 синтетические демо-заявки. Ваши заявки сохранены.",
      );
  }
  const visible = events.filter(
    (e) =>
      (filter === "all" ||
        (filter === "actions" && actionFor(e, role)) ||
        status(e) === filter) &&
      [e.title, e.owner, e.audience]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const formView = (
    <form className="form panel" onSubmit={submitForm} noValidate>
      <div className="form-grid">
        <label className="wide">
          Название мероприятия
          <input
            maxLength={160}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Например, воркшоп по аналитике"
          />
        </label>
        <label className="wide">
          Цель мероприятия
          <textarea
            maxLength={2000}
            value={form.goal}
            onChange={(e) => setForm({ ...form, goal: e.target.value })}
            placeholder="Какого результата хотите достичь?"
            rows={3}
          />
        </label>
        <label className="wide">
          Аудитория
          <input
            maxLength={300}
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            placeholder="Кому будет полезно мероприятие"
          />
        </label>
        <label>
          Дата проведения
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>
        <label>
          Бюджет, ₽
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
            placeholder="0"
          />
        </label>
        <label className="wide">
          Ответственный
          <input
            maxLength={160}
            value={form.owner}
            onChange={(e) => setForm({ ...form, owner: e.target.value })}
            placeholder="Учебное имя или команда"
          />
        </label>
      </div>
      <div className="form-footer">
        <p>
          Для черновика достаточно названия.
          <br />
          Остальные поля нужны перед отправкой.
        </p>
        <button className="primary" type="submit">
          {isNew ? "Сохранить черновик" : "Сохранить изменения"}
        </button>
      </div>
    </form>
  );
  return (
    <>
      <a
        className="skip"
        href="#content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("content").focus();
        }}
      >
        К содержимому
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <a
            className="brand"
            href="#/"
            aria-label="AnalystCraft — список заявок"
          >
            <span className="brand-mark">
              <CalendarDays size={23} />
            </span>
            <span>
              AnalystCraft<small>Рабочая среда мероприятий</small>
            </span>
          </a>
          <div className="nav-label">Рабочее пространство</div>
          <button className="nav-item" onClick={() => go("/")}>
            <LayoutList size={19} />
            Заявки на мероприятия<span>{events.length}</span>
          </button>
          <div className="sidebar-bottom">
            <span className="demo-label">Учебный проект</span>
            <p>
              От идеи к согласованному
              <br />и подготовленному событию.
            </p>
            <div className="brand-rule" />{" "}
            <small>Решения. Ответственность. Готовность.</small>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <span className="topbar-title">Управление мероприятиями</span>
            <label className="role">
              Учебная роль
              <select
                aria-label="Учебная роль"
                value={role}
                onChange={(e) => changeRole(e.target.value)}
              >
                {Object.entries(ROLES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </header>
          <main id="content" tabIndex={-1}>
            <div className="local-note">
              <span className="local-dot" />
              <span>
                Данные только в этом браузере. Сохраняются после перезагрузки.
                Роли учебные, без авторизации.
              </span>
            </div>
            {problem && (
              <div className="alert" role="alert">
                {problem}
              </div>
            )}
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="notice" role="status">
                {notice}
              </div>
            )}
            {route === "/" ? (
              <>
                <div className="page-heading">
                  <div>
                    <h1 ref={heading} tabIndex={-1}>
                      Заявки на мероприятия
                    </h1>
                    <p>
                      Согласуйте идею, распределите подготовку, проверьте
                      готовность.
                    </p>
                  </div>
                  <button
                    className="primary"
                    disabled={!!problem || role !== "employee"}
                    onClick={() => {
                      setForm(empty);
                      go("/new");
                    }}
                  >
                    <Plus size={18} />
                    Новая заявка
                  </button>
                </div>
                <div className="overview">
                  <span>
                    <b>{events.length}</b> всего заявок
                  </span>
                  <span>
                    <b>{events.filter((e) => e.status === "review").length}</b>{" "}
                    на согласовании
                  </span>
                  <span>
                    <b>{events.filter((e) => status(e) === "ready").length}</b>{" "}
                    готовы к проведению
                  </span>
                </div>
                <div className="toolbar">
                  <div className="filters">
                    <button
                      className={filter === "all" ? "active" : ""}
                      onClick={() => setFilter("all")}
                    >
                      Все заявки
                    </button>
                    <button
                      aria-label="Требуют действия"
                      className={filter === "actions" ? "active" : ""}
                      onClick={() => setFilter("actions")}
                    >
                      Требуют действия
                      <span>
                        {events.filter((e) => actionFor(e, role)).length}
                      </span>
                    </button>
                  </div>
                  <label className="search">
                    <Search size={18} />
                    <input
                      aria-label="Поиск заявок"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Название, аудитория, ответственный"
                    />
                  </label>
                  <select
                    aria-label="Фильтр по статусу"
                    value={["all", "actions"].includes(filter) ? "all" : filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">Все статусы</option>
                    {Object.entries(LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <section className="registry panel" aria-label="Реестр заявок">
                  {events.length === 0 ? (
                    <div className="empty">
                      <ClipboardList size={40} strokeWidth={1.4} />
                      <h2>Заявок пока нет</h2>
                      <p>
                        Начните с идеи мероприятия.
                        <br />
                        Согласование и план подготовки появятся по ходу работы.
                      </p>
                      <button
                        className="text-button"
                        disabled={!!problem}
                        onClick={addDemo}
                      >
                        Добавить демо-заявки
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : visible.length === 0 ? (
                    <div className="empty">
                      <Search size={32} />
                      <h2>Подходящих заявок нет</h2>
                      <p>Попробуйте другое название или измените фильтр.</p>
                      <button
                        onClick={() => {
                          setQuery("");
                          setFilter("all");
                        }}
                      >
                        Сбросить поиск и фильтры
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="table-head">
                        <span>Мероприятие</span>
                        <span>Дата / ответственный</span>
                        <span>Статус</span>
                        <span>Следующий шаг</span>
                      </div>
                      {visible.map((e) => (
                        <button
                          key={e.id}
                          className="event-row"
                          aria-label={"Открыть заявку " + e.title}
                          onClick={() => go("/request/" + e.id)}
                        >
                          <span className="event-name">
                            <strong>{e.title}</strong>
                            <small>
                              {e.audience || "Аудитория не указана"}
                            </small>
                          </span>
                          <span className="event-date">
                            {date(e.date)}
                            <small>
                              {e.owner || "Ответственный не назначен"}
                            </small>
                          </span>
                          <span>
                            <Badge event={e} />
                          </span>
                          <span className="next-action">
                            {actionFor(e, role) || "Просмотреть заявку"}
                            <ArrowUpRight size={17} />
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </section>
                <footer className="list-footer">
                  <span>
                    Демо-данные синтетические и добавляются без замены ваших
                    заявок.
                  </span>
                  {events.length > 0 && (
                    <button
                      className="text-button"
                      disabled={!!problem}
                      onClick={addDemo}
                    >
                      Добавить демо-заявки
                    </button>
                  )}
                </footer>
              </>
            ) : isNew || editing ? (
              <>
                <button
                  className="back"
                  onClick={() => go(isNew ? "/" : "/request/" + id)}
                >
                  <ArrowLeft size={17} />
                  {isNew ? "Все заявки" : "Карточка заявки"}
                </button>
                <div className="page-heading">
                  <div>
                    <h1 ref={heading} tabIndex={-1}>
                      {isNew ? "Новая заявка" : "Редактирование заявки"}
                    </h1>
                    <p>Зафиксируйте идею и условия проведения мероприятия.</p>
                  </div>
                </div>
                {role === "employee" && !problem ? (
                  formView
                ) : (
                  <div className="panel empty">
                    Создание и редактирование доступны в роли «Сотрудник».
                  </div>
                )}
              </>
            ) : current ? (
              <>
                <button className="back" onClick={() => go("/")}>
                  <ArrowLeft size={17} />
                  Все заявки
                </button>
                <div className="page-heading detail-heading">
                  <div>
                    <Badge event={current} />
                    <h1 ref={heading} tabIndex={-1}>
                      {current.title}
                    </h1>
                    <p>
                      {date(current.date)} ·{" "}
                      {current.owner || "Ответственный не назначен"}
                    </p>
                  </div>
                </div>
                <div className="tabs">
                  <button
                    className={!plan ? "active" : ""}
                    onClick={() => go("/request/" + id)}
                  >
                    Карточка заявки
                  </button>
                  <button
                    className={plan ? "active" : ""}
                    disabled={current.status !== "preparation"}
                    onClick={() => go("/request/" + id + "/plan")}
                  >
                    План подготовки
                  </button>
                </div>
                {plan && current.status === "preparation" ? (
                  <section className="preparation-panel panel">
                    <div
                      className={
                        "readiness " +
                        (status(current) === "ready" ? "complete" : "")
                      }
                    >
                      <CheckCircle2 size={30} />
                      <div>
                        <h2>
                          {status(current) === "ready"
                            ? "Мероприятие готово"
                            : "Осталось подготовить: " +
                              current.tasks.filter((t) => !t.done).length}
                        </h2>
                        <p>
                          {status(current) === "ready"
                            ? "Все обязательные задачи выполнены. Можно проводить мероприятие."
                            : "Готовность появится после выполнения всех обязательных задач."}
                        </p>
                      </div>
                      <span>
                        {current.tasks.filter((t) => t.done).length} / 3
                      </span>
                    </div>
                    <div
                      className="progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={3}
                      aria-valuenow={current.tasks.filter((t) => t.done).length}
                      aria-label="Выполнение обязательных задач"
                    >
                      <div
                        style={{
                          width:
                            (current.tasks.filter((t) => t.done).length / 3) *
                              100 +
                            "%",
                        }}
                      />
                    </div>
                    <h3>Обязательные задачи</h3>
                    <p className="muted">
                      Ответственный: {current.owner}.{" "}
                      {role !== "owner"
                        ? "Для отметок переключитесь на роль «Ответственный»."
                        : "Отметьте выполненную работу."}
                    </p>
                    <div className="tasks">
                      {current.tasks.map((t, i) => (
                        <label
                          key={t.label}
                          className={t.done ? "task done" : "task"}
                        >
                          <input
                            type="checkbox"
                            checked={t.done}
                            disabled={!!problem || role !== "owner"}
                            onChange={() => toggle(i)}
                          />
                          <span>
                            {t.label}
                            <small>Обязательная задача</small>
                          </span>
                          {t.done && <Check size={19} />}
                        </label>
                      ))}
                    </div>
                  </section>
                ) : (
                  <div className="detail-grid">
                    <section className="panel details">
                      <h2>О мероприятии</h2>
                      <dl>
                        <div className="wide">
                          <dt>Цель</dt>
                          <dd>{current.goal || "Не указана"}</dd>
                        </div>
                        <div className="wide">
                          <dt>Аудитория</dt>
                          <dd>{current.audience || "Не указана"}</dd>
                        </div>
                        <div>
                          <dt>Дата проведения</dt>
                          <dd>{date(current.date)}</dd>
                        </div>
                        <div>
                          <dt>Бюджет</dt>
                          <dd>
                            {current.budget !== ""
                              ? new Intl.NumberFormat("ru", {
                                  style: "currency",
                                  currency: "RUB",
                                  maximumFractionDigits: 2,
                                }).format(Number(current.budget))
                              : "Не указан"}
                          </dd>
                        </div>
                        <div className="wide">
                          <dt>Ответственный</dt>
                          <dd>{current.owner || "Не назначен"}</dd>
                        </div>
                      </dl>
                      {editable && (
                        <button
                          disabled={!!problem}
                          onClick={() => {
                            setForm(
                              Object.fromEntries(
                                Object.keys(empty).map((k) => [k, current[k]]),
                              ),
                            );
                            setEditing(true);
                            setError("");
                          }}
                        >
                          Редактировать заявку
                        </button>
                      )}
                    </section>
                    <section className="panel decisions">
                      <h2>Следующий шаг</h2>
                      {current.status === "draft" ||
                      current.status === "returned" ? (
                        <>
                          <h3>
                            {current.status === "returned"
                              ? "Исправьте заявку"
                              : "Отправьте идею на согласование"}
                          </h3>
                          <p>
                            {current.status === "returned"
                              ? current.history
                                  .filter(
                                    (h) =>
                                      h.text ===
                                      "Заявка возвращена на доработку",
                                  )
                                  .at(-1)?.comment
                              : "Организатор проверит цель, условия и бюджет мероприятия."}
                          </p>
                          {editable ? (
                            <button
                              className="primary"
                              disabled={!!problem}
                              onClick={submit}
                            >
                              {current.status === "returned"
                                ? "Повторно отправить"
                                : "Отправить на согласование"}
                            </button>
                          ) : (
                            <p className="muted">
                              Действие доступно в роли «Сотрудник».
                            </p>
                          )}
                        </>
                      ) : current.status === "review" ? (
                        <>
                          <h3>Нужно решение организатора</h3>
                          <p>
                            Согласуйте заявку или объясните, что нужно
                            доработать.
                          </p>
                          {role === "organizer" ? (
                            <>
                              <label>
                                Комментарий организатора
                                <textarea
                                  value={comment}
                                  maxLength={2000}
                                  onChange={(e) => setComment(e.target.value)}
                                  placeholder="Обязателен при возврате"
                                  rows={3}
                                />
                              </label>
                              <button
                                className="primary"
                                disabled={!!problem}
                                onClick={() => decide(true)}
                              >
                                Согласовать
                              </button>
                              <button
                                className="return"
                                disabled={!!problem}
                                onClick={() => decide(false)}
                              >
                                Вернуть на доработку
                              </button>
                            </>
                          ) : (
                            <p className="muted">
                              Переключитесь на роль «Организатор».
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <h3>
                            {status(current) === "ready"
                              ? "Всё готово к проведению"
                              : "Заявка согласована"}
                          </h3>
                          <p>
                            Решение сохранено. Ответственный может работать с
                            планом подготовки.
                          </p>
                          <button
                            className="primary"
                            onClick={() => go("/request/" + id + "/plan")}
                          >
                            Открыть план
                            <ArrowRight size={17} />
                          </button>
                        </>
                      )}
                    </section>
                  </div>
                )}
                <section className="history">
                  <h2>
                    <Clock size={19} />
                    История заявки
                  </h2>
                  <ol>
                    {[...current.history].reverse().map((h, i) => (
                      <li key={i}>
                        <div className="timeline-dot" />
                        <div>
                          <strong>{h.text}</strong>
                          {h.comment && <p>{h.comment}</p>}
                          <small>
                            {h.actor} ·{" "}
                            {new Intl.DateTimeFormat("ru", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(h.at))}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            ) : (
              <div className="empty panel">
                <h1 ref={heading} tabIndex={-1}>
                  Заявка не найдена
                </h1>
                <p>Она могла быть создана в другом браузере.</p>
                <button onClick={() => go("/")}>Все заявки</button>
              </div>
            )}
          </main>
          <footer className="workspace-footer">
            AnalystCraft · Учебная версия<span>От заявки до готовности</span>
          </footer>
        </div>
      </div>
    </>
  );
}
