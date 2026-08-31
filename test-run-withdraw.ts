import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { getSessionPage } from "./lib/linkedin/session";
import { withdrawOldInvitations } from "./lib/linkedin/withdraw";

const ACCOUNT_ID = "2f759b56-56d3-4ca0-a10f-ec96c1cd5e2c"; 

async function run() {
  const page = await getSessionPage(ACCOUNT_ID);
  console.log("Running withdrawOldInvitations with 0 days (withdraw everything)...");
  
  try {
     const count = await withdrawOldInvitations(page, ACCOUNT_ID, 0, "6e30874a-4020-44b6-9502-dbc2410ed960");
     console.log(`TEST SUCCESS: Withdrawn ${count} invitations.`);
  } catch (err) {
     console.error("TEST FAILED:", err);
  }
  
  await page.close();
  process.exit(0);
}
run();
