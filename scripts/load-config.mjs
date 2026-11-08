import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

export async function loadConfig() {
  const source = await readFile(new URL("../config.js", import.meta.url), "utf8");
  const sandbox = { window: {} };
  runInNewContext(source, sandbox);
  const config = sandbox.window.APP_CONFIG;
  if (!config || !config.sources?.remotive) throw new Error("Invalid config.js");
  return config;
}
