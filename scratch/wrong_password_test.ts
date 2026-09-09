import { startHeadlessLogin } from "../lib/linkedin/session";
import { getDb } from "../lib/db";
import fs from "fs/promises";
import path from "path";

async function testWrongPassword() {
  const accountId = "test-wrong-pass-123";
  const result = await startHeadlessLogin(accountId, "wrong@example.com", "fake_password_123");
  console.log("Login result:", result);
  
  // Find the fixture
  const baseDir = path.join(process.cwd(), ".ai", "evidence", "linkedin");
  const dirs = await fs.readdir(baseDir);
  const loginDirs = dirs.filter(d => d.includes("server_login")).sort();
  if (loginDirs.length > 0) {
    const latestDir = path.join(baseDir, loginDirs[loginDirs.length - 1]);
    console.log(`Found fixture: ${latestDir}`);
    const meta = JSON.parse(await fs.readFile(path.join(latestDir, "meta.json"), "utf8"));
    console.log("Meta URL:", meta.url);
    console.log("Meta Error:", meta.error);
    const dom = await fs.readFile(path.join(latestDir, "dom.html"), "utf8");
    // Look for error message in DOM
    const match = dom.match(/class="[^"]*error[^"]*"[^>]*>(.*?)<\//i);
    if (match) {
      console.log("Found error text in DOM:", match[1].trim());
    } else {
      console.log("No obvious error class found. Dumping a portion of the text.");
    }
  }
}

testWrongPassword().catch(console.error);
