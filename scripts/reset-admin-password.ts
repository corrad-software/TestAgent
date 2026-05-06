/**
 * Reset a user's password by email (typically the default admin).
 *
 * SECURITY — do NOT pass passwords on the command line (history / logs).
 *
 * Prefer one of:
 *   ADMIN_RESET_EMAIL=admin@testagent.local ADMIN_RESET_PASSWORD='...' npx ts-node scripts/reset-admin-password.ts
 *   ADMIN_RESET_PASSWORD_FILE=/path/to/file    (single line with password only)
 *
 * Optional:
 *   --email=user@company.com           (defaults to admin@testagent.local)
 *   --password-env=VARIABLE_NAME       read password only from process.env[VARIABLE_NAME]
 *
 * Interactive (TTY only): prompts for password twice when no secret source above is set.
 */
import "dotenv/config";
import * as fs from "fs";
import * as readline from "readline";
import * as tty from "tty";
import { initDb, prisma } from "../src/db";
import { hashPassword } from "../src/auth";

const DEFAULT_EMAIL = "admin@testagent.local";
const MIN_LEN = 6;

function parseArgs(): { email: string; passwordEnv: string | null } {
  let email = (process.env["ADMIN_RESET_EMAIL"] ?? "").trim() || DEFAULT_EMAIL;
  let passwordEnv: string | null = null;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--email=")) email = a.slice("--email=".length).trim().toLowerCase();
    else if (a.startsWith("--password-env="))
      passwordEnv = a.slice("--password-env=".length).trim();
    else if (a === "--help" || a === "-h") {
      console.log(`
Reset admin/user password.

Environment (recommended):
  ADMIN_RESET_EMAIL           target user email (${DEFAULT_EMAIL} if omitted)
  ADMIN_RESET_PASSWORD       new password (non-interactive)
  ADMIN_RESET_PASSWORD_FILE  path — file contains exactly one line, the new password

Flags:
  --email=ADDR
  --password-env=ENV_NAME    read secret from that environment variable only
`);
      process.exit(0);
    }
  }
  return { email, passwordEnv };
}

function readSecretFromFile(): string | undefined {
  const p = process.env["ADMIN_RESET_PASSWORD_FILE"]?.trim();
  if (!p) return undefined;
  if (!fs.existsSync(p)) throw new Error(`ADMIN_RESET_PASSWORD_FILE not found: ${p}`);
  return fs.readFileSync(p, "utf-8").split(/\r?\n/)[0] ?? "";
}

function promptLine(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim());
    }),
  );
}

/** Masked prompt for TTY; Ctrl+C exits. */
function promptMasked(label: string): Promise<string> {
  const stdin = process.stdin as tty.ReadStream;
  const stdout = process.stdout;
  if (!stdin.isTTY) {
    throw new Error(
      "No TTY — set ADMIN_RESET_PASSWORD, ADMIN_RESET_PASSWORD_FILE, or use --password-env in a secret environment.",
    );
  }
  return new Promise((resolve, reject) => {
    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    let buf = "";
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", ondata);
      stdout.write("\n");
    };
    const ondata = (chunk: Buffer) => {
      const b = chunk[0];
      if (chunk.length === 1) {
        if (b === 0x03) {
          cleanup();
          reject(new Error("Cancelled."));
          return;
        }
        if (b === 0x0d || b === 0x0a) {
          cleanup();
          resolve(buf);
          return;
        }
        if (b === 0x7f || b === 0x08) {
          if (buf.length) buf = buf.slice(0, -1);
          stdout.cursorTo(label.length + buf.length);
          stdout.clearLine(1);
          stdout.write(label + "*".repeat(buf.length));
          return;
        }
      }
      const s = chunk.toString("utf8");
      if (s.length && s !== "\u007f") {
        buf += s;
        stdout.write("*");
      }
    };
    stdin.on("data", ondata);
  });
}

function resolvePlainPassword(passwordEnv: string | null): string | undefined {
  if (passwordEnv) {
    const v = process.env[passwordEnv];
    if (v == null || v === "") {
      throw new Error(`--password-env=${passwordEnv}: variable is unset or empty.`);
    }
    return v;
  }
  const fromEnv = process.env["ADMIN_RESET_PASSWORD"]?.trim();
  if (fromEnv) return fromEnv;
  const fromFile = readSecretFromFile()?.trim();
  if (fromFile) return fromFile;
  return undefined;
}

async function main(): Promise<void> {
  const { email: targetEmail, passwordEnv } = parseArgs();
  let plain = resolvePlainPassword(passwordEnv);

  if (plain === undefined) {
    const masked = await promptMasked(`New password for ${targetEmail}: `);
    const again = await promptMasked("Confirm password: ");
    if (masked !== again) {
      console.error("Passwords do not match.");
      process.exitCode = 1;
      return;
    }
    plain = masked;
  }

  if (plain.length < MIN_LEN) {
    console.error(`Password must be at least ${MIN_LEN} characters.`);
    process.exitCode = 1;
    return;
  }

  await initDb();

  const email = targetEmail.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with email: ${email}`);
    console.error("Create the admin first via first boot seed, UI, or run the app once on an empty User table.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(plain);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  console.log(`Password updated for ${email} (${user.role}).`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => {}));
