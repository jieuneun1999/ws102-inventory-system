Run `npm i` to install the dependencies.

Run `npm run dev` to start the frontend development server.

## Supplier Backend Listener

The supplier inbox listener runs as a separate Node process:

```bash
npm run backend:start
```

Configure it in [backend/.env.example](backend/.env.example) or your local `.env` file with:

- `SUPPLIER_EMAILS=supplier1@example.com,supplier2@example.com` as an optional fallback if Supabase has no active supplier contacts yet
- `IMAP_USER` and `IMAP_PASS` for the mailbox that receives supplier requests
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for writing supplier requests into Supabase

Add or remove supplier inboxes from the Supplier dashboard. Those contacts are stored in Supabase and the backend listener reads that list on each poll.
If the Supabase contact list is empty, it falls back to `SUPPLIER_EMAILS`.

Each unread email from one of the active supplier contacts is parsed into a pending request and appears in the Supplier dashboard.
