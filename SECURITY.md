# Security policy

Cognera handles model credentials, sign-in sessions, study materials, and learning records. Its agents can also read documents and fetch web content. Please report vulnerabilities privately so maintainers can investigate before disclosure.

## Reporting a vulnerability

**Do not open a public issue, pull request, or Discord post for a security problem.**

Use [GitHub’s private vulnerability reporting form](https://github.com/niravgill4/LearnHarness/security/advisories/new) if it is available. Otherwise, contact the repository owner privately and ask for a secure way to share the details.

A useful report includes:

- the Cognera version or web build, plus your browser or OS;
- what an attacker can do and what they need first (a web page the agent reads, a file the learner opens, network access, and so on);
- steps to reproduce, or a proof of concept;
- any fix or mitigation you have in mind.

## What to expect

These are targets, not guarantees:

| Step | Target |
| --- | --- |
| Acknowledge your report | within 7 days |
| Initial assessment (confirmed or not, severity) | within 14 days |
| Fix released and advisory published | within 90 days of the report |

The fix is developed privately in a GitHub security advisory. We will keep you updated, agree on a disclosure date with you, and credit you in the published advisory unless you prefer to stay anonymous. A CVE can be requested through GitHub when one is warranted.

## Supported versions

Only the latest release receives security fixes. The desktop app updates itself, so fixes reach users through a new release. If you run from source, update to the latest `main` or the latest release tag.

## Scope

In scope:

- the desktop app (Electron shell, window, and IPC);
- the local API server, whether started by the desktop app or run from source;
- the hosted web app, including authentication and account data;
- the agent and its tools, including prompt injection from web pages, PDFs, or other content that leads to reading, changing, or sending your data;
- rendered content such as demos, figures, and markdown;
- the update and release pipeline.

Out of scope:

- attacks that already require running code as your OS user;
- bugs in third-party model or service providers themselves (report those to the provider);
- automated scanner output without a demonstrated impact on Cognera.
