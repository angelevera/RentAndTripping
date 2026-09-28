# API Coverage — Phase 1 (Base y acceso seguro)

No external API integration: phase only provisions the project's locked platform (Supabase DB/Auth/Storage) via its SDK and CLI; the "Data API" hit is a dashboard label.

Reasoning, recorded for the seal-time gate:
- Phase 1 uses Supabase's official SDK and CLI, plus one admin configuration call to the Supabase Management API. It does not integrate a third-party service whose capability surface must be enumerated. The detector's only signal was the dashboard label "Data API" inside the user-setup instructions, which is a platform-configuration false positive.
- The Auth capabilities this phase uses were chosen by CONTEXT decisions, not by a first-use-case accident. It uses email/password sign-in, local-scope sign-out and session refresh. Public sign-up is intentionally disabled (invite-only, ARCHITECTURE Pattern 2). Password recovery and lockout stay at Supabase defaults (CONTEXT discretion). OAuth, magic links, MFA and phone auth are outside the MVP scope in REQUIREMENTS.md.
- The Storage capabilities are limited to a private bucket and its access policies. Upload and download UI belongs to Phase 4 (PAGO-02).
- Phase 5 integrates a genuine external service, Resend email (AVISO-01/02). That phase should produce a real coverage matrix.
