<div align="center">

[![drill — train. track. transform.](public/og-image.png)](https://drill.celox.io)

# drill

### **train. track. transform.**

Eine multitenant Fitness- & Körper-Tracking-PWA mit Google-Login, Charts, Gamification und Motivations-E-Mails — im **Material 3 Expressive** Look.

[![Live](https://img.shields.io/badge/live-drill.celox.io-c6ff00?style=for-the-badge&logo=pwa&logoColor=14160f)](https://drill.celox.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003b57?logo=sqlite&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-2-ff7300)
![Material 3](https://img.shields.io/badge/Material%203-Expressive-c6ff00?logo=materialdesign&logoColor=14160f)

![Google OAuth](https://img.shields.io/badge/Auth-Google%20OAuth-4285F4?logo=google&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8?logo=pwa&logoColor=white)
![Gamification](https://img.shields.io/badge/Gamification-XP%20%C2%B7%20Streaks%20%C2%B7%20Badges-ffb59c)
![Emails](https://img.shields.io/badge/Emails-nodemailer%20%2B%20cron-ffd34d)
![GDPR](https://img.shields.io/badge/GDPR-export%20%26%20delete-34a853)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen?logo=nodedotjs&logoColor=white)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-c6ff00)

</div>

---

## ✨ Features

- **🔐 Google-Login (multitenant)** — jeder Account ein isolierter Mandant, eigene Daten, eigene Streaks.
- **📊 Flexibles Tracking** — generisches Metrik-Modell für beliebige Körperwerte:
  - **Körper:** Gewicht, Körperfett, Taille, Brust, Hüfte, Arm, Oberschenkel, Hals (+ eigene)
  - **Anwesenheit:** täglicher Check-in (Gym / Sport / Home / aktive Pause) mit 17-Wochen-Heatmap
  - **Training:** Workouts mit Kategorie, Dauer und einzelnen Sätzen (Übung · kg · Wdh.)
  - **Ernährung:** Kalorien & Makros **oder** einfache Tagesbewertung + Wasser
- **🎮 Volle Gamification** — XP pro Aktivität, Level-Kurve, Tages-**Streaks** mit Bonus, **11 freischaltbare Erfolge**.
- **📈 Charts** — Gewichts-/Maß-Verläufe, Kalorien-Balken, Streak-Ring, Level-Fortschritt (Recharts).
- **📧 Motivations-E-Mails** — wöchentlicher Report, Streak-in-Gefahr-Alert, täglicher Nudge. Double-Opt-in + 1-Klick-Abmeldung, geplant via `node-cron`.
- **🎨 Material 3 Expressive** — tonal surfaces, 10-stufige Shape-Scale, Spring-Motion, emphasized Typography (Roboto Flex), Electric-Lime-Akzent auf tiefem Neutral.
- **📱 PWA** — installierbar, offline-Shell, Service Worker mit versioniertem Cache.
- **🛡️ DSGVO** — vollständiger JSON-Export und unwiderrufliche Konto-/Datenlöschung in den Einstellungen.

## 🏗️ Architektur

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│  Frontend (React + Vite)    │  /api   │  Backend (Express)           │
│  Material 3 Expressive PWA  │ ──────▶ │  better-sqlite3 · HMAC-Cookie │
│  Recharts · React Router    │ cookie  │  Google OAuth · node-cron     │
└─────────────────────────────┘         │  nodemailer (Hostinger SMTP)  │
                                         └──────────────┬───────────────┘
                                                        │
                                                  SQLite (WAL)
```

- **Sessions:** HMAC-SHA256-signierte Cookies (kein JWT-Lib), `secure` nur über HTTPS.
- **OAuth:** Authorization-Code-Flow ohne SDK; ID-Token-Verifikation via Google `tokeninfo`.
- **Gamification:** server-autoritativ — append-only XP-Ledger + denormalisiertes Rollup auf dem User.
- **Zeitzonen:** alle „Tage" als `YYYY-MM-DD` in der User-Zeitzone, damit Streaks zur Wanduhr passen.

### Datenmodell (Auszug)

`users` · `metrics` (generische Zeitreihe) · `checkins` · `workouts` + `workout_sets` · `nutrition_logs` · `xp_events` · `user_achievements` · `email_prefs` · `email_log`

## 🚀 Lokale Entwicklung

```bash
# Backend
cd server
cp .env.example .env          # Google-OAuth-Credentials + (optional) SMTP eintragen
npm install
npm run dev                   # http://127.0.0.1:4252

# Frontend (zweites Terminal)
cd ..
npm install
npm run dev                   # http://localhost:5180  (proxyt /api -> :4252)
```

> Für lokalen OAuth-Test in der Google Cloud Console `http://localhost:5180/api/auth/callback`
> als Redirect-URI hinterlegen und `APP_ORIGIN=http://localhost:5180` setzen
> (HTTP relaxt automatisch das `secure`-Cookie-Flag).

### Tests

```bash
cd server && npm test         # node:test — Gamification, Level-Kurve, Streaks, Achievements
```

## 📦 Build & Deploy

```bash
npm run build                 # -> dist/   (statische PWA)
```

Vollständige Produktions-Deployment-Anleitung (nginx, systemd, certbot, Backups): **[DEPLOY.md](DEPLOY.md)**.

## ⚙️ Umgebungsvariablen

| Variable | Beschreibung |
|----------|--------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth-Credentials |
| `OAUTH_REDIRECT_URI` | `https://drill.celox.io/api/auth/callback` |
| `APP_ORIGIN` | öffentliche Basis-URL |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `SMTP_USER` / `SMTP_PASS` | Hostinger-SMTP (leer = E-Mails aus) |
| `TZ_NAME` | Zeitzone für Streaks & Cron (`Europe/Berlin`) |

Siehe [`server/.env.example`](server/.env.example) für die vollständige Liste.

## 🎮 XP & Erfolge

| Aktion | XP |
|--------|----|
| Check-in | 25 (+ Streak-Bonus) |
| Workout | 40 |
| Ernährung/Tag | 15 |
| Körpermetrik | 10 |

Erfolge u. a.: *Erster Schritt*, *Eine Woche* (7-Tage-Streak), *Eiserne Disziplin* (30), *Unaufhaltsam* (100), *Stammgast* (50 Workouts), *Tonnenweise* (10 t Volumen).

## 📄 Lizenz

[MIT](LICENSE) © 2026 Martin Pfeffer

<div align="center"><sub>Built with ❤️ and 🏋️ — train. track. transform.</sub></div>
