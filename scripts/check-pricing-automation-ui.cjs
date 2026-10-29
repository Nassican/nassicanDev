/** Chrome checks against the synthetic loopback-only QA database. */
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
  page.on("dialog", (dialog) => dialog.accept());
  await browser.setCookie(fixture.cookie);
  async function control(label) {
    for (const e of await page.$$("label"))
      if (await e.evaluate((e, label) => e.firstElementChild?.textContent === label, label))
        return e.$('input:not([type="date"]),select,textarea');
    throw new Error(`Missing control: ${label}`);
  }
  async function click(text) {
    for (const e of await page.$$("button"))
      if (await e.evaluate((e, text) => e.textContent.trim() === text && !e.disabled, text)) {
        await e.evaluate((e) => e.scrollIntoView({ block: "center" }));
        await e.click();
        return;
      }
    throw new Error(`Missing button: ${text}`);
  }
  async function fill(label, text) {
    const input = await control(label);
    await input.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await input.focus();
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    if (text) await input.type(text);
    return input;
  }
  async function paste(label, value) {
    const input = await fill(label, "");
    await input.evaluate((e, text) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", text);
      e.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
      );
    }, value);
    return input;
  }
  async function value(label) {
    return (await control(label)).evaluate((e) => e.value);
  }
  async function saveClient() {
    await click("Guardar cliente");
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll("button")).some(
          (e) => e.textContent.trim() === "Guardar cliente",
        ),
    );
    await page.waitForNetworkIdle();
  }
  async function capture(name, selector) {
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (theme) => document.documentElement.classList.toggle("dark", theme === "dark"),
          theme,
        );
        await page.$eval(selector, (e) => {
          e.scrollIntoView({ block: "start" });
          scrollBy(0, -90);
        });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
        );
        await page.screenshot({
          path: join(directory, `automation-${name}-${width}-${theme}.png`),
        });
      }
    }
    await page.setViewport({ width: 1440, height: 1000 });
  }
  try {
    await page.setViewport({ width: 1440, height: 1000 });
    if (process.argv.includes("--legacy")) {
      await page.goto("http://localhost:3001/precios/parametros", { waitUntil: "networkidle2" });
      assert.ok(
        await page.$eval('p[role="status"]', (e) => e.textContent.includes("migración pendiente")),
      );
      assert.equal(await value("Redondeo hacia arriba, COP"), "100.000");
      assert.equal(await value("Redondeo familiar hacia abajo, COP"), "1.000.000");
      await click("Guardar parámetros");
      await page.waitForFunction(() =>
        document.body.textContent.includes("Falta aplicar la migración del redondeo familiar"),
      );
      await capture("legacy-compatibility", 'p[role="status"]');
      await page.goto("http://localhost:3001/precios", { waitUntil: "networkidle2" });
      await (await control("Elegir cliente")).select(fixture.clientId);
      await (await control("Servicio")).select(fixture.serviceId);
      assert.ok(await page.$('[aria-label="Resultado de precios"]'));
      assert.deepEqual(errors, []);
      console.log(
        "Legacy schema passed: calculator opens, uses requested rounding, settings explain pending migration without attempting a partial save; four additional screenshots.",
      );
      return;
    }
    await page.goto("http://localhost:3001/precios", { waitUntil: "networkidle2" });
    assert.ok(!page.url().includes("/login"));
    await (await control("Elegir cliente")).select(fixture.clientId);
    await (await control("Servicio")).select(fixture.serviceId);
    const costs = await fill("Costos directos, COP", "9386000");
    assert.equal(await value("Costos directos, COP"), "9.386.000");
    await costs.evaluate((e) => {
      e.focus();
      e.setSelectionRange(1, 1);
    });
    await page.keyboard.type("8");
    assert.equal(await value("Costos directos, COP"), "98.386.000");
    assert.equal(await costs.evaluate((e) => e.selectionStart), 2);
    await fill("Horas estimadas", "12.5");
    assert.equal(await value("Horas estimadas"), "12,5");
    await fill("Horas estimadas", "20");
    for (const [raw, expected] of [
      ["$ 1.234,50", "1.234,5"],
      ["1234.50", "1.234,5"],
      ["9.386.000", "9.386.000"],
    ]) {
      await paste("Costos directos, COP", raw);
      assert.equal(await value("Costos directos, COP"), expected);
    }
    await fill("Costos directos, COP", "0");
    await click("Revisar cálculo y comparables");
    await page.waitForNetworkIdle();
    await click("Editar");
    await fill("Ingreso mensual, COP", "");
    await (await control("Departamento")).select("Nariño");
    await (await control("Municipio")).select("Pasto");
    await (await control("Estrato (0 a 6)")).select("1");
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="pricing-draft-income"]')
        ?.textContent.includes("690.000"),
    );
    await (await control("Estrato (0 a 6)")).select("6");
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="pricing-draft-income"]')
        ?.textContent.includes("4.110.000"),
    );
    await saveClient();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="pricing-live-income"]')
        ?.textContent.includes("4.110.000"),
    );
    assert.ok(
      await page.$eval('[aria-label="Resultado de precios"]', (e) =>
        e.textContent.includes("Vista automática"),
      ),
    );
    await capture("regional-capacity", '[data-testid="pricing-live-income"]');
    await click("Editar");
    await (await control("Departamento")).select("Antioquia");
    await (await control("Municipio")).select("Medellín");
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="pricing-draft-income"]')
        ?.textContent.includes("5.790.000"),
    );
    await fill("Ingreso mensual, COP", "0");
    await saveClient();
    assert.ok(
      await page.$eval(
        '[data-testid="pricing-live-income"]',
        (e) =>
          e.textContent.replace(/\s/g, "").includes("$0") && e.textContent.includes("prioriza"),
      ),
    );
    await click("Añadir periodo");
    await fill("Inicio del periodo", "2025");
    await fill("Fin del periodo", "2025");
    await fill("1 · Activo total / patrimonio bruto", "10000000");
    await fill("2 · Pasivo total / deudas", "3000000");
    assert.equal(await value("3 · Patrimonio"), "7.000.000");
    assert.equal(await (await control("3 · Patrimonio")).evaluate((e) => e.readOnly), true);
    await fill("2 · Pasivo total / deudas", "11000000");
    assert.equal(await value("3 · Patrimonio"), "-1.000.000");
    await fill("2 · Pasivo total / deudas", "3000000");
    await fill("41 · Ingresos operacionales", "120000000");
    await fill("210 · Costos y deducciones (un solo renglón)", "60000000");
    await capture("financial-auto", 'input[placeholder="Se calcula con activos y pasivos"]');
    await click("Guardar periodo");
    await page.waitForNetworkIdle();
    await click("Editar periodo");
    assert.equal(await value("3 · Patrimonio"), "7.000.000");
    await click("Cancelar periodo");
    const checkbox = await page.$('aside input[type="checkbox"]');
    await checkbox.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await checkbox.click();
    await page.waitForFunction(() =>
      document
        .querySelector('[aria-label="Resultado de precios"]')
        ?.textContent.includes("Ajuste adicional hacia abajo"),
    );
    await capture("family-rounding", '[aria-label="Resultado de precios"]');
    await page.goto("http://localhost:3001/precios/parametros", { waitUntil: "networkidle2" });
    assert.equal(await value("Redondeo hacia arriba, COP"), "100.000");
    assert.equal(await value("Redondeo familiar hacia abajo, COP"), "1.000.000");
    await fill("Redondeo familiar hacia abajo, COP", "500000");
    await click("Guardar parámetros");
    await page.waitForNetworkIdle();
    await page.reload({ waitUntil: "networkidle2" });
    assert.equal(await value("Redondeo familiar hacia abajo, COP"), "500.000");
    await capture("settings", "main");
    assert.deepEqual(errors, []);
    console.log(
      "Chrome passed: live grouping/caret/paste, regional strata, recorded zero priority, automatic saved equity, family rounding, configurable steps; 16 screenshots, both themes at 1440 and 390 px, no page errors or overflow.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
