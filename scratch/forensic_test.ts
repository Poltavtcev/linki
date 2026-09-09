import { chromium, Page } from "playwright";
import { captureForensicFixture } from "../lib/linkedin/forensics";
import fs from "fs/promises";
import path from "path";

async function runTest() {
  console.log("Starting synthetic test for Forensic Helper...");
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to a minimal test page
    await page.setContent(`
      <html>
        <head><title>Test Page</title></head>
        <body>
          <h1>Test</h1>
          <button id="btn1" aria-label="Submit">Click Me</button>
          <a href="#" class="link-class" role="button">Link as button</a>
          <div style="display:none"><button>Hidden</button></div>
        </body>
      </html>
    `);

    console.log("Page loaded. Simulating an error...");
    
    // Simulate an action failure that triggers the fixture
    const fakeError = new Error("Simulated failure: element not found");
    
    // Record directory before
    const baseDir = path.join(process.cwd(), ".ai", "evidence", "linkedin");
    
    // Call the helper
    await captureForensicFixture(page, fakeError, {
      actionName: "synthetic_test",
      accountId: "test-account-123",
      targetId: "target-456",
      expectedAction: "Click the test button"
    });

    console.log("Fixture captured. Validating files...");
    
    // Find the latest directory
    const dirs = await fs.readdir(baseDir);
    const testDirs = dirs.filter(d => d.includes("synthetic_test")).sort();
    const latestDir = path.join(baseDir, testDirs[testDirs.length - 1]);
    
    console.log(`Checking directory: ${latestDir}`);
    
    const files = await fs.readdir(latestDir);
    const expectedFiles = ["screenshot.png", "dom.html", "interactive.json", "meta.json"];
    
    for (const file of expectedFiles) {
      if (!files.includes(file)) {
        throw new Error(`Missing file: ${file}`);
      }
    }
    
    // Check interactive.json content
    const interactive = JSON.parse(await fs.readFile(path.join(latestDir, "interactive.json"), "utf8"));
    if (interactive.length !== 2) {
      throw new Error(`Expected 2 interactive elements, got ${interactive.length}`);
    }
    if (interactive[0].text !== "Click Me") throw new Error("Button text mismatch");
    
    // Check meta.json
    const meta = JSON.parse(await fs.readFile(path.join(latestDir, "meta.json"), "utf8"));
    if (meta.error !== "Simulated failure: element not found") throw new Error("Meta error mismatch");
    if (meta.accountId !== "test-account-123") throw new Error("Meta accountId mismatch");
    
    console.log("✅ Synthetic test passed successfully!");
    
    // Cleanup the test directory
    await fs.rm(latestDir, { recursive: true, force: true });
    
  } catch (e) {
    console.error("❌ Synthetic test failed:", e);
  } finally {
    await page.close();
    await browser.close();
  }
}

runTest();
