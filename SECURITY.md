# Security Policy

## Reporting a Vulnerability

If you find a security vulnerability in har-o-scope, please report it responsibly.

**Email:** Open a [GitHub Security Advisory](https://github.com/vegaPDX/har-o-scope/security/advisories/new) (preferred) or email the maintainer directly via their GitHub profile.

**Please include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

**Response time:** We aim to acknowledge reports within 48 hours and provide a fix within 7 days for critical issues.

**Scope:** This covers the har-o-scope npm package (`dist/lib`, `dist/cli`, `rules/`) and the hosted browser UI at vegaPDX.github.io/har-o-scope.

## Security Design

har-o-scope is designed with a zero-trust model:

- **No network requests.** All analysis runs locally in your browser or Node.js process. The browser UI makes zero network calls after page load.
- **No file uploads.** HAR files are read client-side via the File API (browser) or `fs.readFile` (Node.js). Nothing is sent to any server.
- **Sanitization built in.** The `sanitize` command and library function strip secrets, tokens, cookies, and high-entropy strings from HAR files before sharing.
- **Content Security Policy.** The browser UI uses strict CSP headers when deployed.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
