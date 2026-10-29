const assert = require("node:assert/strict");
const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const dir = join(require("node:os").tmpdir(), "nassican-pricing-qa");
const puppeteer = require(join(dir, "node_modules/puppeteer-core"));
const fixture = JSON.parse(readFileSync(join(dir, "fixtures.json"), "utf8"));
const billing = JSON.parse(readFileSync(join(dir, "billing-fixtures.json"), "utf8"));
const origin = process.env.NASSICAN_QA_ORIGIN || "http://localhost:3001";
async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await browser.setCookie(fixture.cookie);
  await (
    await page.createCDPSession()
  ).send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
  async function control(label) {
    for (const e of await page.$$("label"))
      if (await e.evaluate((e, label) => e.firstElementChild?.textContent === label, label)) {
        const input = await e.$("input,select,textarea");
        await input.evaluate((element) => {
          const ancestors = [];
          for (let parent = element.parentElement; parent; parent = parent.parentElement)
            if (parent.tagName === "DETAILS" && !parent.open) ancestors.push(parent);
          ancestors.reverse().forEach((parent) => {
            parent.open = true;
          });
        });
        await new Promise((resolve) => setTimeout(resolve, 30));
        return input;
      }
    throw Error(`Missing control ${label}`);
  }
  async function fill(label, text) {
    const e = await control(label);
    await e.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await e.focus();
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    if (text) await e.type(text);
  }
  async function click(text) {
    for (const e of await page.$$("button"))
      if (await e.evaluate((e, text) => e.textContent.trim() === text && !e.disabled, text)) {
        await e.evaluate((e) => e.scrollIntoView({ block: "center" }));
        await e.click();
        return;
      }
    throw Error(`Missing button ${text}`);
  }
  async function download(text, name) {
    const wait = page.waitForResponse((r) => /\/api\/precios\/.+\/pdf$/.test(r.url()));
    await click(text);
    const response = await wait;
    assert.equal(response.status(), 200);
    const file = response.headers()["content-disposition"].match(/filename="([^"]+)"/)[1];
    for (let n = 0; n < 100 && !existsSync(join(dir, file)); n++)
      await new Promise((r) => setTimeout(r, 100));
    const bytes = readFileSync(join(dir, file));
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    writeFileSync(join(dir, name), bytes);
  }
  async function capture(name) {
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (t) => document.documentElement.classList.toggle("dark", t === "dark"),
          theme,
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
        );
        await page.screenshot({ path: join(dir, `billing-${name}-${width}-${theme}.png`) });
      }
    }
    await page.setViewport({ width: 1440, height: 1000 });
  }
  try {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(`${origin}/precios/cobros?quoteId=${fixture.quoteId}`, {
      waitUntil: "networkidle2",
    });
    assert.ok(!page.url().includes("/login"));
    assert.equal(
      await (await control("Número de cuotas")).evaluate((e) => e.matches(":disabled")),
      true,
    );
    await download("Descargar cotización", "billing-plan-example.pdf");
    await download("Descargar cuenta de cobro", "billing-charge-example.pdf");
    await capture("existing");
    const options = await (
      await control("Cotización o proyecto")
    ).evaluate((e) => Array.from(e.options).map((o) => ({ value: o.value, text: o.textContent })));
    const choice = options.find(
      (o) =>
        o.value.startsWith("quoteId=") &&
        !o.value.endsWith(fixture.quoteId) &&
        o.text.includes(fixture.marker) &&
        o.text.includes("familiar"),
    );
    assert.ok(choice);
    await page.goto(`${origin}/precios/cobros?${choice.value}`, {
      waitUntil: "networkidle2",
    });
    await fill("Nombre o razón social del emisor", "Nassican · Emisor de prueba");
    await fill("Identificación · CC / NIT / otro del emisor", "CC 00000003");
    assert.equal(
      await (await control("Identificación · CC / NIT / otro del emisor")).evaluate((e) => e.value),
      "CC 00000003",
    );
    await fill("Nombre o razón social del cliente", "Cliente de prueba documental");
    await fill("Identificación · CC / NIT / otro del cliente", "NIT 00000004");
    await fill("Número de cuotas", "3");
    await click("Repartir en cuotas iguales");
    await (await control("Dividir por")).select("percent");
    for (const [index, value] of ["40", "35", "25"].entries()) {
      await fill(`Porcentaje (%) de cuota ${index + 1}`, value);
      await fill(`Nombre de cuota ${index + 1}`, ["Anticipo", "Desarrollo", "Entrega"][index]);
    }
    await fill("Forma y condiciones de pago", "Transferencia en tres hitos: 40 %, 35 % y 25 %.");
    await fill("Plazo y condiciones de entrega", "Entrega en los hitos acordados con el cliente.");
    await capture("custom-quotas");
    await click("Guardar plan de cuotas");
    await page.waitForNetworkIdle();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("button")).some(
        (e) => e.textContent.trim() === "Descargar cotización",
      ),
    );
    await download("Descargar cotización", "billing-custom-quote-example.pdf");
    const quoteId = choice.value.split("=")[1];
    await page.goto(`${origin}/precios/cotizaciones`, { waitUntil: "networkidle2" });
    const articles = await page.$$("article");
    let status;
    for (const a of articles)
      if (
        await a.evaluate(
          (e, id) => !!e.querySelector(`a[href="/precios/cobros?quoteId=${id}"]`),
          quoteId,
        )
      ) {
        status = await a.$("select");
        break;
      }
    assert.ok(status);
    await status.select("accepted");
    await page.waitForNetworkIdle();
    await page.goto(`${origin}/precios/cobros?quoteId=${quoteId}`, {
      waitUntil: "networkidle2",
    });
    await click("Emitir cuenta de cobro");
    await page.waitForNetworkIdle();
    await page.waitForSelector("[data-charge-id]");
    const details = await page.$("[data-charge-id] details");
    await details.evaluate((e) => {
      e.open = true;
    });
    await fill("Importe del abono", "1000");
    await fill("Referencia del abono", "Transferencia ficticia QA");
    await click("Guardar abono");
    await page.waitForNetworkIdle();
    await page.waitForFunction(() => document.body.textContent.includes("Con abonos"));
    assert.equal(await (await control("Importe del abono")).evaluate((e) => e.value), "");
    await download("Descargar cuenta de cobro", "billing-custom-charge-example.pdf");
    await capture("issued-and-paid");
    await page.goto(`${origin}/trabajos`, { waitUntil: "networkidle2" });
    assert.ok(await page.evaluate(() => document.body.textContent.includes("Abonos:")));
    assert.ok(
      await page.$(`a[href="/precios/cobros?projectId=${billing.projectId}&mode=flexible"]`),
    );
    await capture("project-connection");
    assert.deepEqual(errors, []);
    console.log(
      "Chrome billing passed: custom 40/35/25 quotas, accepted-project connection, issued account, partial payment, cleared receipt form, real PDF downloads, locked history; mobile/desktop and both themes without page errors or overflow.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
