# Mandla Mbatha School NPC website — Version 1.3.0

A responsive school website starter for Mandla Mbatha School NPC, using charcoal grey, gold and cream. It includes a database-backed admissions enquiry form, a restricted administration page, CSV export and an optional general-information assistant.

## What's included

- Public website sections: Home, About, Academics, Admissions, Enquiry Form, Activities, Gallery, School Assistant and Contact.
- Mobile navigation and responsive layout.
- Parent/guardian enquiry form saved to SQLite.
- Required acknowledgement of the draft privacy notice before an enquiry is accepted.
- `/admin` page protected by a server-side `ADMIN_KEY`.
- Paginated enquiry records and protected CSV export.
- General school-information assistant using the OpenAI Responses API. It cannot access the admissions database.
- Security headers, request limits, input validation, private/no-cache responses and parameterised SQL.
- Draft privacy notice at `/privacy.html`.

## Run locally

Requirements: Node.js 20 or later.

1. Extract this folder.
2. Copy `.env.example` to `.env`.
3. Set a long random `ADMIN_KEY`. Keep it private.
4. If the AI assistant is required, create a NEW OpenAI API key after revoking any key that was exposed, then set `OPENAI_API_KEY` in `.env` or in your hosting provider's secret settings. Never place it in `public/`, HTML, CSS, browser JavaScript or a public repository.
5. Check that the selected model is available to your API project. The default is `gpt-6-astra`; change `OPENAI_MODEL` only if you select another model available to your API project.
6. Run `npm install`.
7. Run `npm start`.
8. Open `http://localhost:3000`.

The public enquiry form works without an OpenAI key. Without a key, the AI assistant shows a message directing visitors to the school's telephone and email.

## Administration

Open `http://localhost:3000/admin` and enter the `ADMIN_KEY` value from the server environment. The browser does not save the key beyond the current tab session. The dashboard shows up to 50 enquiries per page. Use **Export CSV** to download the enquiries. CSV exports contain personal information and must be stored and shared securely.

`GET /api/admin/applications` returns an object with `applications`, `total`, `limit` and `offset` fields. `GET /api/admin/applications.csv` exports records. Both require the `x-admin-key` header and are rate limited.

## Database and backups

The default database file is `./data/admissions.sqlite`. Use a persistent disk or managed database in production. Do not use an ephemeral serverless filesystem for SQLite. Back up the database securely and test restoration. For a consistent SQLite backup while the server is running, use SQLite's online backup mechanism rather than copying only the main database file while WAL mode is active.

## School content and logo

- The uploaded official gold-and-navy school crest is installed at `public/uploads/school-logo.png`. It is cropped from the supplied banner; the banner contact details were not used to overwrite the website contact fields. Replace the image only if a transparent/original logo file is supplied.
- Replace gallery placeholders with school photographs only after confirming permission and any required parent/guardian consent.
- Confirm current grade availability, school registration wording, address, fees, office hours and admission requirements before launch. Historical fee figures have changed; the website directs visitors to contact the school for current fee information.
- Contact details currently shown: 063 099 7903 and mandlambathaschoolnpc@gmail.com. Confirm these are still correct before launch.
- Displayed grades and curriculum wording are enquiry information and must be checked against the school's current approved offering and registration status.

## Privacy and South African requirements

`public/privacy.html` is a draft notice, not a legal opinion or a certification of POPIA compliance. Before collecting real parent or learner information, the school must have its Information Officer review and approve the notice, confirm the responsible-party and Information Officer details, document the lawful basis and purposes, confirm hosting and service providers, define retention and deletion periods, confirm any cross-border processing disclosures, and implement procedures for access/correction requests and security incidents.

The general AI assistant sends the visitor's typed question to the OpenAI API to generate a response. It is not connected to the admissions database. The page warns visitors not to enter private learner details or sensitive information. Confirm the school's privacy assessment and terms before enabling this feature publicly.

## Production launch checklist

- Host on a Node.js 20+ service with persistent storage; do not use a static-only hosting service for this server project.
- Configure `mandlambathaschool.com` DNS with the chosen hosting provider and enable HTTPS.
- Set `ADMIN_KEY`, `DATABASE_FILE`, `NODE_ENV`, and, if using the assistant, `OPENAI_API_KEY` and `OPENAI_MODEL` as server-side environment variables.
- Revoke the API key that was pasted into chat; use a newly generated key. Never send secrets in chat or commit `.env` to source control.
- Upload the official school logo and replace gallery placeholders with approved images.
- Review and approve the privacy notice and all public school details.
- Configure backups, access management, monitoring and server-side email notifications if required. This starter does not send email notifications.
- Test form submission, administrator login, pagination, CSV export, privacy consent and the assistant before publishing.

This package has not been deployed, connected to domain DNS, or configured with the school's actual hosting account or API key.
