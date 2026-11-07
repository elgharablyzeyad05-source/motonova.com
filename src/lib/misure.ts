const TESTA: Record<string, string> = { XS: "53–54 cm", S: "55–56 cm", M: "57–58 cm", L: "59–60 cm", XL: "61–62 cm", XXL: "63–64 cm" };
const TORACE: Record<string, string> = { XS: "88 cm", S: "92 cm", M: "96 cm", L: "100 cm", XL: "104 cm", XXL: "108 cm", "46": "92 cm", "48": "96 cm", "50": "100 cm", "52": "104 cm", "54": "108 cm", "56": "112 cm" };
const MANO: Record<string, string> = { XS: "7", S: "8", M: "9", L: "10", XL: "11", XXL: "12" };

export function misuraDi(categoria: string, taglia: string): string {
  if (categoria === "caschi") return TESTA[taglia] ?? "";
  if (categoria === "guanti") return MANO[taglia] ? "mis. " + MANO[taglia] : "";
  if (categoria === "stivali") return "EU " + taglia;
  return TORACE[taglia] ?? "";
}

export function cosaMisura(categoria: string): [string, string, string] {
  if (categoria === "caschi") return ["Taglia — circonferenza cranica", "Size — head circumference", "المقاس — محيط الراس"];
  if (categoria === "guanti") return ["Taglia — circonferenza della mano", "Size — hand circumference", "المقاس — محيط الإيد"];
  if (categoria === "stivali") return ["Numero — misura europea", "Size — European", "المقاس — أوروبي"];
  return ["Taglia — circonferenza torace", "Size — chest circumference", "المقاس — محيط الصدر"];
}
