const { execSync } = require("child_process");
try {
  execSync("npx ts-node -r tsconfig-paths/register -O '{\"module\":\"commonjs\"}' -e \"require('./lib/db').getDb()\"", { stdio: "inherit" });
} catch (e) {}
