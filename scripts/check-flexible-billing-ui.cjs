const assert = require("node:assert/strict");
const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const dir = join(require("node:os").tmpdir(), "nassican-pricing-qa");
const puppeteer = require(join(dir, "node_modules/puppeteer-core"));
const fixture = JSON.parse(readFileSync(join(dir, "fixtures.json"), "utf8"));
const flex = JSON.parse(readFileSync(join(dir, "flexible-fixtures.json"), "utf8"));
const origin = "http://localhost:3208";
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
  await (
    await page.createCDPSession()
  ).send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
  async function control(label) {
    for (const element of await page.$$("label"))
      if (
        await element.evaluate(
          (element, label) => element.firstElementChild?.textContent === label,
          label,
        )
      )
        return element.$("input,textarea,select");
    throw new Error(`Missing control ${label}`);
  }
  async function fill(label, value) {
    const element = await control(label);
    await element.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await element.focus();
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    if (value) await element.type(value);
  }
  async function click(label) {
    for (const element of await page.$$("button"))
      if (
        await element.evaluate(
          (e, label) => e.textContent.trim() === label && !e.matches(":disabled"),
          label,
        )
      ) {
        await element.evaluate((e) => e.scrollIntoView({ block: "center" }));
        await element.click();
        await page.waitForNetworkIdle();
        return;
      }
    throw new Error(`Missing active button ${label}`);
  }
  async function balance(received, remaining) {
    const [r, b] = await page.evaluate(() => [
      document.querySelector("[data-flexible-received]")?.textContent,
      document.querySelector("[data-flexible-balance]")?.textContent,
    ]);
    assert.equal(r.replace(/\D/g, ""), String(received));
    assert.equal(b.replace(/\D/g, ""), String(remaining));
  }
  async function captures(name) {
    const dismiss = await page.$('button[aria-label="Cerrar aviso"]');
    if (dismiss) await dismiss.click();
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (theme) => document.documentElement.classList.toggle("dark", theme === "dark"),
          theme,
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
        );
        await page.screenshot({
          path: join(dir, `flexible-${name}-${width}-${theme}.png`),
          fullPage: true,
        });
      }
    }
  }
  try {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(`${origin}/precios/cobros?projectId=${flex.projectId}`, {
      waitUntil: "networkidle2",
    });
    assert.ok(!page.url().includes("/login"));
    if (process.argv.includes("--verify-existing")) {
      await balance(1000000, 0);
      const confirmed = await page.$eval(
        "[data-expected-payment]",
        (element) => element.textContent,
      );
      assert.ok(confirmed.includes("Recibido"));
      assert.ok(confirmed.includes("200.000") && !confirmed.includes("Importe por acordar"));
      await captures("final");
      assert.deepEqual(errors, []);
      console.log(
        "Final UI verified read-only: received expectation displays the actual payment date/amount, paid balance retained, mobile/desktop and both themes without overflow.",
      );
      return;
    }
    await (await control("Modalidad de pago")).select("flexible");
    assert.equal(
      await page.evaluate(() => document.body.textContent.includes("Número de cuotas")),
      false,
    );
    await click("Guardar acuerdo por avances");
    await page.waitForSelector("[data-flexible-balance]");
    await balance(0, 1000000);
    // An unsaved future draft must survive saving the received-payment form.
    await fill("Concepto del próximo pago", "Siguiente avance, sin importe acordado");
    await fill("Importe recibido", "300000");
    await fill("Proyecto o avance pagado", "Entrega del diseño");
    await click("Guardar pago recibido");
    await page.waitForSelector("[data-flexible-receipt]");
    await balance(300000, 700000);
    assert.equal(
      await (await control("Concepto del próximo pago")).evaluate((e) => e.value),
      "Siguiente avance, sin importe acordado",
    );
    await click("Próximo mes");
    const month = await (await control("Fecha o mes previsto (opcional)")).evaluate((e) => e.value);
    assert.match(month, /^\d{4}-\d{2}$/);
    await click("Guardar próximo pago");
    await page.waitForSelector("[data-expected-payment]");
    await balance(300000, 700000);
    assert.ok(await page.evaluate(() => document.body.textContent.includes("Importe por acordar")));
    const pdfResponse = page.waitForResponse((response) =>
      /\/api\/precios\/planes\/.+\/pdf$/.test(response.url()),
    );
    await click("Descargar cotización");
    const pdf = await pdfResponse;
    assert.equal(pdf.status(), 200);
    const filename = pdf.headers()["content-disposition"].match(/filename="([^"]+)"/)[1];
    for (let i = 0; i < 100 && !existsSync(join(dir, filename)); i++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    const bytes = readFileSync(join(dir, filename));
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    writeFileSync(join(dir, "flexible-quote-example.pdf"), bytes);
    await captures("unknown-future");
    await click("Ya recibí este pago");
    await fill("Importe recibido", "200000");
    await click("Guardar pago recibido");
    await page.waitForFunction(
      () => document.querySelectorAll("[data-flexible-receipt]").length === 2,
    );
    await balance(500000, 500000);
    assert.ok(
      await page.evaluate(() =>
        document.querySelector("[data-expected-payment]").textContent.includes("Recibido"),
      ),
    );
    await page.reload({ waitUntil: "networkidle2" });
    await balance(500000, 500000);
    // Editing document data must retain both payments and the confirmed expectation.
    for (const summary of await page.$$("summary"))
      if (
        await summary.evaluate(
          (e) => e.textContent.trim() === "Datos para cotizar (opcional)" && !e.parentElement.open,
        )
      )
        await summary.click();
    await fill("Nombre o razón social del cliente", "Cliente con historial conservado");
    await click("Guardar acuerdo por avances");
    await balance(500000, 500000);
    assert.equal((await page.$$("[data-flexible-receipt]")).length, 2);
    await fill("Concepto del próximo pago", "Prueba de previsión retirada");
    await fill("Importe previsto (opcional)", "150000");
    await click("Guardar próximo pago");
    await click("Retirar previsión");
    await balance(500000, 500000);
    await fill("Importe recibido", "500001");
    await fill("Proyecto o avance pagado", "Prueba de saldo excedido");
    await click("Guardar pago recibido");
    assert.ok(
      await page.evaluate(() => document.body.textContent.includes("superan el valor del acuerdo")),
    );
    await balance(500000, 500000);
    await fill("Importe recibido", "500000");
    await fill("Proyecto o avance pagado", "Entrega final");
    await click("Guardar pago recibido");
    await page.waitForFunction(
      () => document.querySelectorAll("[data-flexible-receipt]").length === 3,
    );
    await balance(1000000, 0);
    assert.ok(
      await page.evaluate(() =>
        document.body.textContent.includes("El valor del acuerdo está pagado"),
      ),
    );
    await captures("settled");
    await page.goto(`${origin}/trabajos`, { waitUntil: "networkidle2" });
    assert.ok(await page.$(`a[href="/precios/cobros?projectId=${flex.projectId}"]`));
    assert.ok(await page.evaluate(() => document.body.textContent.includes("Abonos:")));
    assert.deepEqual(errors, []);
    console.log(
      "Chrome flexible payments passed: standalone project, no quotas, unequal received payments, uncertain next month, unchanged balance for forecasts, receipt confirmation, unsaved sibling form preserved, edit/reload history retained, rejected overpayment, fully paid balance, PDF download, project link; 1440/390 both themes without overflow or page errors.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
