// Lock the family's full histories behind role passwords.
//
//   node etl/lock_family.mjs
//
// Runs etl/lock_family.py, asks for four passwords (typed, never stored), and writes data/vault.json.
// Each history is encrypted with its own random key (AES-256-GCM). Each password (PBKDF2-SHA256)
// unwraps only the keys its role may read:
//   Papa:   Papa + Amaira      Mumma: Mumma + Amaira
//   Amaira: Amaira             Suhani (admin): all three
// The vault names no roles and holds no passwords, so without one it's just noise.
import { execFileSync } from "node:child_process";
import { randomBytes, pbkdf2Sync, createCipheriv } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ITER = 600_000;
const ROLES = [
  { role: "Papa", env: "LOCK_PAPA", sees: ["Dad", "Sister"] },
  { role: "Mumma", env: "LOCK_MUMMA", sees: ["Mom", "Sister"] },
  { role: "Amaira", env: "LOCK_AMAIRA", sees: ["Sister"] },
  { role: "Suhani", env: "LOCK_SUHANI", sees: ["Dad", "Mom", "Sister"] },
];

const b64 = (b) => Buffer.from(b).toString("base64");
const seal = (key, data) => {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(data), c.final(), c.getAuthTag()]);  // tag last, as WebCrypto expects
  return { iv: b64(iv), ct: b64(ct) };
};

// Hidden prompt: nothing echoes while typing.
function ask(q) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); resolve(a); });
  });
}

async function password(r) {
  if (process.env[r.env]) return process.env[r.env];
  for (;;) {
    const a = await ask(`Password for ${r.role} (sees ${r.sees.map((s) => ({ Dad: "Papa", Mom: "Mumma", Sister: "Amaira" })[s]).join(" + ")}): `);
    if (a.length < 10) { console.log("  Use at least 10 characters. Anyone can try guesses offline against the vault."); continue; }
    if ((await ask(`  Again: `)) === a) return a;
    console.log("  Didn't match, try again.");
  }
}

execFileSync(join(ROOT, ".venv/bin/python"), [join(ROOT, "etl/lock_family.py")], { stdio: "inherit" });
const full = JSON.parse(readFileSync(join(ROOT, "build/family_full.json"), "utf8"));

const keys = Object.fromEntries(Object.keys(full).map((who) => [who, randomBytes(32)]));
const profiles = Object.fromEntries(Object.entries(full).map(([who, rows]) => [who, seal(keys[who], Buffer.from(JSON.stringify(rows)))]));

const used = new Set();
const roles = [];
for (const r of ROLES) {
  const pw = await password(r);
  if (used.has(pw)) { console.error(`${r.role}'s password is the same as another role's. Every role needs its own.`); process.exit(1); }
  used.add(pw);
  const salt = randomBytes(16), kek = pbkdf2Sync(pw.normalize("NFC"), salt, ITER, 32, "sha256");
  const grant = { role: r.role, keys: Object.fromEntries(r.sees.map((w) => [w, b64(keys[w])])) };
  roles.push({ salt: b64(salt), ...seal(kek, Buffer.from(JSON.stringify(grant))) });
}
roles.sort(() => Math.random() - .5);  // order gives nothing away

writeFileSync(join(ROOT, "data/vault.json"), JSON.stringify({ v: 1, iter: ITER, roles, profiles }));
console.log(`Wrote data/vault.json (${Object.values(full).reduce((a, r) => a + r.length, 0).toLocaleString()} plays, ${roles.length} roles). Commit and push it.`);
