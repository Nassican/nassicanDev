/** Real Chrome: contextual help and private PDF downloads with synthetic local fixtures. */
const assert = require("node:assert/strict");
const { readFileSync, writeFileSync, existsSync } = require("node:fs");
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
  await (
    await page.createCDPSession()
  ).send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: directory });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await browser.setCookie(fixture.cookie);
  async function control(label) {
    for (const e of await page.$$("label"))
      if (await e.evaluate((e, label) => e.firstElementChild?.textContent === label, label))
        return e.$("input,select,textarea");
    throw new Error(`Missing control ${label}`);
  }
  async function click(text) {
    for (const button of await page.$$("button"))
      if (await button.evaluate((e, text) => e.textContent.trim() === text && !e.disabled, text)) {
        await button.evaluate((e) => e.scrollIntoView({ block: "center" }));
        await button.click();
        return;
      }
    throw new Error(`Missing button ${text}`);
  }
  async function help(label) {
    const trigger = await page.$(`button[aria-label="Ayuda: ${label}"]`);
    assert.ok(trigger, `Missing help ${label}`);
    await trigger.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector('[role="tooltip"]:popover-open');
    const popup = await page.$('[role="tooltip"]:popover-open');
    assert.ok((await popup.evaluate((e) => e.textContent)).includes(label));
    const rect = await popup.boundingBox();
    const viewport = page.viewport();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= viewport.width + 1);
    assert.ok(rect.y >= 0 && rect.y + rect.height <= viewport.height + 1);
    return { trigger, popup };
  }
  async function capture(name) {
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => document.documentElement.classList.toggle("dark", theme === "dark"),
        theme,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      await page.screenshot({
        path: join(directory, `help-pdf-${name}-${page.viewport().width}-${theme}.png`),
      });
    }
  }
  async function closeHelp() {
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector('button[aria-label^="Ayuda:"][aria-expanded="true"]'),
    );
  }
  try {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto("http://localhost:3001/precios", { waitUntil: "networkidle2" });
    const first = await help("Elegir cliente");
    await capture("client-help");
    await closeHelp();
    assert.equal(await first.trigger.evaluate((e) => e.getAttribute("aria-expanded")), "false");
    await (await control("Elegir cliente")).select(fixture.clientId);
    await (await control("Servicio")).select(fixture.serviceId);
    await help("Costos directos, COP");
    await closeHelp();
    await help("Piso por costos");
    assert.equal(await page.$$eval('[role="tooltip"]:popover-open', (es) => es.length), 1);
    await page.mouse.click(5, 500);
    assert.equal(await page.$$eval('[role="tooltip"]:popover-open', (es) => es.length), 0);
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      await help("Precio final editable, COP");
      await capture("price-help");
      await closeHelp();
    }
    await (await control("Título de la cotización")).type(`${fixture.marker} PDF nuevo`);
    await click("Revisar cálculo y comparables");
    await page.waitForNetworkIdle();
    await click("Guardar cotización");
    await page.waitForNetworkIdle();
    assert.ok(await page.$("aside button"));
    const fresh = await page.$$("aside button");
    assert.ok(
      await Promise.all(fresh.map((e) => e.evaluate((e) => e.textContent.trim()))).then((texts) =>
        texts.includes("Descargar PDF"),
      ),
    );
    const responsePromise = page.waitForResponse((r) =>
      /\/api\/precios\/cotizaciones\/[^/]+\/pdf$/.test(r.url()),
    );
    await click("Descargar PDF");
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    assert.match(response.headers()["content-type"], /application\/pdf/);
    assert.match(response.headers()["cache-control"], /private.*no-store/);
    const filename = response.headers()["content-disposition"].match(/filename="([^"]+)"/)[1];
    for (let attempt = 0; attempt < 100 && !existsSync(join(directory, filename)); attempt++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    const bytes = readFileSync(join(directory, filename));
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    writeFileSync(join(directory, "cotizacion-nassican-ui-nueva.pdf"), bytes);
    await page.goto("http://localhost:3001/precios/cotizaciones", { waitUntil: "networkidle2" });
    const savedResponse = await page.evaluate(async (id) => {
      const response = await fetch(`/api/precios/cotizaciones/${id}/pdf`);
      return {
        status: response.status,
        disposition: response.headers.get("content-disposition"),
        type: response.headers.get("content-type"),
        bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
      };
    }, fixture.quoteId);
    assert.equal(savedResponse.status, 200);
    assert.match(savedResponse.disposition, /attachment; filename="cotizacion-nassican-/);
    assert.equal(Buffer.from(savedResponse.bytes).subarray(0, 5).toString(), "%PDF-");
    writeFileSync(
      join(directory, "cotizacion-nassican-ui-guardada.pdf"),
      Buffer.from(savedResponse.bytes),
    );
    await capture("quote-list");
    const missing = await page.evaluate(
      async () =>
        (await fetch("/api/precios/cotizaciones/00000000-0000-4000-8000-000000000000/pdf")).status,
    );
    assert.equal(missing, 404);
    await page.goto("http://localhost:3001/precios/parametros", { waitUntil: "networkidle2" });
    await help("Descuento familiar (%)");
    await capture("settings-help");
    await closeHelp();
    await help("Redondeo familiar hacia abajo, COP");
    await closeHelp();
    const unauthenticated = await browser.newPage();
    await browser.deleteCookie(fixture.cookie);
    const privateResult = await unauthenticated.goto(
      `http://localhost:3001/api/precios/cotizaciones/${fixture.quoteId}/pdf`,
      { waitUntil: "networkidle2" },
    );
    assert.ok(unauthenticated.url().includes("/login"));
    assert.ok(!privateResult.headers()["content-type"].includes("application/pdf"));
    await unauthenticated.close();
    assert.deepEqual(errors, []);
    console.log(
      "Chrome passed: click/keyboard/Escape/outside-click help, bounded mobile popovers, both themes, calculator and saved PDF downloads, 404s and unauthenticated access protection; no page errors or overflow.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
