export const KEY = "analystcraft.events.v1";
export const TASKS = [
  "Подготовить программу и материалы",
  "Подтвердить площадку и оборудование",
  "Подготовить приглашение для аудитории",
];
export const ROLES = {
  employee: "Сотрудник",
  organizer: "Организатор",
  owner: "Ответственный",
};
export const LABELS = {
  draft: "Черновик",
  review: "На согласовании",
  returned: "На доработке",
  preparation: "Подготовка",
  ready: "Готово",
};
export function status(e) {
  return e.status === "preparation" && e.tasks.every((t) => t.done)
    ? "ready"
    : e.status;
}
export function actionFor(e, role) {
  const s = status(e);
  if (role === "organizer" && s === "review") return "Принять решение";
  if (role === "employee" && ["draft", "returned"].includes(s))
    return s === "draft" ? "Заполнить и отправить" : "Исправить и отправить";
  if (role === "owner" && s === "preparation") return "Выполнить задачи";
  return "";
}
export function validData(value) {
  return (
    Array.isArray(value) &&
    value.length <= 2000 &&
    new Set(value.map((e) => e?.id)).size === value.length &&
    value.every(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.title === "string" &&
        e.title.trim().length > 0 &&
        (e.date === "" ||
          (/^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
            !Number.isNaN(Date.parse(e.date)))) &&
        (e.budget === "" ||
          (Number.isFinite(Number(e.budget)) && Number(e.budget) >= 0)) &&
        ["goal", "audience", "date", "owner", "budget"].every(
          (k) => typeof e[k] === "string",
        ) &&
        ["draft", "review", "returned", "preparation"].includes(e.status) &&
        Array.isArray(e.tasks) &&
        e.tasks.every(
          (t) => typeof t.label === "string" && typeof t.done === "boolean",
        ) &&
        (e.status === "preparation"
          ? e.tasks.length === 3
          : e.tasks.length === 0) &&
        Array.isArray(e.history) &&
        e.history.every(
          (h) =>
            typeof h.text === "string" &&
            typeof h.actor === "string" &&
            typeof h.at === "string" &&
            !Number.isNaN(Date.parse(h.at)) &&
            typeof h.comment === "string",
        ),
    )
  );
}
export function read() {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (!validData(data)) throw Error("Invalid storage");
  return data;
}
export function history(text, role, comment = "") {
  return { text, actor: ROLES[role], comment, at: new Date().toISOString() };
}
export function requirements(e) {
  const missing = [];
  if (!e.goal.trim()) missing.push("цель");
  if (
    !e.date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
    Number.isNaN(Date.parse(e.date))
  )
    missing.push("дату");
  if (!e.owner.trim()) missing.push("ответственного");
  if (!e.audience.trim()) missing.push("аудиторию");
  if (
    e.budget === "" ||
    !Number.isFinite(Number(e.budget)) ||
    Number(e.budget) < 0
  )
    missing.push("неотрицательный бюджет");
  return missing;
}
export function demo(existing) {
  const examples = [
    ["demo-webinar", "Вебинар: от идеи до релиза", "review"],
    ["demo-clients", "Встреча с клиентской командой", "preparation"],
    ["demo-training", "Внутреннее обучение аналитиков", "returned"],
  ];
  return examples
    .filter(([id]) => !existing.some((e) => e.id === id))
    .map(([id, title, state]) => ({
      id,
      title,
      goal: "Согласовать единый подход и следующие шаги",
      audience: "Демонстрационная команда",
      date: "2026-11-12",
      owner: "Демо-ответственный",
      budget: "12000",
      status: state,
      tasks:
        state === "preparation"
          ? TASKS.map((label, i) => ({ label, done: i === 0 }))
          : [],
      history: [
        history("Заявка создана", "employee"),
        history("Отправлена на согласование", "employee"),
        ...(state === "preparation"
          ? [history("Заявка согласована", "organizer")]
          : state === "returned"
            ? [
                history(
                  "Заявка возвращена на доработку",
                  "organizer",
                  "Уточните цель обучения и ожидаемый результат",
                ),
              ]
            : []),
      ],
    }));
}
