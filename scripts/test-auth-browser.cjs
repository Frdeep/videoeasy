const http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = "http://127.0.0.1:3010";
const email = "browser-fixture@example.invalid";
const password = "browser-fixture-password-123";
let confirmed = false;
let mailCount = 0;
let pkceCount = 0;
let passwordCount = 0;
const user = {
  id: "77777777-7777-4777-8777-777777777777",
  aud: "authenticated",
  role: "authenticated",
  email,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
function token() {
  return [
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    Buffer.from(
      JSON.stringify({
        iss: "http://127.0.0.1:54329/auth/v1",
        sub: user.id,
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        role: "authenticated",
        email,
      }),
    ).toString("base64url"),
    "fixture-signature",
  ].join(".");
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:54329");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let data = {};
  try {
    data = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {}
  function json(status, obj) {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "x-supabase-api-version": "2024-01-01",
    });
    res.end(JSON.stringify(obj));
  }
  if (url.pathname.endsWith("/verify")) {
    if (url.searchParams.get("token") === "expired") {
      res.writeHead(302, {
        Location:
          base +
          "/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+expired",
      });
      return res.end();
    }
    confirmed = true;
    res.writeHead(302, { Location: base + "/auth/callback?code=fixture-code" });
    return res.end();
  }
  if (url.pathname.endsWith("/signup")) {
    mailCount++;
    return json(200, { ...user, email_confirmed_at: null });
  }
  if (url.pathname.endsWith("/resend")) {
    mailCount++;
    return json(200, {});
  }
  if (url.pathname.endsWith("/token")) {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      passwordCount++;
      if (!confirmed)
        return json(400, {
          code: "email_not_confirmed",
          msg: "Email not confirmed",
        });
      assert.equal(data.email, email);
      assert.equal(data.password, password);
    } else if (grant === "pkce") {
      pkceCount++;
      if (!data.code_verifier)
        return json(400, {
          code: "bad_code_verifier",
          msg: "Missing verifier",
        });
    }
    return json(200, {
      access_token: token(),
      refresh_token: "fixture-refresh",
      expires_in: 3600,
      token_type: "bearer",
      user: { ...user, email_confirmed_at: new Date().toISOString() },
    });
  }
  if (url.pathname.endsWith("/user"))
    return confirmed
      ? json(200, { ...user, email_confirmed_at: new Date().toISOString() })
      : json(401, { code: "bad_jwt", msg: "Unauthenticated" });
  if (url.pathname.endsWith("/logout")) {
    res.writeHead(204);
    return res.end();
  }
  return json(404, { path: url.pathname });
});
(async () => {
  await new Promise((resolve) => server.listen(54329, "127.0.0.1", resolve));
  let browser;
  const { spawn } = require("node:child_process");
  const app = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3010",
    ],
    {
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-public-key",
        APP_URL: base,
        DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
        GENERATION_PROVIDER: "disabled",
        APP_ENV: "test",
      },
      stdio: "ignore",
    },
  );
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (app.exitCode !== null)
        throw Error("Test application exited before becoming ready");
      try {
        const response = await fetch(base + "/login", {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!ready) throw Error("Local test application failed to start");
    browser = await chromium.launch({
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
      headless: true,
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext();
    context.setDefaultTimeout(15000);
    const p = await context.newPage();
    async function login(page) {
      await page.goto(base + "/login");
      await page.getByLabel("E-mail", { exact: true }).fill(email);
      await page.getByLabel("Mot de passe", { exact: true }).fill(password);
      await page
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
    }
    await p.goto(base + "/login?mode=signup");
    await p.getByLabel("E-mail", { exact: true }).fill(email);
    await p
      .getByLabel("Mot de passe (12 caractères minimum)", { exact: true })
      .fill(password);
    await p
      .getByRole("button", { name: "Créer mon compte", exact: true })
      .click();
    await p.waitForURL("**/login?sent=confirmation");
    assert.equal(mailCount, 1);
    await login(p);
    await p.waitForURL("**/login?mode=password&error=confirmation");
    assert.equal(mailCount, 1, "Password login must not send emails");
    await p.goto("http://127.0.0.1:54329/auth/v1/verify?token=expired");
    await p.waitForURL("**/login?error=expired");
    assert.equal(mailCount, 1);
    assert.match(await p.locator(".auth-feedback").innerText(), /expiré/);
    await p
      .getByRole("link", { name: "Demander un nouveau lien de confirmation" })
      .click();
    await p.waitForURL("**/login?mode=resend");
    await p
      .getByRole("heading", { name: "Renvoyer la confirmation", exact: true })
      .waitFor();
    await p.getByLabel("E-mail", { exact: true }).fill(email);
    await p
      .getByRole("button", { name: "Envoyer un nouveau lien de confirmation" })
      .click();
    await p.waitForLoadState("networkidle");
    await p.waitForURL("**/login?sent=confirmation");
    assert.equal(mailCount, 2);
    await p.goto("http://127.0.0.1:54329/auth/v1/verify?token=valid");
    await p.waitForURL("**/account");
    await p.getByText(email, { exact: true }).waitFor();
    await p.reload();
    await p.getByText(email, { exact: true }).waitFor();
    assert.equal(mailCount, 2);
    assert.equal(pkceCount, 1);
    console.log(
      "PASS signup -> unconfirmed login without email -> expired link -> explicit resend -> PKCE session and reload",
    );
    const out = await p.request.post(base + "/auth/signout", {
      headers: { origin: base },
    });
    assert.equal(out.status(), 200);
    await p.goto(base + "/account");
    await p.waitForURL("**/login");
    await login(p);
    await p.waitForURL("**/account");
    await p.reload();
    await p.getByText(email, { exact: true }).waitFor();
    assert.equal(mailCount, 2);
    console.log(
      "PASS logout -> password login -> persisted cookie session, no new confirmation email",
    );
    const second = await browser.newContext();
    const other = await second.newPage();
    await other.goto(
      base + "/auth/callback?code=fixture-code-without-original-browser",
    );
    await other.waitForURL("**/login?error=session");
    await login(other);
    await other.waitForURL("**/account");
    assert.equal(mailCount, 2);
    console.log(
      "PASS another browser without PKCE verifier -> explicit recovery -> password login without email",
    );
    console.log(
      JSON.stringify({
        simulatedMails: mailCount,
        passwordLogins: passwordCount,
        realEmailsSent: 0,
      }),
    );
  } finally {
    if (browser) await browser.close();
    app.kill("SIGTERM");
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
