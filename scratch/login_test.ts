import { startHeadlessLogin } from "../lib/linkedin/session";

async function run() {
  console.log("Starting headless login test...");
  const res = await startHeadlessLogin("dummy_id", "test@example.com", "dummy_pass");
  console.log("Result:", res);
}
run();
