/** Chrome lives outside the repo; install puppeteer-core in the documented temp directory. */
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { readFileSync, writeFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const dir = join(tmpdir(), "nassican-pricing-qa");
const puppeteer = require(join(dir, "node_modules/puppeteer-core"));
const fixtures = JSON.parse(readFileSync(join(dir, "fixtures.json"), "utf8"));

async function main() {
  const browser = await puppeteer.launch({
    protocolTimeout: 15000,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--no-first-run"],
  });
  const page = await browser.newPage();
  let confirmTestDeletion = false;
  page.on("dialog", async (dialog) => {
    console.log(`Browser dialog: ${dialog.type()}`);
    if (dialog.type() === "beforeunload" || confirmTestDeletion) {
      confirmTestDeletion = false;
      await dialog.accept();
    } else await dialog.dismiss();
  });
  const errors = [];
  let lastAction = "open browser";
  async function clickElement(element) {
    await element.evaluate((e) =>
      e.scrollIntoView({ block: "center", inline: "nearest" }),
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await element.click();
  }
  page.on("pageerror", (error) => errors.push(String(error)));
  await browser.setCookie(fixtures.cookie);
  async function field(label) {
    lastAction = `field: ${label}`;
    try {
      await page.waitForFunction(
        (expected) =>
          Array.from(document.querySelectorAll("label")).some(
            (e) =>
              e.firstElementChild?.textContent === expected &&
              e.querySelector("input,select,textarea"),
          ),
        {},
        label,
      );
    } catch {
      throw new Error(`Field did not appear: ${label}`);
    }
    for (const element of await page.$$("label")) {
      if (
        await element.evaluate(
          (e, expected) => e.firstElementChild?.textContent === expected,
          label,
        )
      ) {
        const control = await element.$(
          "input:not([type=hidden]),select,textarea",
        );
        if (control) return control;
      }
    }
    throw new Error(`Missing field: ${label}`);
  }
  async function fill(label, value) {
    const control = await field(label);
    await clickElement(control);
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await control.press("Backspace");
    await control.type(value);
  }
  async function select(label, value) {
    await (await field(label)).select(value);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  }
  async function click(text) {
    lastAction = `click: ${text}`;
    for (const dismiss of await page.$$('button[aria-label="Cerrar aviso"]')) {
      try {
        await clickElement(dismiss);
      } catch (error) {
        if (await dismiss.evaluate((e) => e.isConnected).catch(() => false))
          throw error;
      }
    }
    try {
      await page.waitForFunction(
        (expected) =>
          Array.from(document.querySelectorAll("button")).some(
            (b) => b.textContent.trim() === expected && !b.disabled,
          ),
        {},
        text,
      );
    } catch {
      throw new Error(`Button did not become enabled: ${text}`);
    }
    for (const button of await page.$$("button")) {
      if (
        await button.evaluate(
          (e, expected) => e.textContent.trim() === expected,
          text,
        )
      ) {
        await clickElement(button);
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        return;
      }
    }
    throw new Error(`Missing button: ${text}`);
  }
  const phase =
    process.argv.find((arg) => /^--phase\d$/.test(arg))?.slice(2) ?? "phase1";
  const routes = ["/precios", "/precios/cotizaciones", "/precios/parametros"];
  if (phase >= "phase3") routes.push("/precios/mercado");
  if (phase >= "phase4") routes.push("/precios/regiones");
  const report = [];
  const interactions = [];
  try {
    if (
      !process.argv.includes("--financial-only") &&
      !process.argv.includes("--integrations-only") &&
      !process.argv.includes("--signals-only")
    ) {
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
        for (const theme of ["light", "dark"]) {
          await browser.setCookie({
            name: "theme",
            value: theme,
            domain: "localhost",
            path: "/",
          });
          for (const route of routes) {
            const response = await page.goto(`http://localhost:3001${route}`, {
              waitUntil: "networkidle2",
            });
            assert.equal(response.status(), 200);
            assert.equal(
              new URL(page.url()).pathname,
              route,
              "The temporary session must reach the actual module",
            );
            await page.waitForSelector("h1");
            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            );
            assert.equal(
              overflow,
              false,
              `Horizontal overflow on ${route} at ${width}`,
            );
            await page.screenshot({
              path: join(
                dir,
                `${phase}-${route.replaceAll("/", "_")}-${width}-${theme}.png`,
              ),
              fullPage: true,
            });
            report.push({ route, width, theme, overflow });
          }
        }
      }
      await page.setViewport({ width: 1440, height: 1000 });
      await page.goto("http://localhost:3001/precios", {
        waitUntil: "networkidle2",
      });
      await select("Elegir cliente", fixtures.clientId);
      await select("Servicio", fixtures.serviceId);
      await fill("Título de la cotización", `${fixtures.marker} browser`);
      await fill("Costos directos, COP", "34.225");
      await click("Revisar cálculo y comparables");
      await page.waitForFunction(() =>
        document.body.textContent.includes("Ubicación: factor"),
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: join(dir, `${phase}-calculator-result.png`),
        fullPage: true,
      });
      await fill("Precio final editable, COP", "1.900.000");
      await click("Guardar cotización");
      await page.waitForFunction(() =>
        document.body.textContent.includes(
          "Cotización guardada con sus parámetros",
        ),
      );
      interactions.push("calculate and save quote");
      await page.goto("http://localhost:3001/precios/cotizaciones", {
        waitUntil: "networkidle2",
      });
      let status = null;
      for (const candidate of await page.$$(
        `select[aria-label="Estado de ${fixtures.marker} browser"]`,
      ))
        if (
          await candidate.evaluate((e) => e.value !== "accepted" && !e.disabled)
        ) {
          status = candidate;
          break;
        }
      assert.ok(status);
      await status.select("sent");
      await page.waitForFunction(() =>
        document.body.textContent.includes("Estado de la cotización guardado"),
      );
      interactions.push("send quote");
      await page.goto("http://localhost:3001/precios/parametros", {
        waitUntil: "networkidle2",
      });
      await click("Añadir servicio");
      await fill("Nombre del servicio", "Prueba que no se guarda");
      await click("Cancelar");
      assert.equal(
        await page.$("input[value='Prueba que no se guarda']"),
        null,
      );
      interactions.push("open and cancel service");
    }
    if (
      phase >= "phase2" &&
      !process.argv.includes("--integrations-only") &&
      !process.argv.includes("--signals-only")
    ) {
      console.log("Checking financial editor interactions.");
      await page.goto("http://localhost:3001/precios", {
        waitUntil: "networkidle2",
      });
      await select("Elegir cliente", fixtures.clientId);
      const hasPeriod = await page.evaluate(() =>
        Array.from(document.querySelectorAll("button")).some(
          (b) => b.textContent.trim() === "Editar periodo",
        ),
      );
      await click(hasPeriod ? "Editar periodo" : "Añadir periodo");
      await fill("Inicio del periodo", "2025");
      await fill("Fin del periodo", "2025");
      await fill("41 · Ingresos operacionales", "60.000.000");
      await fill("210 · Costos y deducciones (un solo renglón)", "12.000.000");
      await click("Guardar periodo");
      console.log("Financial save button pressed.");
      await page.waitForFunction(() =>
        document.body.textContent.includes("Periodo financiero guardado"),
      );
      console.log("Financial save confirmed.");
      await page.waitForFunction(
        () =>
          !Array.from(document.querySelectorAll("button")).some(
            (b) => b.textContent.trim() === "Guardar periodo",
          ),
      );
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll("button")).some(
          (b) => b.textContent.trim() === "Editar periodo",
        ),
      );
      await click("Editar periodo");
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll("label")).some(
          (label) =>
            label.firstElementChild?.textContent === "Nombres del formulario",
        ),
      );
      await select("Nombres del formulario", "niif");
      assert.ok(await field("Ingresos de actividades ordinarias (41)"));
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 1000 });
        for (const theme of ["light", "dark"]) {
          await page.evaluate((theme) => {
            document.documentElement.classList.toggle("dark", theme === "dark");
            window.scrollTo(0, 0);
          }, theme);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            ),
            false,
          );
          await page.screenshot({
            path: join(dir, `${phase}-financial-niif-${width}-${theme}.png`),
            fullPage: true,
          });
          report.push({
            route: "/precios",
            variant: "financial editor, NIIF",
            width,
            theme,
            overflow: false,
          });
        }
      }
      await click("Cancelar periodo");
      interactions.push("save and edit financial period, switch NIIF names");
    }
    if (
      phase >= "phase3" &&
      !process.argv.includes("--integrations-only") &&
      !process.argv.includes("--signals-only")
    ) {
      await page.goto(
        `http://localhost:3001/precios/mercado?serviceId=${fixtures.serviceId}`,
        {
          waitUntil: "networkidle2",
        },
      );
      await click("Añadir referencia");
      await select("Servicio de referencia", fixtures.serviceId);
      await fill("Descripción del alcance", `${fixtures.marker} mercado`);
      await fill("Precio de referencia", "1.250.000");
      await fill("Proveedor", fixtures.marker);
      await fill("Fecha de referencia", "2026-10");
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 1000 });
        for (const theme of ["light", "dark"]) {
          await page.evaluate((theme) => {
            document.documentElement.classList.toggle("dark", theme === "dark");
            window.scrollTo(0, 0);
          }, theme);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            ),
            false,
          );
          await page.screenshot({
            path: join(dir, `${phase}-market-form-${width}-${theme}.png`),
            fullPage: true,
          });
          report.push({
            route: "/precios/mercado",
            variant: "reference editor",
            width,
            theme,
            overflow: false,
          });
        }
      }
      await click("Guardar referencia");
      await page.waitForFunction(() =>
        document.body.textContent.includes("Referencia de mercado guardada"),
      );
      await page.waitForFunction(
        (marker) =>
          Array.from(document.querySelectorAll("article")).some((a) =>
            a.textContent.includes(`${marker} mercado`),
          ),
        {},
        fixtures.marker,
      );
      await page.screenshot({
        path: join(dir, `${phase}-market-saved.png`),
        fullPage: true,
      });
      interactions.push("save market reference");
    }
    if (
      phase >= "phase4" &&
      !process.argv.includes("--integrations-only") &&
      !process.argv.includes("--signals-only")
    ) {
      console.log("Checking regional editor interactions.");
      await page.goto("http://localhost:3001/precios/regiones", {
        waitUntil: "networkidle2",
      });
      await click("Añadir factor manual");
      await fill("País del factor", fixtures.marker);
      await select("Servicio del factor", fixtures.serviceId);
      await fill("Factor manual", "1,2");
      await fill("Fecha del factor", "2026-10-27");
      const saveWithoutReason = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll("button")).find(
            (b) => b.textContent.trim() === "Guardar factor manual",
          )?.disabled,
      );
      assert.equal(
        saveWithoutReason,
        true,
        "A non-neutral factor requires justification",
      );
      await fill("Justificación del factor", fixtures.marker);
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 1000 });
        for (const theme of ["light", "dark"]) {
          await page.evaluate((theme) => {
            document.documentElement.classList.toggle("dark", theme === "dark");
            window.scrollTo(0, 0);
          }, theme);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            ),
            false,
          );
          await page.screenshot({
            path: join(dir, `${phase}-region-form-${width}-${theme}.png`),
            fullPage: true,
          });
          report.push({
            route: "/precios/regiones",
            variant: "factor editor",
            width,
            theme,
            overflow: false,
          });
        }
      }
      await click("Guardar factor manual");
      await page.waitForFunction(() =>
        document.body.textContent.includes("Factor manual guardado"),
      );
      console.log("Regional factor save confirmed.");
      await page.waitForFunction(
        () =>
          !Array.from(document.querySelectorAll("button")).some(
            (b) => b.textContent.trim() === "Guardar factor manual",
          ),
      );
      await click("Añadir ingreso estimado");
      console.log("Estimated income editor opened.");
      await fill("País del ingreso estimado", fixtures.marker);
      await fill("Ingreso mensual estimado, COP", "1.500.000");
      await fill("Fecha del ingreso estimado", "2026-10-27");
      await fill("Justificación del ingreso estimado", fixtures.marker);
      await click("Guardar ingreso estimado");
      await page.waitForFunction(() =>
        document.body.textContent.includes("Ingreso estimado guardado"),
      );
      interactions.push(
        "reject unjustified factor, save manual factor and explicit stratum estimate",
      );
      await page.goto("http://localhost:3001/precios", {
        waitUntil: "networkidle2",
      });
      await click("Crear");
      await select("Departamento", "ANTIOQUIA");
      await select("Municipio", "MEDELLÍN");
      assert.equal(
        await (await field("Municipio")).evaluate((e) => e.value),
        "MEDELLÍN",
      );
      await click("Cancelar");
      interactions.push("DIVIPOLA department and municipality selectors");
    }
    if (phase >= "phase5") {
      console.log(
        "Checking acceptance, journal, Today and trash integrations.",
      );
      await page.goto("http://localhost:3001/precios", {
        waitUntil: "networkidle2",
      });
      await select("Elegir cliente", fixtures.clientId);
      for (const summary of await page.$$("summary"))
        if (
          await summary.evaluate((e) =>
            e.textContent.includes("Señales del cliente"),
          )
        )
          await clickElement(summary);
      const previousFollowers = await (
        await field("Instagram")
      ).evaluate((e) => e.value);
      await fill(
        "Instagram",
        previousFollowers === "1.234" ? "1.235" : "1.234",
      );
      await (await field("Instagram")).press("Tab");
      await page.waitForFunction(() =>
        document.body.textContent.includes("Señal del cliente guardada"),
      );
      interactions.push("save a declared social signal in place");
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 1000 });
        for (const theme of ["light", "dark"]) {
          await page.evaluate(
            (theme) =>
              document.documentElement.classList.toggle(
                "dark",
                theme === "dark",
              ),
            theme,
          );
          const section = await page.$("main section");
          await section.screenshot({
            path: join(dir, `${phase}-signals-${width}-${theme}.png`),
          });
          report.push({
            route: "/precios",
            variant: "declared client signals",
            width,
            theme,
          });
        }
      }
      if (process.argv.includes("--signals-only")) {
        console.log(
          "Client signals saved and inspected in four screen variants.",
        );
        return;
      }
      await page.goto("http://localhost:3001/precios/cotizaciones", {
        waitUntil: "networkidle2",
      });
      let status = null;
      for (const candidate of await page.$$(
        `select[aria-label="Estado de ${fixtures.marker} browser"]`,
      )) {
        if (
          await candidate.evaluate((e) => e.value !== "accepted" && !e.disabled)
        ) {
          status = candidate;
          break;
        }
      }
      assert.ok(status);
      await status.select("accepted");
      await page.waitForFunction(() =>
        document.body.textContent.includes(
          "Cotización aceptada. El trabajo se creó",
        ),
      );
      await page.waitForFunction(
        (marker) =>
          Array.from(document.querySelectorAll("article")).some(
            (a) =>
              a.querySelector("h2")?.textContent === `${marker} browser` &&
              a.querySelector('a[href="/trabajos"]'),
          ),
        {},
        fixtures.marker,
      );
      await page.goto("http://localhost:3001/trabajos", {
        waitUntil: "networkidle2",
      });
      assert.ok(
        await page.evaluate(
          (marker) => document.body.textContent.includes(`${marker} browser`),
          fixtures.marker,
        ),
      );
      interactions.push("accept a quote and open the linked work item");
      await page.goto("http://localhost:3001/", { waitUntil: "networkidle2" });
      await page.waitForFunction(
        (marker) =>
          document.body.textContent.includes(`${marker} recordatorio`),
        {},
        fixtures.marker,
      );
      assert.ok(
        await page.evaluate(
          () =>
            document.body.textContent.includes("8 días sin respuesta") &&
            document.body.textContent.includes("vence en 3 días"),
        ),
      );
      interactions.push("Today shows unanswered and expiring quotes");
      await page.keyboard.down("Control");
      await page.keyboard.press("KeyK");
      await page.keyboard.up("Control");
      const palette = await page.waitForSelector(
        'input[placeholder^="Ir a un módulo"]',
      );
      await palette.type("Cotizaciones");
      await page.waitForFunction(() =>
        document
          .querySelector('[role="dialog"]')
          ?.textContent.includes("Cotizaciones"),
      );
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () => location.pathname === "/precios/cotizaciones",
      );
      interactions.push("command palette opens pricing quotes");
      await page.goto("http://localhost:3001/bitacora", {
        waitUntil: "networkidle2",
      });
      assert.ok(
        await page.evaluate(
          () =>
            document.body.textContent.includes("Aceptaron la cotización") &&
            document.body.textContent.includes("Cotizaste"),
        ),
      );
      interactions.push("journal displays quote and acceptance events");
      await page.goto("http://localhost:3001/precios/regiones", {
        waitUntil: "networkidle2",
      });
      await fill("País observado", fixtures.marker);
      await fill("País de referencia", `${fixtures.marker} referencia`);
      await select("Servicio observado", fixtures.serviceId);
      await click("Guardar factor observado");
      await page.waitForFunction(() =>
        document.body.textContent.includes("Factor observado guardado"),
      );
      interactions.push("save an observed factor from six comparable quotes");
      await page.goto(
        `http://localhost:3001/precios/mercado?serviceId=${fixtures.serviceId}`,
        {
          waitUntil: "networkidle2",
        },
      );
      let removed = false;
      for (const article of await page.$$("article")) {
        if (
          await article.evaluate(
            (e, marker) =>
              e.querySelector("h2")?.textContent === `${marker} mercado`,
            fixtures.marker,
          )
        ) {
          for (const action of await article.$$("button"))
            if (
              await action.evaluate(
                (e) =>
                  e.textContent.trim() === "Mover referencia a la papelera",
              )
            ) {
              confirmTestDeletion = true;
              await clickElement(action);
              removed = true;
              break;
            }
          if (removed) break;
        }
      }
      assert.ok(removed);
      await page.waitForFunction(() =>
        document.body.textContent.includes("Referencia en la papelera"),
      );
      await page.goto("http://localhost:3001/papelera", {
        waitUntil: "networkidle2",
      });
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 1000 });
        for (const theme of ["light", "dark"]) {
          await page.evaluate(
            (theme) =>
              document.documentElement.classList.toggle(
                "dark",
                theme === "dark",
              ),
            theme,
          );
          await page.screenshot({
            path: join(dir, `${phase}-trash-row-${width}-${theme}.png`),
            fullPage: true,
          });
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            ),
            false,
          );
          report.push({
            route: "/papelera",
            variant: "pricing reference in trash",
            width,
            theme,
            overflow: false,
          });
        }
      }
      let restored = false;
      for (const row of await page.$$("li")) {
        if (
          await row.evaluate(
            (e, marker) =>
              e.querySelector("p[title]")?.getAttribute("title") ===
              `${marker} mercado`,
            fixtures.marker,
          )
        ) {
          for (const action of await row.$$("button"))
            if (
              await action.evaluate((e) => e.textContent.trim() === "Restaurar")
            ) {
              await clickElement(action);
              restored = true;
              break;
            }
          if (restored) break;
        }
      }
      assert.ok(restored);
      await page.waitForFunction(
        (marker) =>
          !Array.from(document.querySelectorAll("p[title]")).some(
            (p) => p.getAttribute("title") === `${marker} mercado`,
          ),
        {},
        fixtures.marker,
      );
      interactions.push(
        "trash and restore a market reference through the real UI",
      );
      for (const route of ["/", "/trabajos", "/bitacora", "/papelera"]) {
        for (const width of [1440, 390]) {
          await page.setViewport({ width, height: 1000 });
          for (const theme of ["light", "dark"]) {
            await browser.setCookie({
              name: "theme",
              value: theme,
              domain: "localhost",
              path: "/",
            });
            await page.goto(`http://localhost:3001${route}`, {
              waitUntil: "networkidle2",
            });
            assert.equal(
              await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth + 1,
              ),
              false,
              `Overflow in integration ${route}`,
            );
            await page.screenshot({
              path: join(
                dir,
                `${phase}-integration-${route.replaceAll("/", "_")}-${width}-${theme}.png`,
              ),
              fullPage: true,
            });
            report.push({
              route,
              variant: "pricing integration",
              width,
              theme,
              overflow: false,
            });
          }
        }
      }
    }
    assert.deepEqual(errors, []);
    writeFileSync(
      join(dir, `${phase}-report.json`),
      JSON.stringify({ screens: report, interactions, errors }, null, 2),
    );
    console.log(
      `${phase}: ${report.length} screen variants checked in Chrome; ${interactions.join("; ")} passed.`,
    );
  } catch (error) {
    console.error(`UI check failed at ${page.url()} (${lastAction}).`);
    console.error(error.stack);
    await page
      .screenshot({ path: join(dir, `${phase}-failure.png`), fullPage: false })
      .catch(() => console.error("Could not capture the blocked browser."));
    throw error;
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
