export type DivipolaPlace = {
  code: string;
  departmentCode: string;
  department: string;
  municipality: string;
};
export const DIVIPOLA_SOURCE = "https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=5000";

/** Codes stay text so Antioquia's leading zero survives import and export. */
export function readDivipola(value: unknown): DivipolaPlace[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error("DIVIPOLA no devolvió una lista de municipios.");
  const rows = new Map<string, DivipolaPlace>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") throw new Error("Fila DIVIPOLA inválida.");
    const row = raw as Record<string, unknown>;
    if (
      !/^\d{4,5}$/.test(String(row.cod_mpio ?? "")) ||
      !/^\d{1,2}$/.test(String(row.cod_dpto ?? ""))
    )
      throw new Error("Falta un código DIVIPOLA válido.");
    const code = String(row.cod_mpio ?? "").padStart(5, "0");
    const departmentCode = String(row.cod_dpto ?? "").padStart(2, "0");
    const department = typeof row.dpto === "string" ? row.dpto.trim() : "";
    const municipality = typeof row.nom_mpio === "string" ? row.nom_mpio.trim() : "";
    if (
      !/^\d{5}$/.test(code) ||
      !/^\d{2}$/.test(departmentCode) ||
      !code.startsWith(departmentCode) ||
      !department ||
      !municipality
    )
      throw new Error("Código o nombre DIVIPOLA inválido.");
    const entry = { code, departmentCode, department, municipality };
    if (rows.has(code) && JSON.stringify(rows.get(code)) !== JSON.stringify(entry))
      throw new Error(`Código DIVIPOLA repetido con nombres distintos: ${code}.`);
    rows.set(code, entry);
  }
  return [...rows.values()].sort((a, b) => a.code.localeCompare(b.code));
}
