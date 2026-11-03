import { randomBytes } from "node:crypto";
export const nuovoId = () => "c" + randomBytes(12).toString("hex");
