const fs = require('fs');
let code = fs.readFileSync('lib/linkedin/scraper.ts', 'utf8');

// Fix 1: enrichWithFlagshipUrls
code = code.replace(
  /return \{ status: resp\.status, body: await resp\.text\(\) \};/,
  `return { status: resp.status, body: await resp.text(), retryAfter: resp.headers.get("retry-after") };`
);

code = code.replace(
  /\} catch \(e: unknown\) \{\n\s*return \{ status: -1, body: \(e as Error\)\.message \};/,
  `} catch (e: unknown) {
          return { status: -1, body: (e as Error).message, retryAfter: null };`
);

code = code.replace(
  /const timeoutPromise = new Promise<\{\s*status: number;\s*body: string\s*\}>/,
  `const timeoutPromise = new Promise<{ status: number; body: string; retryAfter: string | null }>`
);

code = code.replace(
  /setTimeout\(\(\) => resolve\(\{ status: -1, body: 'timeout' \}\), 15000\)/,
  `setTimeout(() => resolve({ status: -1, body: 'timeout', retryAfter: null }), 15000)`
);

code = code.replace(
  /else if \(result\.status === 429\) \{\n\s*attempts\+\+;\n\s*console\.log\(\`\[scraper\] 429 rate limit — waiting 30s before retry \(attempt \$\{attempts\}\/3\)\`\);\n\s*await page\.waitForTimeout\(30000\);\n\s*\}/,
  `else if (result.status === 429) {
        attempts++;
        const retryAfterSec = result.retryAfter ? parseInt(result.retryAfter, 10) : 30;
        const waitMs = (!isNaN(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 30) * 1000;
        console.log(\`[scraper] 429 rate limit — waiting \${waitMs/1000}s based on Retry-After (attempt \${attempts}/3)\`);
        await page.waitForTimeout(waitMs);
      }`
);


// Fix 2: scrapeNavigatorList and scrapeSavedSearch - handle 429 intercepts
const interceptRegex = /if \(response\.status\(\) === 429\) \{\n\s*isDone = true;\n\s*clearTimeout\(timeout\);\n\s*reject\(new Error\("429 Rate Limit"\)\);\n\s*\}/g;
code = code.replace(interceptRegex, `if (response.status() === 429) {
            isDone = true;
            clearTimeout(timeout);
            const headers = response.headers();
            const retryAfterStr = headers["retry-after"];
            const retryAfterSec = retryAfterStr ? parseInt(retryAfterStr, 10) : 30;
            const waitSec = !isNaN(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 30;
            reject(new Error(\`429 Rate Limit - Retry-After: \${waitSec}s\`));
          }`);

// Fix 3: graceful try-catch around waitForIntercept in scrapeNavigatorList
const waitRegex1 = /let pageData = await waitForIntercept\(buildUrl\(pageNum\), 15000\);\n\s*if \(!pageData \|\| \(pageData\.elements\?\.length \?\? 0\) === 0\) \{\n\s*console\.log\(`\[scraper\] page \$\{pageNum\} empty on first try — retrying with 15s wait`\);\n\s*pageData = await waitForIntercept\(buildUrl\(pageNum\), 15000\);\n\s*\}/g;

code = code.replace(waitRegex1, `let pageData = null;
    try {
      pageData = await waitForIntercept(buildUrl(pageNum), 15000);
      if (!pageData || (pageData.elements?.length ?? 0) === 0) {
        console.log(\`[scraper] page \${pageNum} empty on first try — retrying with 15s wait\`);
        pageData = await waitForIntercept(buildUrl(pageNum), 15000);
      }
    } catch (e: any) {
      if (e.message && e.message.includes("429 Rate Limit")) {
        const waitSecMatch = e.message.match(/Retry-After: (\\d+)s/);
        const waitSec = waitSecMatch ? parseInt(waitSecMatch[1], 10) : 30;
        console.log(\`[scraper] Got 429 on page \${pageNum}. Backing off for \${waitSec}s before retrying...\`);
        await page.waitForTimeout(waitSec * 1000);
        try {
          pageData = await waitForIntercept(buildUrl(pageNum), 15000);
        } catch (e2) {
          console.log(\`[scraper] 2nd attempt failed on 429. Aborting scrape.\`);
          break;
        }
      } else {
        throw e;
      }
    }`);

// Fix 4: graceful try-catch around waitForIntercept in scrapeSavedSearch
const waitRegex2 = /let pageData = await waitForIntercept\(buildUrl\(pageNum\), 15000\);\n\s*if \(!pageData \|\| \(pageData\.elements\?\.length \?\? 0\) === 0\) \{\n\s*console\.log\(`\[scraper:saved-search\] page \$\{pageNum\} empty on first try — retrying with 15s wait`\);\n\s*pageData = await waitForIntercept\(buildUrl\(pageNum\), 15000\);\n\s*\}/g;

code = code.replace(waitRegex2, `let pageData = null;
    try {
      pageData = await waitForIntercept(buildUrl(pageNum), 15000);
      if (!pageData || (pageData.elements?.length ?? 0) === 0) {
        console.log(\`[scraper:saved-search] page \${pageNum} empty on first try — retrying with 15s wait\`);
        pageData = await waitForIntercept(buildUrl(pageNum), 15000);
      }
    } catch (e: any) {
      if (e.message && e.message.includes("429 Rate Limit")) {
        const waitSecMatch = e.message.match(/Retry-After: (\\d+)s/);
        const waitSec = waitSecMatch ? parseInt(waitSecMatch[1], 10) : 30;
        console.log(\`[scraper:saved-search] Got 429 on page \${pageNum}. Backing off for \${waitSec}s before retrying...\`);
        await page.waitForTimeout(waitSec * 1000);
        try {
          pageData = await waitForIntercept(buildUrl(pageNum), 15000);
        } catch (e2) {
          console.log(\`[scraper:saved-search] 2nd attempt failed on 429. Aborting scrape.\`);
          break;
        }
      } else {
        throw e;
      }
    }`);


fs.writeFileSync('lib/linkedin/scraper.ts', code);
