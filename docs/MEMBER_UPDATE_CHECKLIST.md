# Member update acceptance checklist — 2026.10.04.2

Use sandbox first. No live charges are required for routine verification.

| Check | Automated evidence | Device/user confirmation |
|---|---|---|
| Correct server fee and SUB50 discount; one charge identity | Payment regression suite passed | Test Square sandbox entry and signed contract |
| Optional email below tribute selection | Blank entry email accepted; malformed supplied email rejected; private records | Continue with blank email; check one field below tribute choices. Name/email remain required at contract signing |
| Video verification stays private to the requester | Upload signatures, ownership and reply visibility checks | Select original MP4/MOV/WebM, upload, preview, send and view as that Sub |
| Wrong photo choice produces clear instructions | JPEG and HEIC rejection | Select a thumbnail and then the original video |
| Contract amounts and Account control fit mobile | Scoped responsive CSS and accessible name | Check 320, 375, 390 px and enlarged text |
| Goddess profile/notes/gallery are private | Owner, target, CSRF and revision tests | Open two Subs; save separate notes; browse their own gallery |
| Emoji button, background and readable names | Existing UTF-8 and background checks | Change one conversation to Emoji pattern with colour; send native emoji |
| Pause and Unblock restore the same conversation | Existing message/upload pause and resume tests | Pause one Sub, confirm denial, then Unblock |
| Entry-paid and contract-paid activity appear in Notifications | Private payment feed redaction | Confirm each sandbox paid stage; optional browser permission |
| Online Sub names and approximate visitor tabs | Bounded heartbeat/count tests | Open/hide two tabs and allow 90 seconds for presence expiry |
| Chrome Incognito / Safari Private / Firefox Android Private | Storage-blocked draft, timeout fallback and cookie preflight tests | Fresh single-use code per browser; cookies enabled; do not close all private tabs |
| Cookie blocking does not consume code | Regression passed | Block cookies, observe guidance, restore cookies and retry same unused code |
| Upload retry preserves reservation and ownership | Direct-upload and quota tests | Interrupt an upload and retry the same selected file |

Browser alerts require opt-in and an open dashboard; background throttling and private-mode service-worker restrictions can affect delivery. Closing every private tab clears its session. Earlier paid applications may lack phone details; no historical records are fabricated or altered. If a checklist item fails, record the browser/version and visible message without sending credentials or card details.
