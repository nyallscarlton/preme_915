# 10DLC SMS Compliance — Audit & Fix

Audit and fix 10DLC SMS campaign compliance for Preme Home Loans. Use this skill when a 10DLC application gets rejected, when forms are updated, or when verifying compliance before submission.

## Context: What 10DLC Is

10DLC (10-Digit Long Code) is carrier registration required to send SMS from a business phone number. Carriers (T-Mobile, AT&T, Verizon) require:
- **Brand registration** — verified legal business entity
- **Campaign registration** — verified opt-in flow with crawlable proof

The campaign registration is what keeps getting rejected. Carriers send automated crawlers to verify the Call to Action (CTA) — they need to land on a public URL and see a visible, unchecked opt-in checkbox with SMS disclosure text.

## Rejection History (Preme Home Loans)

### Rejection 1-3 (March 2026): Opt-in information + CTA verification
**Root causes identified:**
1. `robots.txt` blocked `/apply` — carrier crawlers couldn't see the opt-in form
2. Consent text included "and its partners" — violates no third-party data sharing rule
3. Missing "Message frequency varies" in consent text
4. Checkbox was `required` — violates "consent is not a condition of purchase"
5. `/sms-consent` page described verbal consent model, not the actual checkbox flow

### Fix Applied (March 27, 2026):
- Removed `/apply` from robots.txt disallow list
- Updated all consent text across 3 forms (contact, guest-contact, review-submit)
- Made checkbox optional (not required to submit forms)
- Replaced `/sms-consent` page with crawler-friendly proof page showing the checkbox mockup

## The Approved Consent Text (Use This Exactly)

```
By checking this box, I provide my express written consent to receive text messages and phone calls (including via automated dialing systems and artificial intelligence) about my inquiry from Preme Home Loans at the phone number provided. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. I can revoke consent at any time by replying STOP or calling (470) 942-5787.
```

**Critical rules for this text:**
- NO "and its partners" or any third-party language
- MUST include "Message frequency varies"
- MUST include "Message and data rates may apply"
- MUST include "Consent is not a condition of purchase"
- MUST include opt-out method (STOP + phone number)
- MUST mention "automated dialing systems" and "artificial intelligence"

## Compliance Checklist (Run Before Every 10DLC Submission)

### 1. Robots.txt
```bash
curl -s https://premerealestate.com/robots.txt
```
Verify these paths are NOT in the disallow list:
- `/apply`
- `/contact`
- `/sms-consent`
- `/privacy`
- `/terms`

### 2. CTA Pages Are Crawlable
```bash
# All should return 200
curl -s -o /dev/null -w "%{http_code}" https://premerealestate.com/contact
curl -s -o /dev/null -w "%{http_code}" https://premerealestate.com/sms-consent
curl -s -o /dev/null -w "%{http_code}" https://premerealestate.com/apply
curl -s -o /dev/null -w "%{http_code}" https://premerealestate.com/privacy
curl -s -o /dev/null -w "%{http_code}" https://premerealestate.com/terms
```

### 3. Consent Text Verification
```bash
# Check that the exact approved text appears on each page
curl -s https://premerealestate.com/contact | grep -o "Message frequency varies" && echo "PASS" || echo "FAIL: contact page"
curl -s https://premerealestate.com/sms-consent | grep -o "Message frequency varies" && echo "PASS" || echo "FAIL: sms-consent page"
```

### 4. Checkbox Is NOT Required
Verify in the source code:
- `app/contact/page.tsx` — checkbox input must NOT have `required` attribute
- `components/application/guest-contact-form.tsx` — `isFormValid` must NOT include `tcpaConsent`
- `components/application/review-submit-form.tsx` — submit button disabled condition must NOT include `!tcpaConsent`

### 5. Checkbox Is Unchecked by Default
Verify in source code:
- `tcpa_consent: false` (contact page state)
- `tcpaConsent: false` or `tcpaConsent: initialData.tcpaConsent || false` (guest-contact)
- `const [tcpaConsent, setTcpaConsent] = useState(false)` (review-submit)

### 6. /sms-consent Proof Page
Visit https://premerealestate.com/sms-consent and verify:
- Shows the exact consent text
- Shows a visual mockup of the unchecked checkbox
- Links to /privacy and /terms
- Is publicly accessible (no auth required)

## Files That Contain SMS Consent Text

Update ALL of these when changing consent language:
1. `app/contact/page.tsx` — contact form checkbox
2. `components/application/guest-contact-form.tsx` — application first step checkbox
3. `components/application/review-submit-form.tsx` — application final step checkbox
4. `app/sms-consent/page.tsx` — public proof page
5. `app/privacy/page.tsx` — privacy policy TCPA section
6. `app/terms/page.tsx` — terms of service SMS section

## 10DLC Submission Details

**Brand:**
- Legal Name: Preme Home Loans LLC (exact from CP-575, mixed case)
- EIN: 39-5092577
- Entity Type: LLC (register as STANDARD brand, NOT Sole Proprietor)
- Address: 300, Roswell, GA 30076
- Website: premerealestate.com
- Contact Email: loans@premerealestate.com

**Campaign:**
- Use Case: Mixed (marketing + conversational)
- CTA URL: https://premerealestate.com/sms-consent (primary) + https://premerealestate.com/contact (secondary)
- Phone Number: +14709425787 (Retell/Preme)
- Opt-in method: Web form with checkbox
- Opt-out: Reply STOP, call (470) 942-5787, email loans@premerealestate.com

## When to Run This Skill

- After any 10DLC rejection — audit, fix, verify, resubmit
- Before any 10DLC submission — run the full checklist
- After any form changes on premerealestate.com — verify consent text wasn't broken
- After any robots.txt or routing changes — verify crawlability
