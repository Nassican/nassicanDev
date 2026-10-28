/** Real Chrome with disposable fixtures from check-pricing.ts --fixtures. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const directory = join(tmpdir(), "nassican-pricing-qa");
const puppeteer = require(join(directory, "node_modules/puppeteer-core"));
const fixture = JSON.parse(readFileSync(join(directory, "fixtures.json"), "utf8"));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    protocolTimeout: 15000,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("dialog", (dialog) =>
    dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss(),
  );
  await browser.setCookie(fixture.cookie);
  let originalPercentage;
  let settingChanged = false;
  const title = `${fixture.marker} familiar UI`;
  async function control(label) {
    for (const element of await page.$$("label")) {
      if (await element.evaluate((e, label) => e.firstElementChild?.textContent === label, label))
        return element.$("input,select,textarea");
    }
    throw new Error(`Missing field: ${label}`);
  }
  async function press(element) {
    assert.ok(element);
    await element.evaluate((e) => e.scrollIntoView({ block: "center", inline: "nearest" }));
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await element.click();
  }
  async function fill(label, value) {
    const element = await control(label);
    await press(element);
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await element.press("Backspace");
    await element.type(value);
  }
  async function click(text) {
    for (const dismiss of await page.$$('button[aria-label="Cerrar aviso"]')) await press(dismiss);
    for (const button of await page.$$("button"))
      if (await button.evaluate((e, text) => e.textContent.trim() === text, text)) {
        await press(button);
        return;
      }
    throw new Error(`Missing button: ${text}`);
  }
  async function settings() {
    await page.goto("http://localhost:3001/precios/parametros", { waitUntil: "networkidle2" });
    assert.equal(new URL(page.url()).pathname, "/precios/parametros");
  }
  async function savePercentage(value) {
    await fill("Descuento familiar (%)", value);
    await click("Guardar parámetros");
    await page.waitForFunction(() => document.body.textContent.includes("Parámetros guardados"));
    await page.reload({ waitUntil: "networkidle2" });
    assert.equal(await (await control("Descuento familiar (%)")).evaluate((e) => e.value), value);
  }
  async function capture(name) {
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (theme) => document.documentElement.classList.toggle("dark", theme === "dark"),
          theme,
        );
        await page.evaluate(() => scrollTo(0, 0));
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
        );
        await page.screenshot({
          path: join(directory, `family-${name}-${width}-${theme}.png`),
          fullPage: name !== "settings",
        });
      }
    }
  }
  try {
    await page.setViewport({ width: 1440, height: 1000 });
    await settings();
    originalPercentage = await (await control("Descuento familiar (%)")).evaluate((e) => e.value);
    await fill("Descuento familiar (%)", "101");
    await click("Guardar parámetros");
    await page.waitForFunction(() =>
      document.body.textContent.includes("descuento familiar entre 0 y 100"),
    );
    console.log("Invalid percentage rejected by the settings action.");
    settingChanged = true;
    await savePercentage("100");
    assert.ok(await page.evaluate(() => /Familiar:\s*0\s*COP/.test(document.body.textContent)));
    await capture("settings");
    console.log("Percentage saved and survived reload in four screen variants.");
    await page.goto("http://localhost:3001/precios", { waitUntil: "networkidle2" });
    await (await control("Elegir cliente")).select(fixture.clientId);
    await (await control("Servicio")).select(fixture.serviceId);
    await fill("Título de la cotización", title);
    await fill("Costos directos, COP", "34.225");
    const checkbox = await page.$('input[type="checkbox"]');
    assert.ok(
      await checkbox.evaluate((e) =>
        e.parentElement.textContent.includes("Aplicar tarifa familiar (100 %)"),
      ),
    );
    await press(checkbox);
    await click("Revisar cálculo y comparables");
    await page.waitForFunction(() => document.body.textContent.includes("Tarifa familiar: 100 %"));
    assert.equal(
      await (await control("Precio final editable, COP")).evaluate((e) => e.placeholder),
      "34.225",
    );
    assert.ok(
      await page.evaluate(() => document.body.textContent.includes("descuento se aplica completo")),
    );
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("button")).some(
        (button) => button.textContent.trim() === "Guardar cotización" && !button.disabled,
      ),
    );
    await capture("calculator");
    await click("Guardar cotización");
    await page.waitForFunction(() =>
      document.body.textContent.includes("Cotización guardada con sus parámetros"),
    );
    console.log("A family quote was reviewed and saved through the real UI.");
    await settings();
    await savePercentage(originalPercentage);
    settingChanged = false;
    await page.goto("http://localhost:3001/precios/cotizaciones?q=" + encodeURIComponent(title), {
      waitUntil: "networkidle2",
    });
    await page.waitForFunction(() => document.body.textContent.includes("Tarifa familiar (100 %)"));
    const details = await page.$("article details summary");
    await press(details);
    await page.waitForFunction(() => document.body.textContent.includes("Tarifa familiar: 100 %"));
    assert.ok(
      await page.evaluate(() =>
        document.body.textContent.includes(
          "Descuento completo, sin límite por costos ni redondeo adicional.",
        ),
      ),
    );
    await capture("saved");
    assert.deepEqual(errors, []);
    console.log(
      "Saved quote retained its complete 100 % fee discount after restoring the current setting; 12 Chrome screen variants passed without client errors.",
    );
  } catch (error) {
    console.error(error.stack);
    await page
      .screenshot({ path: join(directory, "family-failure.png"), fullPage: false })
      .catch(() => {});
    throw error;
  } finally {
    if (settingChanged && originalPercentage !== undefined) {
      await settings();
      await savePercentage(originalPercentage);
      console.log("Original family percentage restored.");
    }
    await browser.close();
  }
}
main().catch(() => {
  process.exitCode = 1;
});
