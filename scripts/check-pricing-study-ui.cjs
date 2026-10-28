/** End-to-end checks use only the disposable client and marker from --fixtures. */
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
  const companion = `${fixture.marker} complemento UI`;
  const packageName = `${fixture.marker} paquete UI`;
  async function press(element) {
    assert.ok(element);
    await element.evaluate((e) => e.scrollIntoView({ block: "center", inline: "nearest" }));
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await element.click();
  }
  async function control(label) {
    for (const e of await page.$$("label"))
      if (await e.evaluate((e, label) => e.firstElementChild?.textContent === label, label))
        return e.$("input,select,textarea");
    throw new Error(`Missing field ${label}`);
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
    throw new Error(`Missing enabled button ${text}`);
  }
  async function goto(path) {
    await page.goto(`http://localhost:3001${path}`, { waitUntil: "networkidle2" });
    assert.ok(!page.url().includes("/login"));
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
          `Overflow: ${name}`,
        );
        if (selector) {
          const e = await page.$(selector);
          assert.ok(e);
          await e.screenshot({ path: join(directory, `study-${name}-${width}-${theme}.png`) });
        } else {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({
            path: join(directory, `study-${name}-${width}-${theme}.png`),
            fullPage: false,
          });
        }
      }
    }
  }
  try {
    await page.setViewport({ width: 1440, height: 1000 });
    if (process.argv.includes("--split-platform")) {
      const cases = [
        { name: "Plataforma Esferas Shop + App", hours: "300", tag: "esferas", parts: 2 },
        {
          name: "Deligurt POS multisede con recetas e insumos",
          hours: "220",
          tag: "deligurt",
          parts: 0,
        },
      ];
      await goto("/precios/parametros");
      for (const item of cases) {
        await page.evaluate(({ name, tag }) => {
          const title = Array.from(document.querySelectorAll("p")).find(
            (p) => p.textContent === name,
          );
          if (title) title.parentElement.setAttribute("data-pricing-qa", tag);
        }, item);
        await capture(`split-catalog-${item.tag}`, `[data-pricing-qa="${item.tag}"]`);
      }
      for (const item of cases) {
        await goto("/precios");
        await (await control("Elegir cliente")).select(fixture.clientId);
        const service = await (
          await control("Servicio")
        ).evaluate(
          (e, name) => Array.from(e.options).find((o) => o.textContent === name)?.value,
          item.name,
        );
        assert.ok(service);
        await (await control("Servicio")).select(service);
        assert.equal(await (await control("Horas estimadas")).evaluate((e) => e.value), item.hours);
        await fill("Título de la cotización", `${fixture.marker} ${item.tag} separado`);
        await click("Revisar cálculo y comparables");
        await page.waitForFunction(() =>
          Array.from(document.querySelectorAll("button")).some(
            (e) => e.textContent.trim() === "Guardar cotización" && !e.disabled,
          ),
        );
        const included = await page.evaluate(() => {
          const title = Array.from(
            document.querySelectorAll('aside[aria-label="Resultado de precios"] p'),
          ).find((p) => p.textContent === "Servicios incluidos en el paquete");
          return Array.from(title?.nextElementSibling?.querySelectorAll("li") ?? []).map(
            (e) => e.textContent,
          );
        });
        assert.equal(included.length, item.parts);
        if (item.parts) {
          assert.ok(included.some((n) => n.includes("Tienda y pedidos")));
          assert.ok(included.some((n) => n.includes("Inventario de distribuidora")));
        }
        await capture(`split-result-${item.tag}`, 'aside[aria-label="Resultado de precios"]');
        await click("Guardar cotización");
        await page.waitForFunction(() =>
          document.body.textContent.includes("Cotización guardada con sus parámetros"),
        );
      }
      assert.deepEqual(errors, []);
      console.log(
        "Esferas (300 h, two components) and independent Deligurt (220 h) selected, reviewed and saved; 16 Chrome variants passed.",
      );
      return;
    }
    if (process.argv.includes("--capture-only")) {
      await goto("/precios/parametros");
      await page.evaluate(() => {
        const tiers = Array.from(document.querySelectorAll("section")).find(
          (e) =>
            e.querySelector("h2")?.textContent ===
            "Tramos de ingresos operacionales mensuales de empresas",
        );
        if (tiers) tiers.setAttribute("data-pricing-qa", "tiers");
        const title = Array.from(document.querySelectorAll("p")).find(
          (e) => e.textContent === "Plataforma Esferas Shop + App",
        );
        if (title) title.parentElement.setAttribute("data-pricing-qa", "catalog-platform");
      });
      await capture("tiers", '[data-pricing-qa="tiers"]');
      await capture("catalog-platform", '[data-pricing-qa="catalog-platform"]');
      console.log(
        "Tier percentages and the integrated platform catalog card captured in eight screen variants.",
      );
      return;
    }
    if (!process.argv.includes("--resume")) {
      await goto("/precios/parametros");
      assert.equal(
        await (await control("Recargo sobre el costo (%)")).evaluate((e) => e.value),
        "35",
      );
      assert.equal(await (await control("Peso de proyecto (%)")).evaluate((e) => e.value), "70");
      assert.equal(
        await (await control("Porcentaje del ingreso (%)")).evaluate((e) => e.value),
        "1",
      );
      await fill("Porcentaje del ingreso (%)", "0,01");
      await click("Guardar tramos");
      await page.waitForFunction(() =>
        document.body.textContent.includes("porcentajes entre 1 y 100"),
      );
      await fill("Porcentaje del ingreso (%)", "1");
      const tierResponse = page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().includes("/precios/parametros"),
      );
      await click("Guardar tramos");
      assert.equal((await tierResponse).status(), 200);
      await page.waitForNetworkIdle();
      await page.reload({ waitUntil: "networkidle2" });
      assert.equal(
        await (await control("Porcentaje del ingreso (%)")).evaluate((e) => e.value),
        "1",
      );
      console.log(
        "Percentages are ordinary numbers; invalid fractional tier entry rejected and 1 % saved.",
      );
      await capture("settings");
      await click("Añadir servicio");
      await fill("Nombre del servicio", companion);
      await fill("Horas típicas", "6");
      await fill("Mínimo del servicio, COP", "100.000");
      await fill("Precio recomendado, COP", "900.000");
      await click("Guardar servicio");
      await page.waitForFunction(() => document.body.textContent.includes("Servicio guardado"));
      await page.waitForFunction(
        () =>
          !Array.from(document.querySelectorAll("button")).some(
            (e) => e.textContent.trim() === "Guardar servicio",
          ),
      );
      await click("Crear paquete de servicios");
      await fill("Nombre del servicio", packageName);
      for (const name of [fixture.marker, companion]) {
        let selected = false;
        for (const label of await page.$$("fieldset label"))
          if (
            await label.evaluate(
              (e, name) => e.querySelector("span")?.textContent.startsWith(`${name},`),
              name,
            )
          ) {
            await press(await label.$("input"));
            selected = true;
            break;
          }
        assert.ok(selected, `Missing component ${name}`);
      }
      assert.equal(await (await control("Horas típicas")).evaluate((e) => e.value), "26");
      await capture("package-editor", "fieldset");
      await click("Guardar servicio");
      await page.waitForFunction(() => document.body.textContent.includes("Servicio guardado"));
      await page.waitForFunction(
        () =>
          !Array.from(document.querySelectorAll("button")).some(
            (e) => e.textContent.trim() === "Guardar servicio",
          ),
      );
      console.log(
        "A same-unit package was created through the page with 26 hours and its component prices.",
      );
      await goto("/precios");
      await (await control("Elegir cliente")).select(fixture.clientId);
      const service = await control("Servicio");
      const packageId = await service.evaluate(
        (e, name) => Array.from(e.options).find((o) => o.textContent === name)?.value,
        packageName,
      );
      assert.ok(packageId);
      await service.select(packageId);
      await fill("Título de la cotización", `${fixture.marker} paquete cotizado`);
      await click("Revisar cálculo y comparables");
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll("button")).some(
          (e) => e.textContent.trim() === "Guardar cotización" && !e.disabled,
        ),
      );
      await page.waitForFunction(() =>
        document.body.textContent.includes("Servicios incluidos en el paquete"),
      );
      await click("Guardar cotización");
      await page.waitForFunction(() =>
        document.body.textContent.includes("Cotización guardada con sus parámetros"),
      );
    } else {
      await goto("/precios");
      await (await control("Elegir cliente")).select(fixture.clientId);
      await fill("Título de la cotización", `${fixture.marker} plataforma temporal`);
    }
    const integrated = await (
      await control("Servicio")
    ).evaluate(
      (e) =>
        Array.from(e.options).find((o) => o.textContent === "Plataforma Esferas Shop + App")?.value,
    );
    assert.ok(integrated);
    await (await control("Servicio")).select(integrated);
    assert.equal(await (await control("Horas estimadas")).evaluate((e) => e.value), "300");
    await click("Revisar cálculo y comparables");
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("button")).some(
        (e) => e.textContent.trim() === "Guardar cotización" && !e.disabled,
      ),
    );
    await capture("platform", 'aside[aria-label="Resultado de precios"]');
    await goto("/precios/regiones?q=Pasto");
    await page.waitForFunction(() => document.body.textContent.includes("1.370.170"));
    assert.ok(await page.evaluate(() => document.body.textContent.includes("1,033981")));
    await capture("regions");
    await goto("/precios/regiones");
    await click("Añadir ingreso estimado");
    await fill("País del ingreso estimado", fixture.marker);
    await (await control("Estrato estimado")).select("");
    await fill("Ingreso mensual estimado, COP", "1.500.000");
    await fill("Fecha del ingreso estimado", "2026-10");
    await fill(
      "Justificación del ingreso estimado",
      `${fixture.marker} referencia general temporal`,
    );
    await click("Guardar ingreso estimado");
    await page.waitForFunction(() =>
      document.body.textContent.includes("Ingreso estimado guardado"),
    );
    await goto("/precios/regiones?q=" + encodeURIComponent(fixture.marker));
    assert.ok(
      await page.evaluate(() =>
        document.body.textContent.includes("promedio regional sin desglose por estrato"),
      ),
    );
    await click("Editar estimación");
    assert.equal(await (await control("Estrato estimado")).evaluate((e) => e.value), "");
    await click("Cancelar estimación");
    assert.deepEqual(errors, []);
    console.log(
      "Regional search and a general income baseline saved; the integrated platform shows four components. Sixteen screen variants passed without client errors.",
    );
  } catch (error) {
    console.error(error.stack);
    await page
      .screenshot({ path: join(directory, "study-failure.png"), fullPage: false })
      .catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}
main().catch(() => {
  process.exitCode = 1;
});
