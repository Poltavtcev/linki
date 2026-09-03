const fs = require('fs');
let runner = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

runner = runner.replace(
  /calculateDailyJitteredLimit\(limits\.daily_inmail_limit \?\? 15, tr\.account_id, todayLocalDate\(\)\)/g,
  'calculateDailyJitteredLimit(limits.daily_inmail_limit ?? 15, run.account_id, todayLocalDate())'
);
runner = runner.replace(
  /calculateDailyJitteredLimit\(limits\.daily_connection_limit \?\? 20, tr\.account_id, todayLocalDate\(\)\)/g,
  'calculateDailyJitteredLimit(limits.daily_connection_limit ?? 20, run.account_id, todayLocalDate())'
);
// Fix the execution blocks where tr is actually defined, wait!
// At line 1347, `tr` is NOT defined. `run` is defined.
// The replace above will fix line 1347. But what about the `tr` blocks around line 1442?
// Let's check where `tr` was originally used.
