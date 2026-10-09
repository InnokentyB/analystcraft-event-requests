// Prepares a local MCP input; performs no network requests or deployment.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const [repository, image] = process.argv.slice(2);
if (
  !/^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(
    repository || "",
  ) ||
  repository.includes("/OWNER/")
)
  throw Error("Pass your published GitHub repository URL.");
if (
  !/^ghcr\.io\/[a-z0-9._-]+\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/.test(
    image || "",
  )
)
  throw Error("Pass your actual public immutable GHCR image digest.");
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim())
  throw Error(
    "Commit changes first. Build and publish exactly this clean commit.",
  );
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const manifest = JSON.parse(
  readFileSync("deploy/manifest.template.json", "utf8"),
);
manifest.source.repository = repository;
manifest.source.ref = sourceCommit;
mkdirSync("outputs", { recursive: true });
writeFileSync(
  "outputs/register-project.json",
  JSON.stringify({ manifest, sourceCommit, image }, null, 2) + "\n",
);
console.log(
  "Prepared outputs/register-project.json. Nothing registered or deployed. Verify the image provenance and account slot before using it.",
);
