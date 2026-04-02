# Security

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive reports.

Instead, use **[GitHub Security Advisories](https://github.com/SamEthanMathew/prosperity-match-viz/security/advisories/new)** for this repository (if enabled on the repo), or contact the maintainers privately through GitHub.

Include:

- A short description of the issue and its impact  
- Steps to reproduce (if safe to share)  
- Any suggested fix, if you have one  

We will treat reports seriously and aim to respond in a reasonable timeframe.

## Scope notes

- The web app runs **entirely in the browser** for normal use; match zips are parsed client-side unless the user opts into optional Supabase upload.
- **Never commit** Supabase service-role keys, database passwords, or personal `.env.local` files. Those paths are listed in `.gitignore`.
