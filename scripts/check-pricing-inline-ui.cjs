/** Run with check-pricing-inline-fixtures.ts on the disposable local database. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const dir = join(require("node:os").tmpdir(), "nassican-pricing-qa");
const puppeteer = require(join(dir, "node_modules/puppeteer-core"));
const fixture = JSON.parse(readFileSync(join(dir, "fixtures.json"), "utf8"));
const pause = () => new Promise((resolve) => setTimeout(resolve, 150));
async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (dialog) => dialog.accept());
  await browser.setCookie(fixture.cookie);
  async function buttons(text, root = page) {
    const found = [];
    for (const button of await root.$$("button"))
      if (await button.evaluate((e, text) => e.textContent.trim() === text, text))
        found.push(button);
    return found;
  }
  async function click(text, root = page) {
    const [button] = await buttons(text, root);
    assert.ok(button, `Missing ${text}`);
    await button.click();
    await pause();
  }
  async function anchored(button, label) {
    await button.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await pause();
    const before = await button.evaluate((e) => e.getBoundingClientRect().top);
    await button.click();
    await pause();
    const after = await button.evaluate((e) => e.getBoundingClientRect().top);
    assert.ok(Math.abs(before - after) < 6, `${label}: row moved ${after - before}px`);
    const editor = await page.$(`[role="region"][aria-label="${label}"]`);
    assert.ok(editor, label);
    assert.ok(await editor.evaluate((e) => e.contains(document.activeElement)), `${label}: focus`);
    return editor;
  }
  async function rowEditor(text, label, cancel, save) {
    const available = await buttons(text);
    assert.ok(available.length >= 10, `${label}: needs a long list`);
    await anchored(available[0], label);
    const editor = await anchored(available[9], label);
    assert.ok(await editor.evaluate((e) => Boolean(e.closest("article"))), `${label}: outside row`);
    let editedDescription;
    if (label === "Editar referencia") {
      for (const field of await editor.$$("label")) {
        if (
          await field.evaluate((e) => e.firstElementChild.textContent === "Descripción del alcance")
        ) {
          const input = await field.$("input");
          editedDescription = `${await input.evaluate((e) => e.value)} revisada`;
          await input.focus();
          await page.keyboard.down("Control");
          await page.keyboard.press("KeyA");
          await page.keyboard.up("Control");
          await page.keyboard.type(editedDescription);
        }
      }
      assert.ok(editedDescription, "Missing editable description");
    }
    if (save) {
      await click(save, editor);
      await page.waitForFunction(
        (label) => !document.querySelector(`[role="region"][aria-label="${label}"]`),
        {},
        label,
      );
      if (editedDescription) {
        await page.waitForFunction(
          (text) =>
            [...document.querySelectorAll("article h2")].some((e) => e.textContent === text),
          {},
          editedDescription,
        );
      }
    } else {
      await click(cancel, editor);
    }
    await pause();
    assert.ok(
      await available[9].evaluate((e) => {
        const r = e.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      }),
      `${label}: lost row after closing`,
    );
  }
  try {
    for (const width of [1440, 390])
      for (const dark of [false, true]) {
        await page.setViewport({
          width,
          height: 1000,
          isMobile: width === 390,
          hasTouch: width === 390,
        });
        await page.goto(
          `http://localhost:3208/precios/mercado?q=${encodeURIComponent(fixture.marker)}`,
          { waitUntil: "networkidle2" },
        );
        await page.evaluate(
          (dark) => document.documentElement.classList.toggle("dark", dark),
          dark,
        );
        await rowEditor(
          "Editar referencia",
          "Editar referencia",
          "Cancelar referencia",
          "Guardar referencia",
        );
        // Reopen after saving and leave visible for visual inspection.
        const market = await buttons("Editar referencia");
        await anchored(market[9], "Editar referencia");
        await page.screenshot({ path: join(dir, `inline-market-${width}-${dark}.png`) });
        await click("Cancelar referencia");
        await page.goto(
          `http://localhost:3208/precios/regiones?q=${encodeURIComponent(fixture.marker)}`,
          { waitUntil: "networkidle2" },
        );
        await page.evaluate(
          (dark) => document.documentElement.classList.toggle("dark", dark),
          dark,
        );
        await rowEditor(
          "Editar factor",
          "Editar factor",
          "Cancelar factor",
          "Guardar factor manual",
        );
        await rowEditor(
          "Editar estimación",
          "Editar estimación",
          "Cancelar estimación",
          "Guardar ingreso estimado",
        );
        const table = await page.$('table[aria-label="Cobertura de ingresos por estrato"]');
        const rows = await table.$$("tbody tr");
        const action = await rows[6].$("button");
        const editor = await anchored(action, "Editar ingreso por estrato");
        assert.ok(
          await editor.evaluate(
            (e) =>
              e.closest("tr").previousElementSibling.querySelector("th").textContent.trim() === "6",
          ),
        );
        for (const field of await editor.$$("label")) {
          if (await field.evaluate((e) => e.firstElementChild.textContent === "Estrato estimado")) {
            await (await field.$("select")).select("5");
          }
        }
        assert.ok(
          await editor.evaluate(
            (e) =>
              e.isConnected &&
              e.closest("tr").previousElementSibling.querySelector("th").textContent.trim() === "6",
          ),
          "Changing stratum moved the editor",
        );
        await page.screenshot({ path: join(dir, `inline-stratum-${width}-${dark}.png`) });
        await click("Cancelar estimación", editor);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          "Page overflow",
        );
        console.log(`Inline editing passed at ${width}px, ${dark ? "dark" : "light"}.`);
      }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
