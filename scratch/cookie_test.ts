import { getDb } from "../lib/db";
import { decryptSecret } from "../lib/crypto";

function run() {
  const db = getDb();
  const acc = db.prepare("SELECT cookies_json FROM accounts LIMIT 1").get() as any;
  const state = JSON.parse(decryptSecret(acc.cookies_json)!);
  const liAt = state.cookies.find((c: any) => c.name === "li_at");
  console.log("li_at present:", !!liAt);
  if (liAt) {
    console.log("li_at value length:", liAt.value.length);
    console.log("li_at valid format:", liAt.value.startsWith("AQED"));
  }
}
run();
