import { billingMinor } from "./billing-values";
const units = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
];
function underThousand(n: number): string {
  if (n < 30) return units[n];
  if (n < 100)
    return (
      ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"][
        Math.floor(n / 10)
      ] + (n % 10 ? ` y ${units[n % 10]}` : "")
    );
  if (n === 100) return "cien";
  return (
    [
      "",
      "ciento",
      "doscientos",
      "trescientos",
      "cuatrocientos",
      "quinientos",
      "seiscientos",
      "setecientos",
      "ochocientos",
      "novecientos",
    ][Math.floor(n / 100)] + (n % 100 ? ` ${underThousand(n % 100)}` : "")
  );
}
const apocope = (text: string) => text.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
function integerWords(n: number): string {
  if (n < 1000) return underThousand(n);
  if (n < 1000000)
    return (
      (Math.floor(n / 1000) === 1 ? "mil" : `${apocope(underThousand(Math.floor(n / 1000)))} mil`) +
      (n % 1000 ? ` ${underThousand(n % 1000)}` : "")
    );
  if (n < 1000000000000)
    return (
      (Math.floor(n / 1000000) === 1
        ? "un millón"
        : `${apocope(integerWords(Math.floor(n / 1000000)))} millones`) +
      (n % 1000000 ? ` ${integerWords(n % 1000000)}` : "")
    );
  return (
    (Math.floor(n / 1000000000000) === 1
      ? "un billón"
      : `${apocope(integerWords(Math.floor(n / 1000000000000)))} billones`) +
    (n % 1000000000000 ? ` ${integerWords(n % 1000000000000)}` : "")
  );
}
export function moneyInWords(amount: number, currency: string) {
  const minor = billingMinor(amount);
  const whole = Number(minor / BigInt(100));
  const cents = Number(minor % BigInt(100));
  const name =
    currency === "COP"
      ? whole === 1
        ? "peso colombiano"
        : "pesos colombianos"
      : currency === "USD"
        ? whole === 1
          ? "dólar estadounidense"
          : "dólares estadounidenses"
        : currency === "EUR"
          ? whole === 1
            ? "euro"
            : "euros"
          : currency;
  const exactMillion = whole > 0 && whole % 1000000 === 0;
  const text = `${apocope(integerWords(whole))}${exactMillion ? " de" : ""} ${name}${cents ? ` con ${apocope(underThousand(cents))} ${cents === 1 ? "centavo" : "centavos"}` : ""}`;
  return text[0].toUpperCase() + text.slice(1);
}
