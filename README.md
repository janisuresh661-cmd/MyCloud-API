# MyCloud API

Backend for the MyCloud cloud-storage application.

Architecture:
GitHub Pages frontend → Cloudflare Worker → D1 + R2

Planned features:
- Individual user accounts
- Secure password authentication
- Per-user file ownership
- 600 MB storage limit per user
- Upload, download and delete
- Storage reclaimed after deletion
- Per-user download history
- Clear history without deleting files
- Server-side authorization

Cloudflare bindings:
- DB = D1 database
- FILES = R2 bucket

These bindings are intentionally left unconfigured until the Cloudflare resources are created.
