#!/usr/bin/env node
/*
 * Pre-commit secret scan: blocks commits containing common secret patterns.
 * Scans staged additions only (ACM) to minimize noise.
 */
import { execSync } from 'node:child_process';

const patterns = [
  { id: 'PEM_KEY', regex: /-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----/ },
  { id: 'SENDGRID_KEY', regex: /SG\.[A-Za-z0-9_-]{16,}\.([A-Za-z0-9_-]{20,})/ },
  { id: 'AWS_ACCESS_KEY', regex: /AKIA[0-9A-Z]{16}/ },
  { id: 'GCP_API_KEY', regex: /AIza[0-9A-Za-z\-_]{35}/ },
  { id: 'JWT', regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
];

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
}

function getStagedFiles() {
  const output = run('git diff --cached --name-only --diff-filter=ACM');
  return output ? output.split('\n').filter(Boolean) : [];
}

function readFileFromIndex(path) {
  try {
    return run(`git show :${path}`);
  } catch (e) {
    return null; // Skip binary or removed files
  }
}

function scanFile(path, content) {
  const findings = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    patterns.forEach(({ id, regex }) => {
      regex.lastIndex = 0;
      if (regex.test(line)) {
        findings.push({
          path,
          line: idx + 1,
          id,
          snippet: line.trim().slice(0, 120),
        });
      }
    });
  });
  return findings;
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  const findings = stagedFiles.flatMap(file => {
    const content = readFileFromIndex(file);
    if (!content) return [];
    return scanFile(file, content);
  });

  if (findings.length > 0) {
    console.error('❌ Secret scan failed. Potential secrets detected in staged files:');
    findings.forEach(f => {
      console.error(`- [${f.id}] ${f.path}:${f.line} => ${f.snippet}`);
    });
    console.error('\nIf this is a false positive, mask or refactor before committing.');
    process.exit(1);
  }

  process.exit(0);
}

main();
