/** Before/after study of the same synthetic tasks, without exposing production data. */
const assert = require("node:assert/strict");
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const dir = join(require("node:os").tmpdir(), "nassican-pricing-qa");
const puppeteer = require(join(dir, "node_modules/puppeteer-core"));
const fixture = JSON.parse(readFileSync(join(dir, "fixtures.json"), "utf8"));
const flow = JSON.parse(readFileSync(join(dir, "flow-fixtures.json"), "utf8"));
const baseline = process.argv.includes("--baseline");
const origin = "http://localhost:3208";
async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await browser.setCookie(fixture.cookie);
  async function field(label) {
    for (const element of await page.$$("label"))
      if (await element.evaluate((e, label) => e.firstElementChild?.textContent === label, label))
        return element.$("input,select,textarea");
    throw new Error(`Missing field ${label}`);
  }
  async function fill(label, value) {
    const element = await field(label);
    await element.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await element.focus();
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    if (value) await element.type(value);
  }
  async function click(text) {
    for (const element of await page.$$("button"))
      if (
        await element.evaluate(
          (e, text) =>
            e.textContent.trim() === text && !e.matches(":disabled") && e.checkVisibility(),
          text,
        )
      ) {
        await element.evaluate((e) => e.scrollIntoView({ block: "center" }));
        await element.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
        return;
      }
    throw new Error(`Missing active button ${text}`);
  }
  try {
    const results = [];
    for (const mobile of [false, true]) {
      await page.setViewport({
        width: mobile ? 390 : 1440,
        height: 1000,
        isMobile: mobile,
        hasTouch: mobile,
      });
      await page.goto(`${origin}/precios/cobros?projectId=${flow.projectId}`, {
        waitUntil: "networkidle2",
      });
      assert.ok(!page.url().includes("/login"));
      const info = await page.evaluate(() => {
        const visible = (element) => {
          const box = element.getBoundingClientRect();
          return (
            element.checkVisibility() &&
            getComputedStyle(element).opacity !== "0" &&
            box.width >= 10 &&
            box.height >= 10
          );
        };
        const labels = [...document.querySelectorAll("label")];
        const received = labels
          .find((label) => label.firstElementChild?.textContent === "Importe recibido")
          ?.querySelector("input");
        const helps = [...document.querySelectorAll('button[aria-label^="Ayuda:"]')]
          .filter(visible)
          .map((button) => {
            const box = button.getBoundingClientRect(),
              css = getComputedStyle(button);
            const input = button.parentElement.querySelector(
              "label input, label select, label textarea",
            );
            return {
              width: box.width,
              height: box.height,
              radius: parseFloat(css.borderTopLeftRadius),
              overlap: input ? box.bottom > input.getBoundingClientRect().top + 1 : false,
            };
          });
        return {
          paymentTop: received?.getBoundingClientRect().top + scrollY,
          visibleFields: [
            ...document.querySelectorAll("main input, main select, main textarea"),
          ].filter(visible).length,
          helps,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      results.push({ device: mobile ? "touch-390" : "desktop-1440", ...info });
      if (!baseline) {
        assert.ok(info.helps.length > 0);
        assert.ok(
          info.helps.every(
            (h) => Math.abs(h.width - h.height) <= 1 && h.radius >= h.width / 2 && !h.overlap,
          ),
        );
        assert.equal(info.overflow, false);
        assert.equal(await page.$eval("#billing-configuration", (element) => element.open), false);
        const help = await page.$('button[aria-label="Ayuda: Importe recibido"]');
        if (mobile) await help.tap();
        else await help.click();
        await page.waitForSelector("[popover]:popover-open");
        assert.equal(
          await page.$eval(
            "[popover]:popover-open",
            (element) => element.getBoundingClientRect().right <= innerWidth - 8,
          ),
          true,
        );
        await page.keyboard.press("Escape");
        assert.equal(await page.$("[popover]:popover-open"), null);
        if (!mobile) {
          await help.focus();
          await page.keyboard.press("Enter");
          await page.waitForSelector("[popover]:popover-open");
          await page.keyboard.press("Escape");
        }
      }
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (theme) => document.documentElement.classList.toggle("dark", theme === "dark"),
          theme,
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({
          path: join(
            dir,
            `flow-${baseline ? "before" : "after"}-${mobile ? "touch" : "desktop"}-${theme}.png`,
          ),
          fullPage: true,
        });
      }
    }
    writeFileSync(
      join(dir, `flow-${baseline ? "before" : "after"}.json`),
      JSON.stringify(results, null, 2),
    );
    if (!baseline) {
      console.log("Checking protected payment draft.");
      const before = JSON.parse(readFileSync(join(dir, "flow-before.json"), "utf8"));
      for (const result of results) {
        const previous = before.find((p) => p.device === result.device);
        assert.ok(result.paymentTop < previous.paymentTop);
        assert.ok(result.visibleFields < previous.visibleFields);
      }
      const projectUrl = page.url();
      await fill("Importe recibido", "99000");
      await fill("Proyecto o avance pagado", "Borrador de pago para probar navegación");
      page.once("dialog", async (dialog) => {
        assert.match(dialog.message(), /sin guardar/);
        await dialog.dismiss();
      });
      await (await field("Cotización o proyecto")).select(`quoteId=${flow.quoteId}`);
      assert.equal(page.url(), projectUrl);
      assert.equal(await (await field("Importe recibido")).evaluate((e) => e.value), "99.000");
      await fill("Importe recibido", "");
      await fill("Proyecto o avance pagado", "");
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log("Checking inline acceptance.");
      await page.goto(`${origin}/precios/cobros?quoteId=${flow.quoteId}`, {
        waitUntil: "networkidle2",
      });
      const acceptanceUrl = page.url();
      assert.equal(
        await (await field("Importe recibido")).evaluate((e) => e.matches(":disabled")),
        true,
      );
      await click("Confirmar aceptación del cliente");
      console.log("Acceptance action returned.");
      await page.waitForFunction(() =>
        [...document.querySelectorAll("label")]
          .find((e) => e.firstElementChild?.textContent === "Importe recibido")
          ?.querySelector("input")
          ?.matches(":enabled"),
      );
      assert.equal(page.url(), acceptanceUrl);
      console.log("Accepted quote is ready for payment without another save.");
      await fill("Importe recibido", "100000");
      await fill("Proyecto o avance pagado", "Avance tras aceptación explícita");
      await click("Guardar pago recibido");
      await page.waitForFunction(() =>
        document.querySelector("[data-flexible-balance]")?.textContent.includes("900.000"),
      );
      assert.match(await page.$eval("[data-flexible-balance]", (e) => e.textContent), /900.000/);
      await page.goto(`${origin}/trabajos`, { waitUntil: "networkidle2" });
      const link = await page.$(
        `a[href="/precios/cobros?projectId=${flow.freshProjectId}&mode=flexible"]`,
      );
      assert.ok(link);
      await link.click();
      await page.waitForFunction(
        (id) =>
          location.search.includes(id) &&
          [...document.querySelectorAll("label")]
            .find((e) => e.firstElementChild?.textContent === "Modalidad de pago")
            ?.querySelector("select")?.value === "flexible",
        {},
        flow.freshProjectId,
      );
      assert.equal(await (await field("Modalidad de pago")).evaluate((e) => e.value), "flexible");
      const billing = JSON.parse(readFileSync(join(dir, "billing-fixtures.json"), "utf8"));
      await page.goto(`${origin}/precios/cobros?projectId=${billing.projectId}&mode=flexible`, {
        waitUntil: "networkidle2",
      });
      assert.equal(
        await (await field("Modalidad de pago")).evaluate((e) => e.value),
        "installments",
      );
      console.log(
        "Workflow checks passed: no navigation to accept/link/pay, payment draft protected on agreement change, job entry defaults to advances without changing existing quota plans; keyboard, touch, help geometry and popovers verified.",
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        results.map((result) => ({
          device: result.device,
          paymentTop: result.paymentTop,
          visibleFields: result.visibleFields,
          helpsRound: result.helps.every((h) => h.radius >= h.width / 2),
          helpOverlaps: result.helps.filter((h) => h.overlap).length,
        })),
      ),
    );
  } catch (error) {
    writeFileSync(
      join(dir, "flow-failure.txt"),
      await page.evaluate(() => location.href + "\n" + document.body.innerText),
    );
    await page.screenshot({ path: join(dir, "flow-failure.png"), fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
