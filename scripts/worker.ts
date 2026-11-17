import { workOne } from "../src/lib/platform";
import { db } from "../src/lib/db";
try {
  let count = 0;
  while (count < 100 && (await workOne())) count++;
  console.log(JSON.stringify({ processed: count }));
} catch {
  console.error("worker_failed_inspect_running_jobs");
  process.exitCode = 1;
} finally {
  await db().end();
}
