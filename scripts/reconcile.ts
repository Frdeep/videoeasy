// Read Stripe, repair local data. No Stripe mutations. Configure only test credentials.
import { db, withUserLock, transaction } from "../src/lib/db";
import { syncCustomer } from "../src/lib/sync";
import { verifyAccount } from "../src/lib/stripe";
try {
  await verifyAccount();
  const userId = process.argv[2];
  if (userId && !/^[0-9a-f-]{36}$/i.test(userId))
    throw new Error("Invalid user UUID");
  const { rows } = await db().query(
    "select user_id,customer_id from billing.customers where customer_id is not null" +
      (userId ? " and user_id=$1" : ""),
    userId ? [userId] : [],
  );
  let failures = 0;
  for (const row of rows) {
    try {
      await withUserLock(row.user_id, (c) =>
        transaction(c, () => syncCustomer(c, row.user_id, row.customer_id)),
      );
    } catch {
      failures++;
      console.error("reconciliation_failed", { userId: row.user_id });
    }
  }
  console.log(JSON.stringify({ checked: rows.length, failures }));
  if (failures) process.exitCode = 1;
} catch {
  console.error("reconciliation_configuration_or_connection_failed");
  process.exitCode = 1;
} finally {
  await db().end();
}
