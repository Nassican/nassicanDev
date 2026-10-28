/** Stored references and nationwide modeled coverage, using a disposable local session. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const directory = join(require("node:os").tmpdir(), "nassican-pricing-qa");
const puppeteer = require(join(directory, "node_modules/puppeteer-core"));
const fixture = JSON.parse(readFileSync(join(directory, "fixtures.json"), "utf8"));
const study = require("./data/pricing-bogota-strata.json");
async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await browser.setCookie(fixture.cookie);
  const table = 'table[aria-label="Cobertura de ingresos por estrato"]';
  async function control(label) {
    for (const e of await page.$$("label"))
      if (await e.evaluate((e, label) => e.firstElementChild?.textContent === label, label))
        return e.$("input,select,textarea");
    throw new Error(`Missing control: ${label}`);
  }
  async function selectPlace(label, value) {
    const e = await control(label);
    const option = await e.evaluate((e, value) => {
      const fold = (s) =>
        s
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
      return Array.from(e.options).find((o) => fold(o.value) === fold(value))?.value;
    }, value);
    assert.ok(option);
    await e.select(option);
  }
  async function rows() {
    return page.$$eval(`${table} tbody tr`, (rows) =>
      rows.map((r) => ({
        stratum: r.querySelector("th").textContent.trim(),
        income: r.querySelectorAll("td")[0].textContent.trim(),
        year: r.querySelectorAll("td")[1].textContent.trim(),
      })),
    );
  }
  async function fill(label, value) {
    const e = await control(label);
    await e.click({ clickCount: 3 });
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await e.press("Backspace");
    await e.type(value);
  }
  async function click(text) {
    for (const e of await page.$$('button[aria-label="Cerrar aviso"]')) await e.click();
    for (const e of await page.$$("button")) {
      if (await e.evaluate((e, text) => e.textContent.trim() === text && !e.disabled, text)) {
        await e.click();
        return;
      }
    }
    throw new Error(`Missing button: ${text}`);
  }
  async function capture(name) {
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (theme) => document.documentElement.classList.toggle("dark", theme === "dark"),
          theme,
        );
        const e =
          name === "city-editor"
            ? await page.$("div.scroll-mt-20")
            : name.startsWith("city-")
              ? await control("Ciudad o municipio para consultar ingresos")
              : await page.$(table);
        await e.evaluate((e) => {
          e.scrollIntoView({ block: "start" });
          scrollBy(0, -100);
        });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
        );
        await page.screenshot({ path: join(directory, `strata-${name}-${width}-${theme}.png`) });
      }
    }
  }
  try {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto("http://localhost:3001/precios/regiones", { waitUntil: "networkidle2" });
    assert.ok(!page.url().includes("/login"));
    if (process.argv.includes("--cities")) {
      const city = await control("Ciudad o municipio para consultar ingresos");
      const options = await city.evaluate((e) =>
        Array.from(e.options).map((o) => ({ value: o.value, text: o.textContent })),
      );
      assert.equal(options.length >= 1123, true);
      assert.ok(
        options.find((o) => o.value === "05001").text.includes("modelo con base municipio"),
      );
      assert.ok(options.find((o) => o.value === "11001").text.includes("6 estratos registrados"));
      assert.ok(options.find((o) => o.value === "91001").text.includes("modelo con base país"));
      await city.select("11001");
      await capture("city-bogota");
      await city.select("05001");
      await page.waitForFunction(() =>
        document.body.textContent.includes("Promedio de la ciudad: $"),
      );
      assert.ok(await page.evaluate(() => document.body.textContent.includes("1.929.483")));
      assert.ok((await rows()).every((r) => r.income !== "Sin dato por estrato"));
      await capture("city-medellin");
      await page.setViewport({ width: 1440, height: 1000 });
      await (await page.$(`${table} tbody tr:nth-child(3) button`)).click();
      assert.equal(
        await (await control("País del ingreso estimado")).evaluate((e) => e.value),
        "Colombia",
      );
      assert.equal(await (await control("Estrato estimado")).evaluate((e) => e.value), "2");
      assert.equal(
        await (await control("Ingreso mensual estimado, COP")).evaluate((e) => e.value),
        "",
      );
      const municipality = await (
        await control("Municipio del ingreso estimado")
      ).evaluate((e) => e.value);
      assert.ok(municipality.toLowerCase().includes("medell"));
      assert.ok(
        await (
          await control("Estrato estimado")
        ).evaluate((e) => e.selectedOptions[0].textContent.includes("modelo disponible")),
      );
      await capture("city-editor");
      // Save only in the disposable country, never in Medellín's real data.
      await page.setViewport({ width: 1440, height: 1000 });
      await fill("País del ingreso estimado", fixture.marker);
      await fill("Ingreso mensual estimado, COP", "1.500.000");
      await fill("Fecha del ingreso estimado", "2026-10");
      await fill("Justificación del ingreso estimado", `${fixture.marker} valor manual de prueba`);
      await click("Guardar ingreso estimado");
      await page.waitForFunction(() =>
        document.body.textContent.includes("Ingreso estimado guardado"),
      );
      await fill("País para consultar ingresos", fixture.marker);
      await page.waitForFunction(() =>
        document
          .querySelector(
            'table[aria-label="Cobertura de ingresos por estrato"] tbody tr:nth-child(3)',
          )
          .textContent.includes("1.500.000"),
      );
      await (await page.$(`${table} tbody tr:nth-child(3) button`)).click();
      assert.equal(
        await (await control("Ingreso mensual estimado, COP")).evaluate((e) => e.value),
        "1.500.000",
      );
      await fill("Ingreso mensual estimado, COP", "2.000.000");
      await click("Guardar ingreso estimado");
      await page.waitForFunction(() =>
        document
          .querySelector(
            'table[aria-label="Cobertura de ingresos por estrato"] tbody tr:nth-child(3)',
          )
          .textContent.includes("2.000.000"),
      );
      await capture("city-manual");
      assert.deepEqual(errors, []);
      console.log(
        "City selector passed: every DIVIPOLA place, model provenance, Medellín coverage, prefilled editor, manual save and edit in a disposable country; 16 Chrome variants without client errors or page overflow.",
      );
      return;
    }
    const bogota = await rows();
    assert.equal(bogota.length, 7);
    assert.ok(bogota[0].income.includes("2.300.000"));
    for (const row of study.strata) {
      assert.ok(bogota[row.stratum].income.includes(row.income.toLocaleString("es-CO")));
      assert.equal(bogota[row.stratum].year, "2024");
    }
    assert.equal(new Set(bogota.slice(1).map((r) => r.income)).size, 6);
    await capture("bogota");
    await page.$eval(`${table} tbody tr:nth-child(2) details`, (e) => {
      e.open = true;
    });
    const source = await page.$eval(`${table} tbody tr:nth-child(2) details`, (e) => ({
      text: e.textContent,
      url: e.querySelector("a").href,
    }));
    assert.ok(source.text.includes("2021") && source.text.includes("2024"));
    assert.ok(source.url.startsWith(study.url));
    await capture("source");
    await selectPlace("Departamento para consultar ingresos", "NARIÑO");
    await selectPlace("Municipio para consultar ingresos", "PASTO");
    assert.ok((await rows()).every((r) => r.income !== "Sin dato por estrato"));
    assert.ok(await page.evaluate(() => document.body.textContent.includes("1.370.170")));
    assert.ok((await rows())[2].income.includes("1.030.000"));
    await page.$eval(`${table} tbody tr:nth-child(3) details`, (e) => {
      e.open = true;
    });
    assert.ok(
      await page.$eval(`${table} tbody tr:nth-child(3)`, (e) =>
        e.textContent.includes("MODELO-COMERCIAL-V1"),
      ),
    );
    await capture("pasto-model");
    await (await control("Ciudad o municipio para consultar ingresos")).select("52356");
    assert.ok((await rows()).every((r) => r.income !== "Sin dato por estrato"));
    assert.ok(await page.$eval(table, (e) => e.textContent.includes("NARIÑO")));
    await capture("ipiales-model");
    await (await control("Ciudad o municipio para consultar ingresos")).select("91001");
    assert.ok((await rows()).every((r) => r.income !== "Sin dato por estrato"));
    assert.ok(await page.$eval(table, (e) => e.textContent.includes("Base: Colombia")));
    await capture("leticia-model");
    assert.deepEqual(errors, []);
    console.log(
      "Strata UI passed: six Bogotá references preserved, source/year, neutral stratum 0, Pasto municipal, Ipiales departmental and Leticia national models; 20 Chrome variants without errors or horizontal overflow.",
    );
  } catch (error) {
    await page.screenshot({ path: join(directory, "strata-failure.png") }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
