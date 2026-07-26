# Parent WhatsApp production setup

Parent WhatsApp runs entirely through the existing Admin Vercel deployment. It does not use Firebase Functions and does not change the Telegram cron or Telegram routes.

## Vercel environment

Configure these as encrypted server variables for Production (and Preview only when explicitly testing):

- `PARENT_WHATSAPP_BASE_URL=https://admin.ledgrclasses.com`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_WABA_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_GRAPH_API_VERSION` (for example, the currently supported Meta Graph version)
- `QSTASH_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`

Never prefix these variables with `VITE_`. Tokens, PDFs, and rendered message bodies are not written to Firestore.

## Meta Business setup

Register the new, unused Ledgr sender in Ledgr’s Meta Business Portfolio, add payment details, and point the WhatsApp webhook to:

`https://admin.ledgrclasses.com/api/parent-whatsapp-webhook`

Use `WHATSAPP_WEBHOOK_VERIFY_TOKEN` as the verification token and subscribe the app to the WhatsApp `messages` field. The webhook verifies every POST with `X-Hub-Signature-256`.

Create and approve these templates with Meta language code `en`. The variable order must match exactly:

### `ledgr_parent_daily_update_en_v1`

- Document header
- Body parameters: parent name, combined child names, section, institute, date, concise subject/topic summary

Suggested body:

`Hello {{1}}, here is today’s Ledgr class update for {{2}} in {{3}} at {{4}} on {{5}}. {{6}}`

### `ledgr_parent_no_update_en_v1`

- No header
- Body parameters: parent name, combined child names, section, institute, date

Suggested body:

`Hello {{1}}, no classroom update is available yet for {{2}} in {{3}} at {{4}} on {{5}}.`

### `ledgr_parent_corrected_update_en_v1`

- Document header
- Body parameters: parent name, combined child names, section, institute, date, concise subject/topic summary

Suggested body:

`Updated: Hello {{1}}, the Ledgr class update for {{2}} in {{3}} at {{4}} on {{5}} has changed. {{6}}`

## QStash

The Admin Messenger creates or updates one schedule named `ledgr-parent-whatsapp-daily`. Its cron contains `CRON_TZ=Asia/Kolkata` and the manager-selected full-clock time. QStash signs the coordinator and worker calls; unsigned or replayed work cannot send.

The existing Vercel Telegram cron at `/api/run-ledgr-telegram-schedule` remains unchanged.

## Go-live checklist

1. Deploy the Vercel environment variables.
2. Verify the Meta number and all three templates show green in Admin → Messenger → Parent WhatsApp.
3. Save the global schedule as a manager.
4. Save one pilot section without enabling it.
5. Add a consented test parent and send a test message.
6. Verify webhook delivery changes from accepted to sent/delivered/read.
7. Test `JOIN <code>`, approval, `STOP`, and `START`.
8. Preview the live section report and verify subject and teacher attribution.
9. Enable only the pilot section, then inspect the first scheduled delivery before expanding.

Firestore client rules deny every Parent WhatsApp collection, including managers. The Admin UI must use the authenticated Vercel API. Generated records use a 90-day `expiresAt`; the daily coordinator also performs bounded cleanup.
