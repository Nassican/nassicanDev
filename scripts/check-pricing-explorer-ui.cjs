/** Real-browser checks for all-combination comparisons and the local geographic explorer. */
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
  const errors = [],
    externalMaps = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (request) => {
    if (/geoboundaries|tile\.|mapbox|maps\.google|unpkg\.com/.test(request.url()))
      externalMaps.push(request.url());
  });
  await browser.setCookie(fixture.cookie);
  const results = '[aria-label="Resultados de comparación regional"]';
  async function control(label) {
    for (const e of await page.$$("label"))
      if (await e.evaluate((e, label) => e.firstElementChild?.textContent === label, label))
        return e.$("input,select");
    throw new Error(`Missing control: ${label}`);
  }
  async function click(text) {
    for (const b of await page.$$("button"))
      if (await b.evaluate((b, text) => b.textContent.trim() === text && !b.disabled, text)) {
        await b.evaluate((e) => e.scrollIntoView({ block: "center" }));
        await b.click();
        return;
      }
    throw new Error(`Missing button: ${text}`);
  }
  async function capture(name, selector) {
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (t) => document.documentElement.classList.toggle("dark", t === "dark"),
          theme,
        );
        const e = await page.$(selector);
        await e.evaluate((e) => {
          e.scrollIntoView({ block: "start" });
          scrollBy(0, -85);
        });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
        );
        await page.screenshot({ path: join(directory, `explorer-${name}-${width}-${theme}.png`) });
      }
    }
  }
  async function compare() {
    await click("Comparar regiones");
    await page.waitForFunction(() => !document.body.textContent.includes("Comparando…"));
    await page.waitForNetworkIdle();
  }
  try {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto("http://localhost:3001/precios/mercado", { waitUntil: "networkidle2" });
    assert.ok(!page.url().includes("/login"));
    for (const label of [
      "Servicio a comparar",
      "Alcance a comparar",
      "Unidad a comparar",
      "Modalidad a comparar",
    ])
      assert.equal(await (await control(label)).evaluate((e) => e.value), "all");
    const allCount = await page.$$eval(`${results} > details`, (es) => es.length);
    assert.ok(allCount > 10);
    const allText = await page.$eval(results, (e) => e.textContent);
    assert.ok(
      allText.includes("Mensual") &&
        allText.includes("Por proyecto") &&
        allText.includes("Por hora"),
    );
    const zones = await control("Zona a comparar");
    const zoneOptions = await zones.evaluate((e) =>
      Array.from(e.options).map((o) => ({
        value: o.value,
        text: o.textContent,
        group: o.parentElement.label ?? "",
      })),
    );
    assert.ok(zoneOptions.find((o) => o.value === "52").text.includes("4 comparables"));
    assert.ok(zoneOptions.find((o) => o.value === "52").group.startsWith("Con datos comparables"));
    assert.ok(zoneOptions.find((o) => o.value === "11").text.includes("0 comparables"));
    assert.ok(zoneOptions.find((o) => o.value === "11").group.startsWith("Sin datos comparables"));
    assert.ok(
      zoneOptions.find((o) => o.value === "national").text.includes("referencias nacionales"),
    );
    await (await control("Modalidad a comparar")).select("onsite");
    assert.ok(
      await (
        await control("Zona a comparar")
      ).evaluate((e) =>
        e.querySelector('option[value="52"]').textContent.includes("0 comparables"),
      ),
    );
    await (await control("Modalidad a comparar")).select("all");
    await capture("zone-selector", '[aria-label="Selección de zona y disponibilidad"]');
    assert.ok(
      await page.evaluate(
        () =>
          document
            .querySelector('[aria-label="Selección de zona y disponibilidad"]')
            .getBoundingClientRect().top <
          document.querySelector('svg[role="group"]').getBoundingClientRect().top,
      ),
    );
    await page.setViewport({ width: 1440, height: 1000 });
    await capture("market-map", 'svg[role="group"]');
    const nari = await page.$('g[aria-label="Seleccionar NARIÑO"]');
    assert.ok(nari);
    await nari.click();
    await page.waitForFunction(
      () => new URLSearchParams(location.search).get("departmentCode") === "52",
    );
    await page.waitForNetworkIdle();
    const localText = await page.$eval(results, (e) => e.textContent);
    assert.ok(
      localText.includes("PASTO") && localText.includes("365.000") && localText.includes("499.000"),
    );
    assert.ok(!localText.includes("WebMedellin.co"));
    const localMunicipalities = await (
      await control("Municipio a comparar")
    ).evaluate((e) => Array.from(e.options).map((o) => ({ value: o.value, text: o.textContent })));
    assert.deepEqual(
      localMunicipalities.map((o) => o.value),
      ["", "52001"],
    );
    assert.ok(localMunicipalities[1].text.includes("4 comparables"));
    await (await control("Municipio a comparar")).select("52001");
    await page.waitForNetworkIdle();
    assert.equal(new URL(page.url()).searchParams.get("municipalityCode"), "52001");
    await page.reload({ waitUntil: "networkidle2" });
    assert.equal(await (await control("Municipio a comparar")).evaluate((e) => e.value), "52001");
    assert.ok(await page.$eval(results, (e) => e.textContent.includes("PASTO")));
    await capture("municipality-pasto", '[aria-label="Selección de zona y disponibilidad"]');
    await (await control("Zona a comparar")).select("05");
    await page.waitForNetworkIdle();
    assert.equal(new URL(page.url()).searchParams.has("municipalityCode"), false);
    assert.deepEqual(
      await (
        await control("Municipio a comparar")
      ).evaluate((e) => Array.from(e.options).map((o) => o.value)),
      ["", "05001"],
    );
    assert.equal(await (await control("Municipio a comparar")).evaluate((e) => e.value), "");
    await (await control("Municipio a comparar")).select("05001");
    await page.waitForNetworkIdle();
    await (await control("Unidad a comparar")).select("hour");
    assert.equal(await (await control("Municipio a comparar")).evaluate((e) => e.value), "");
    assert.equal(await (await control("Municipio a comparar")).evaluate((e) => e.disabled), true);
    await compare();
    assert.equal(new URL(page.url()).searchParams.has("municipalityCode"), false);
    await click("Mostrar todo");
    await page.waitForNetworkIdle();
    await (await control("Zona a comparar")).select("52");
    await page.waitForNetworkIdle();
    const countryView = await page.$eval('svg[role="group"]', (e) => e.getAttribute("viewBox"));
    await click("Acercar a selección");
    await page.waitForFunction(
      (before) => document.querySelector('svg[role="group"]').getAttribute("viewBox") !== before,
      {},
      countryView,
    );
    const zoom = await page.$eval('svg[role="group"]', (e) => e.getAttribute("viewBox"));
    await capture("market-local", 'svg[role="group"]');
    await page.setViewport({ width: 1440, height: 1000 });
    await page.$eval('svg[role="group"]', (e) => e.scrollIntoView({ block: "center" }));
    const mapBox = await (await page.$('svg[role="group"]')).boundingBox();
    const beforeDrag = await page.$eval('svg[role="group"]', (e) => e.getAttribute("viewBox"));
    const dragUrl = page.url();
    await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(mapBox.x + mapBox.width / 2 + 45, mapBox.y + mapBox.height / 2 + 25, {
      steps: 8,
    });
    await page.mouse.up();
    await page.waitForFunction(
      (before) => document.querySelector('svg[role="group"]').getAttribute("viewBox") !== before,
      {},
      beforeDrag,
    );
    assert.equal(page.url(), dragUrl);
    const beforeKey = await page.$eval('svg[role="group"]', (e) => {
      e.focus();
      return e.getAttribute("viewBox");
    });
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      (before) => document.querySelector('svg[role="group"]').getAttribute("viewBox") !== before,
      {},
      beforeKey,
    );
    await click("Ver Colombia");
    await page.waitForFunction(
      (before) => document.querySelector('svg[role="group"]').getAttribute("viewBox") !== before,
      {},
      zoom,
    );
    assert.notEqual(await page.$eval('svg[role="group"]', (e) => e.getAttribute("viewBox")), zoom);
    await page.$eval(`${results} > details`, (e) => {
      e.open = true;
    });
    assert.ok(await page.$(`${results} > details a[href^="https://"]`));
    await capture("market-sources", results);
    await page.setViewport({ width: 1440, height: 1000 });
    await click("Mostrar todo");
    await page.waitForNetworkIdle();
    await (await control("Unidad a comparar")).select("hour");
    await compare();
    const hourly = await page.$$eval(`${results} > details > summary`, (es) =>
      es.map((e) => e.textContent),
    );
    assert.ok(hourly.length > 0 && hourly.every((t) => t.includes("Por hora")));
    assert.ok(hourly.some((t) => t.includes("120.000")));
    await capture("market-hour", results);
    await (await control("Modalidad a comparar")).select("onsite");
    await compare();
    assert.equal(await page.$$eval(`${results} > details`, (es) => es.length), 0);
    assert.ok(
      await page.evaluate(() =>
        document.body.textContent.includes("No hay referencias para esta selección"),
      ),
    );
    await click("Mostrar todo");
    await page.waitForNetworkIdle();
    assert.equal(await page.$$eval(`${results} > details`, (es) => es.length), allCount);

    const islandButton = await page.$(
      'button[aria-label="Seleccionar San Andrés y Providencia desde ampliación"]',
    );
    await islandButton.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await islandButton.click();
    await page.waitForNetworkIdle();
    assert.equal(new URL(page.url()).searchParams.get("departmentCode"), "88");
    assert.equal(await page.$$eval(`${results} > details`, (es) => es.length), 0);
    await capture("island-access", 'svg[role="group"]');
    await (await control("Zona a comparar")).select("national");
    await page.waitForNetworkIdle();
    assert.equal(new URL(page.url()).searchParams.get("departmentCode"), "national");
    const nationalRegions = await page.$$eval(`${results} > details > summary`, (es) =>
      es.map((e) => e.querySelector(":scope > span:nth-child(2) > span").textContent),
    );
    assert.ok(nationalRegions.length > 0 && nationalRegions.every((name) => name === "Colombia"));
    await capture("national-zone", results);

    await page.goto("http://localhost:3001/precios/regiones", { waitUntil: "networkidle2" });
    await page.setViewport({ width: 1440, height: 1000 });
    const nariIncome = await page.$('g[aria-label="Seleccionar NARIÑO"]');
    await nariIncome.evaluate((e) => e.focus());
    await page.keyboard.press("Enter");
    assert.equal(await (await control("Departamento del mapa")).evaluate((e) => e.value), "52");
    assert.ok(await page.evaluate(() => document.body.textContent.includes("783.314")));
    assert.ok(
      await (
        await control("Municipio para consultar en el mapa")
      ).evaluate((e) => Array.from(e.options).every((o) => !o.value || o.value.startsWith("52"))),
    );
    await (await control("Municipio para consultar en el mapa")).select("52001");
    assert.equal(
      await (await control("Ciudad o municipio para consultar ingresos")).evaluate((e) => e.value),
      "52001",
    );
    assert.ok(await page.evaluate(() => document.body.textContent.includes("1.370.170")));
    await capture("income-pasto", 'svg[role="group"]');
    await (await control("Departamento del mapa")).select("05");
    assert.equal(
      await (await control("Municipio para consultar en el mapa")).evaluate((e) => e.value),
      "",
    );
    assert.ok(
      await (
        await control("Municipio para consultar en el mapa")
      ).evaluate((e) => Array.from(e.options).every((o) => !o.value || o.value.startsWith("05"))),
    );
    await (await control("Municipio para consultar en el mapa")).select("05001");
    assert.equal(
      await (await control("Ciudad o municipio para consultar ingresos")).evaluate((e) => e.value),
      "05001",
    );
    await capture("municipality-medellin", '[aria-label="Selección de zona y disponibilidad"]');
    const bogota = await page.$('g[aria-label="Seleccionar BOGOTÁ, D.C."]');
    assert.ok(bogota);
    await bogota.evaluate((e) => e.focus());
    await page.keyboard.press("Space");
    assert.equal(
      await (await control("Ciudad o municipio para consultar ingresos")).evaluate((e) => e.value),
      "11001",
    );
    assert.ok(
      await page.$eval('table[aria-label="Cobertura de ingresos por estrato"]', (e) =>
        e.textContent.includes("697.880"),
      ),
    );
    await capture("income-bogota", 'svg[role="group"]');
    await page.setViewport({ width: 390, height: 1000, isMobile: true, hasTouch: true });
    await page.waitForNetworkIdle();
    await page.waitForSelector('svg[role="group"]');
    await click("Acercar a selección");
    await click("Mover mapa en móvil");
    await page.$eval('svg[role="group"]', (e) => e.scrollIntoView({ block: "center" }));
    const touchBox = await (await page.$('svg[role="group"]')).boundingBox();
    const touchBefore = await page.$eval('svg[role="group"]', (e) => e.getAttribute("viewBox"));
    const cdp = await page.createCDPSession();
    const x = touchBox.x + touchBox.width / 2,
      y = touchBox.y + touchBox.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 30, y: y + 30, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForFunction(
      (before) => document.querySelector('svg[role="group"]').getAttribute("viewBox") !== before,
      {},
      touchBefore,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(externalMaps, []);
    console.log(
      "Geographic explorer passed: cascading municipality options, comparable-only market choices, URL reload and reset, income location synchronization, zone availability and national separation, zoom/drag/keyboard/touch; 44 desktop/mobile light/dark screenshots, no external map requests or client errors.",
    );
  } catch (e) {
    await page.screenshot({ path: join(directory, "explorer-failure.png") }).catch(() => {});
    throw e;
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
