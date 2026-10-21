# Workflows

Import in this order (n8n → Workflows → Create → ⋯ → Import from File). After each import, connect credentials on any node with a warning and fill in the settings listed here.

| File | Workflow | Runs | Fill in |
|---|---|---|---|
| `e0_error_alerts.json` | Error alerts | When any workflow fails | "Send an Email": your alert address. SMTP credential. |
| `L0_core.json` | Core toolbox: validate, score, HubSpot upsert/update, log | Called by the others | "Sheets: append row": `PASTE_YOUR_SHEET_ID`. HubSpot and Google Sheets credentials. |
| `L1_intake.json` | Intake: form and webhook → score → HubSpot → instant reply → AI note → hot alert | Every submission | "Intake: settings & normalize": L0 ID, emails, portal ID. "Events: seen before?": sheet ID. SMTP, Groq (optional). |
| `L2_followups.json` | Follow-ups on day 1, 3 and 7; closes after the third | Hourly | "Settings": L0 ID, emails. HubSpot, SMTP. Keep `TIME_TRAVEL_HOURS: 0` outside testing. |
| `L3_reply_detector.json` | Spots lead replies, stops follow-ups, alerts the team | New email (IMAP) | "Settings & parse": L0 ID, emails, portal ID. IMAP, HubSpot, SMTP. |
| `L4_digest_board.json` | Daily digest at 8 am, and the live board at `/webhook/halden-board` | Daily and on page load | "Queries": emails, portal ID. HubSpot, SMTP. |
| `L5_stress_test.json` | 500 generated leads through the real rules and HubSpot; AI mocked; no lead emails | Manual | "Load 500 test leads": L0 ID, emails. Three Sheets nodes: sheet ID. |
| `L5b_cleanup_test_contacts.json` | Deletes the stress test's HubSpot contacts | Manual, after L5 | "TestReport: read": sheet ID. HubSpot. |

Where to find the values:
- **L0 ID:** open L0; it is the last part of the browser URL (`/workflow/<ID>`). Copy it exactly.
- **Sheet ID:** the long string in your sheet's URL between `/d/` and `/edit`.
- **Portal ID:** the number in any HubSpot URL (`app.hubspot.com/contacts/<number>/…`). Optional; it makes names clickable in alerts and on the board.

Then set e0 as the error workflow in each workflow's settings, and publish L0 to L4. Leave L5 and L5b unpublished; run them by hand.

## How a lead moves

```
Form / webhook ─► L1 ─► L0 process (clean, validate, score)
                   │      ├─ rejected ─► Sheet: Rejects
                   │      └─ accepted
                   ├─► repeat guard (Sheet: Events)
                   ├─► L0 crm_upsert ─► HubSpot contact
                   ├─► instant reply email (new contacts with email)
                   ├─► AI note (optional, ±10 max) ─► L0 re-score ─► HubSpot
                   └─► hot lead? ─► team alert
L2 (hourly)  ─► due follow-ups ─► email #1 / #2 / #3 ─► closed
L3 (inbox)   ─► lead replied ─► HubSpot "replied" (follow-ups stop) ─► team alert
L4 (8 am / page) ─► HubSpot searches ─► digest email / board page
```
