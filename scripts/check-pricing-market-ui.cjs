/** Real Chrome regression for market filters; uses disposable --fixtures / --prepare-ui rows. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const directory = join(require("node:os").tmpdir(), "nassican-pricing-qa");
const puppeteer = require(join(directory, "node_modules/puppeteer-core"));
const fixture = JSON.parse(readFileSync(join(directory, "fixtures.json"), "utf8"));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.dismiss());
  await browser.setCookie(fixture.cookie);
  async function control(label) {
    for (const e of await page.$$("label"))
      if (await e.evaluate((e, label) => e.firstElementChild?.textContent === label, label))
        return e.$("input,select,textarea");
    throw new Error(`Missing control: ${label}`);
  }
  async function click(label) {
    for (const e of await page.$$("button")) {
      if (
        await e.evaluate(
          (e, label) => e.textContent.replace(/\s+/g, " ").trim() === label && !e.disabled,
          label,
        )
      ) {
        await e.click();
        return;
      }
    }
    throw new Error(`Missing enabled button: ${label}`);
  }
  async function applied(scope, unit, mode, serviceId = fixture.serviceId) {
    await page.waitForFunction(
      ({ scope, unit, mode, serviceId }) => {
        const p = new URLSearchParams(location.search);
        return (
          p.get("scope") === scope &&
          p.get("unit") === unit &&
          p.get("mode") === mode &&
          p.get("serviceId") === serviceId
        );
      },
      {},
      { scope, unit, mode, serviceId },
    );
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("button")).some(
        (e) => e.textContent.trim() === "Comparar regiones" && !e.disabled,
      ),
    );
    assert.equal(await (await control("Alcance a comparar")).evaluate((e) => e.value), scope);
    assert.equal(await (await control("Unidad a comparar")).evaluate((e) => e.value), unit);
    assert.equal(await (await control("Modalidad a comparar")).evaluate((e) => e.value), mode);
  }
  async function capture(name) {
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((theme) => {
          document.documentElement.classList.toggle("dark", theme === "dark");
          scrollTo(0, 0);
        }, theme);
        const compareButton = await page.$('section button[type="submit"]');
        await compareButton.hover();
        const colors = await compareButton.evaluate((e) => {
          const s = getComputedStyle(e);
          return { foreground: s.color, background: s.backgroundColor };
        });
        assert.notEqual(
          colors.foreground,
          colors.background,
          "Compare button must remain visible on hover in both themes",
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
        );
        await page.screenshot({
          path: join(directory, `market-fixed-${name}-${width}-${theme}.png`),
        });
      }
    }
  }
  try {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto("http://localhost:3001/precios/mercado", { waitUntil: "networkidle2" });
    assert.ok(!page.url().includes("/login"));
    assert.ok(
      (await page.$$("section table tbody tr")).length > 0,
      "Default selection must show existing market references",
    );
    await capture("initial");
    await (await control("Servicio a comparar")).select(fixture.serviceId);
    assert.equal(await (await control("Alcance a comparar")).evaluate((e) => e.value), "standard");
    const before = page.url();
    await (await control("Alcance a comparar")).select("advanced");
    await (await control("Unidad a comparar")).select("monthly");
    await (await control("Modalidad a comparar")).select("onsite");
    assert.equal(page.url(), before, "Editing filters must not trigger competing navigations");
    await click("Comparar regiones");
    await applied("advanced", "monthly", "onsite");
    assert.equal((await page.$$("section table tbody tr")).length, 0);
    await page.waitForFunction(() =>
      document.body.textContent.includes("No hay precios comparables para los filtros aplicados"),
    );
    await capture("no-match");
    await click("Ver Estándar · Por proyecto · Remota (6)");
    await applied("standard", "project", "remote");
    await page.waitForFunction(
      () => document.querySelectorAll("section table tbody tr").length === 2,
    );
    const rows = await page.$$eval("section table tbody tr", (rows) =>
      rows.map((r) => Array.from(r.querySelectorAll("td")).map((e) => e.textContent)),
    );
    assert.ok(rows.every((r) => r[1] === "3"));
    assert.ok(rows.some((r) => r[2].includes("2.000.000") && r[5].includes("2.000.000")));
    assert.ok(rows.some((r) => r[2].includes("1.000.000") && r[5].includes("1.000.000")));
    await capture("two-regions");
    await page.reload({ waitUntil: "networkidle2" });
    await applied("standard", "project", "remote");
    assert.equal((await page.$$("section table tbody tr")).length, 2);
    await click("Añadir referencia");
    assert.equal(
      await (await control("Servicio de referencia")).evaluate((e) => e.value),
      fixture.serviceId,
    );
    assert.equal(await (await control("Nivel de alcance")).evaluate((e) => e.value), "standard");
    assert.equal(await (await control("Unidad")).evaluate((e) => e.value), "project");
    await click("Cancelar referencia");
    const emptyService = await (
      await control("Servicio a comparar")
    ).evaluate(
      (e) =>
        Array.from(e.options).find((o) => o.textContent === "Desarrollo y consultoría por hora")
          ?.value,
    );
    assert.ok(emptyService);
    await (await control("Servicio a comparar")).select(emptyService);
    assert.equal(await (await control("Unidad a comparar")).evaluate((e) => e.value), "hour");
    await click("Comparar regiones");
    await applied("standard", "hour", "remote", emptyService);
    await page.waitForFunction(() =>
      document.body.textContent.includes("Este servicio todavía no tiene referencias de mercado"),
    );
    await capture("no-references");
    await page.goBack({ waitUntil: "networkidle2" });
    await applied("standard", "project", "remote");
    assert.equal((await page.$$("section table tbody tr")).length, 2);
    assert.deepEqual(errors, []);
    console.log(
      "Market regression passed: populated defaults, atomic filters, recovery from unmatched filters, two regions with correct numeric medians, reload, back, empty-service billing unit and reference defaults; 16 Chrome variants without page errors or horizontal overflow.",
    );
  } catch (error) {
    await page
      .screenshot({ path: join(directory, "market-regression-failure.png") })
      .catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
