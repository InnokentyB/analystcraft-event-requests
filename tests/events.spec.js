import { test, expect } from "@playwright/test";
const role = async (p, r) => p.getByLabel("Учебная роль").selectOption(r);
async function create(p, title = "Воркшоп по аналитике", complete = true) {
  await p.getByRole("button", { name: "Новая заявка", exact: true }).click();
  await p.getByLabel("Название мероприятия").fill(title);
  if (complete) {
    await p
      .getByLabel("Цель мероприятия")
      .fill("Согласовать процесс работы с требованиями");
    await p.getByLabel("Аудитория").fill("Команда аналитиков");
    await p.getByLabel("Дата проведения").fill("2026-11-20");
    await p.getByLabel("Ответственный").fill("Демо-ответственный");
    await p.getByLabel("Бюджет, ₽").fill("15000");
  }
  await p.getByRole("button", { name: "Сохранить черновик" }).click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("S01 full lifecycle, history, readiness and reload", async ({ page }) => {
  await expect(page.getByText("Заявок пока нет")).toBeVisible();
  await create(page);
  await expect(
    page.getByRole("button", { name: "План подготовки" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Отправить на согласование", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Согласовать", exact: true }),
  ).toHaveCount(0);
  await role(page, "organizer");
  await page.getByRole("button", { name: "Согласовать", exact: true }).click();
  await expect(
    page.locator(".history").getByText("Заявка согласована", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "План подготовки" }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(3);
  await expect(page.getByRole("checkbox").first()).toBeDisabled();
  await role(page, "owner");
  for (const cb of await page.getByRole("checkbox").all()) await cb.check();
  await expect(
    page.getByRole("heading", { name: "Мероприятие готово" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Мероприятие готово" }),
  ).toBeVisible();
  await page.getByRole("checkbox").first().uncheck();
  await expect(
    page.getByRole("heading", { name: "Осталось подготовить: 1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Карточка заявки" }).click();
  await expect(
    page.locator(".history").getByText("Заявка согласована", { exact: true }),
  ).toBeVisible();
});
test("S02 submission rules and draft editing", async ({ page }) => {
  await create(page, "Без обязательных данных", false);
  await page
    .getByRole("button", { name: "Отправить на согласование", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("цель");
  await expect(page.getByRole("alert")).toContainText("дату");
  await expect(page.getByRole("alert")).toContainText("ответственного");
  await expect(
    page.getByRole("button", { name: "План подготовки" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Редактировать заявку" }).click();
  await page.getByLabel("Название мероприятия").fill("  ");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByRole("alert")).toContainText("название");
});
test("S03 return needs comment, resubmission preserves decisions", async ({
  page,
}) => {
  await create(page);
  await page
    .getByRole("button", { name: "Отправить на согласование", exact: true })
    .click();
  await role(page, "organizer");
  await page.getByRole("button", { name: "Вернуть на доработку" }).click();
  await expect(page.getByRole("alert")).toContainText("комментарий");
  await page
    .getByLabel("Комментарий организатора")
    .fill("Уточните состав аудитории");
  await page.getByRole("button", { name: "Вернуть на доработку" }).click();
  await expect(
    page.getByText("Уточните состав аудитории").first(),
  ).toBeVisible();
  await role(page, "employee");
  await page.getByRole("button", { name: "Редактировать заявку" }).click();
  await page.getByLabel("Аудитория").fill("Старшие аналитики");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await page.getByRole("button", { name: "Повторно отправить" }).click();
  await role(page, "organizer");
  await page.getByRole("button", { name: "Согласовать", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("Заявка возвращена на доработку", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Повторно отправлена на согласование", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".history").getByText("Заявка согласована", { exact: true }),
  ).toBeVisible();
});
test("S04 demo adds once, preserves own data; search and role action filter", async ({
  page,
}) => {
  await create(page, "Моя заявка");
  await page.getByRole("button", { name: "Все заявки", exact: true }).click();
  await page.getByRole("button", { name: "Добавить демо-заявки" }).click();
  await page.getByRole("button", { name: "Добавить демо-заявки" }).click();
  await expect(
    page.getByRole("button", { name: "Открыть заявку Моя заявка" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /Открыть заявку/ }),
  ).toHaveCount(4);
  await page.getByLabel("Поиск заявок").fill("Моя");
  await expect(
    page.getByRole("button", { name: /Открыть заявку/ }),
  ).toHaveCount(1);
  await page.getByLabel("Поиск заявок").fill("");
  await role(page, "organizer");
  await page
    .getByRole("button", { name: "Требуют действия", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Открыть заявку/ }),
  ).toHaveCount(1);
});
test("S05 corrupted data is protected", async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem("analystcraft.events.v1", "broken"),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Данные браузера повреждены",
  );
  await expect(
    page.getByRole("button", { name: "Новая заявка", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(() => localStorage.getItem("analystcraft.events.v1")),
  ).toBe("broken");
});
test("S05 failed save reports error and stays on form", async ({ page }) => {
  await page.evaluate(
    () =>
      (Storage.prototype.setItem = function () {
        throw new DOMException("Quota", "QuotaExceededError");
      }),
  );
  await create(page);
  await expect(page.getByRole("alert")).toContainText("Не удалось сохранить");
  await expect(page.getByLabel("Название мероприятия")).toHaveValue(
    "Воркшоп по аналитике",
  );
});
test("S06 keyboard navigation and no horizontal overflow", async ({ page }) => {
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "К содержимому" })).toBeFocused();
  await page.keyboard.press("Enter");
  await create(page, "<img src=x onerror=alert(1)>");
  await expect(
    page.getByRole("heading", { name: "<img src=x onerror=alert(1)>" }),
  ).toBeVisible();
  expect(await page.locator("main img").count()).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("S07 accessibility on list, form, detail and preparation", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const audit = async () => {
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(report.violations).toEqual([]);
  };
  await audit();
  await page.getByRole("button", { name: "Новая заявка", exact: true }).click();
  await audit();
  await page.getByRole("button", { name: "Все заявки", exact: true }).click();
  await create(page);
  await audit();
  await page
    .getByRole("button", { name: "Отправить на согласование", exact: true })
    .click();
  await role(page, "organizer");
  await page.getByRole("button", { name: "Согласовать", exact: true }).click();
  await page.getByRole("button", { name: "План подготовки" }).click();
  await role(page, "owner");
  await audit();
});
