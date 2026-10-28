/** Real Chrome regression: add/remove services and freeze the combined quote. */
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
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.dismiss());
  await browser.setCookie(fixture.cookie);
  const title = `${fixture.marker} varios servicios UI`;
  async function control(label) {
    for (const e of await page.$$("label"))
      if (await e.evaluate((e, label) => e.firstElementChild?.textContent === label, label))
        return e.$("input,select,textarea");
    throw new Error(`Missing control: ${label}`);
  }
  async function press(e) {
    assert.ok(e);
    await e.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    await e.click();
  }
  async function fill(label, value) {
    const e = await control(label);
    await press(e);
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await e.press("Backspace");
    await e.type(value);
  }
  async function click(text) {
    for (const e of await page.$$('button[aria-label="Cerrar aviso"]')) await press(e);
    await page.waitForFunction(
      (text) =>
        Array.from(document.querySelectorAll("button")).some(
          (e) => e.textContent.trim() === text && !e.disabled,
        ),
      {},
      text,
    );
    for (const e of await page.$$("button"))
      if (await e.evaluate((e, text) => e.textContent.trim() === text && !e.disabled, text)) {
        await press(e);
        return;
      }
    throw new Error(`Missing button: ${text}`);
  }
  async function selectService(label, name) {
    const e = await control(label);
    const value = await e.evaluate(
      (e, name) => Array.from(e.options).find((o) => o.textContent === name)?.value,
      name,
    );
    assert.ok(value);
    await e.select(value);
  }
  async function add(name) {
    const e = await control("Servicio adicional");
    const value = await e.evaluate(
      (e, name) => Array.from(e.options).find((o) => o.textContent === name && !o.disabled)?.value,
      name,
    );
    assert.ok(value, `Available additional service: ${name}`);
    await e.select(value);
    await click("Añadir servicio");
  }
  async function capture(name, selector) {
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (theme) => document.documentElement.classList.toggle("dark", theme === "dark"),
          theme,
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
        );
        const e = await page.$(selector);
        assert.ok(e);
        await e.screenshot({ path: join(directory, `multi-${name}-${width}-${theme}.png`) });
      }
    }
  }
  try {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto("http://localhost:3001/precios", { waitUntil: "networkidle2" });
    assert.ok(!page.url().includes("/login"));
    await (await control("Elegir cliente")).select(fixture.clientId);
    await fill("Título de la cotización", title);
    await selectService("Servicio", "Plataforma Esferas Shop + App");
    assert.equal(await (await control("Horas estimadas")).evaluate((e) => e.value), "300");
    await add("Deligurt POS multisede con recetas e insumos");
    assert.equal(await (await control("Horas estimadas")).evaluate((e) => e.value), "520");
    await add("Integración opcional entre Esferas y Deligurt POS");
    assert.equal(await (await control("Horas estimadas")).evaluate((e) => e.value), "584");
    assert.equal(await (await control("Cobro")).evaluate((e) => e.disabled), true);
    const options = await (
      await control("Servicio adicional")
    ).evaluate((e) =>
      Array.from(e.options).map((o) => ({ text: o.textContent, disabled: o.disabled })),
    );
    assert.ok(
      options.some(
        (o) =>
          o.text.includes("Inventario de distribuidora") &&
          o.text.includes("ya incluido") &&
          o.disabled,
      ),
    );
    assert.ok(options.some((o) => o.text.includes("otra unidad") && o.disabled));
    await press(
      await page.$('button[aria-label="Quitar Deligurt POS multisede con recetas e insumos"]'),
    );
    assert.equal(await (await control("Horas estimadas")).evaluate((e) => e.value), "364");
    await add("Deligurt POS multisede con recetas e insumos");
    assert.equal(await (await control("Horas estimadas")).evaluate((e) => e.value), "584");
    await page.evaluate(() =>
      Array.from(document.querySelectorAll("section"))
        .find((e) => e.querySelector("h2")?.textContent === "Proyecto y costos")
        .setAttribute("data-pricing-qa", "multi"),
    );
    await capture("project", '[data-pricing-qa="multi"]');
    const family = await page.$('aside input[type="checkbox"]');
    await press(family);
    await click("Revisar cálculo y comparables");
    await page.waitForFunction(() =>
      document.body.textContent.includes("Servicios incluidos en la cotización"),
    );
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("button")).some(
        (e) => e.textContent.trim() === "Guardar cotización" && !e.disabled,
      ),
    );
    const parts = await page.evaluate(() => {
      const title = Array.from(document.querySelectorAll("aside p")).find(
        (e) => e.textContent === "Servicios incluidos en la cotización",
      );
      return title.nextElementSibling.querySelectorAll("li").length;
    });
    assert.equal(parts, 4);
    assert.ok(
      await page.evaluate(() => document.body.textContent.includes("Sin referencia conjunta")),
    );
    await capture("result", 'aside[aria-label="Resultado de precios"]');
    await click("Guardar cotización");
    await page.waitForFunction(() =>
      document.body.textContent.includes("Cotización guardada con sus parámetros"),
    );
    await page.goto("http://localhost:3001/precios/cotizaciones?q=" + encodeURIComponent(title), {
      waitUntil: "networkidle2",
    });
    await press(await page.$("article details summary"));
    await page.waitForFunction(() =>
      document.body.textContent.includes("Servicios incluidos en la cotización"),
    );
    await capture("saved", "article");
    assert.deepEqual(errors, []);
    console.log(
      "Multi-service UI passed: add/remove services, sum 584 hours, reject repeated components and mixed units, family discount, four frozen components and saved quote; 12 Chrome variants without page errors or horizontal overflow.",
    );
  } catch (error) {
    await page.screenshot({ path: join(directory, "multi-failure.png") }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
