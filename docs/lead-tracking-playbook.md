---
name: Preme Lead Tracking & Optimization Playbook
description: Where all Preme Home Loans tracking data lives, how to query it, and what optimization actions to take — for any agent analyzing campaign performance
type: reference
---

# Preme Home Loans — Lead Tracking & Optimization Playbook

Use this when Nyalls asks "how are the ads doing", "why aren't people finishing applications", "what's happening with leads", or any question about campaign/funnel/email performance.

## Data Sources

### 1. GA4 (Google Analytics 4)
- **Property:** Preme Home Loans
- **Measurement ID:** G-9XZGX9RH1F
- **Access:** Google Analytics dashboard under admin@zyntrxmarketing.com
- **What it tracks:**
  - Traffic sources (Google Ads campaign, keyword, ad group, gclid)
  - Page views and engagement on premerealestate.com
  - Custom funnel events (see below)

### 2. Supabase `email_events` table
- **Project:** hriipovloelnqrlwtswy
- **Table:** `email_events`
- **Columns:** id, event_type, email_id, recipient_email, application_number, subject, link_clicked, event_timestamp, created_at
- **Indexes:** application_number, recipient_email
- **Events tracked:** email.sent, email.delivered, email.opened, email.clicked, email.bounced, email.complained
- **Source:** Resend webhooks → `premerealestate.com/api/webhooks/resend`

### 3. Supabase `loan_applications` table
- **Contains:** All application records with status, applicant info, guest tokens, timestamps, step progress

## Custom GA4 Funnel Events

| Event | Fires When | Key Parameters |
|-------|-----------|----------------|
| `application_start` | User picks guest or account mode | `form_mode` (guest/account) |
| `form_step_view` | User lands on a step | `step_number`, `step_name`, `form_mode` |
| `form_step_complete` | User clicks Next on a step | `step_number`, `step_name`, `form_mode` |
| `form_abandon` | User leaves mid-form (beforeunload) | `step_number`, `step_name`, `form_mode` |

### Step Map
1. contact_info → 2. property_info → 3. loan_details → 4. financial_info → 5. sponsor_info → 6. liquidity → 7. documents → 8. review_submit

## How to Analyze: Key Queries

### "Are people clicking ads but not applying?"
- GA4: Compare sessions from google/cpc source to `application_start` event count
- High traffic + low starts = landing page problem (copy, trust, speed, CTA visibility)

### "Where are people dropping off in the application?"
- GA4: Funnel report on `form_step_view` by step_number — find the biggest drop between consecutive steps
- Common drop points and fixes:
  - Step 1 (contact_info): Form looks too long → simplify, show progress bar
  - Step 4 (financial_info): Too personal too soon → add trust signals, explain why needed
  - Step 7 (documents): Upload friction → make optional or allow "upload later"

### "Did [lead name] engage with our emails?"
- Supabase query:
  ```sql
  SELECT event_type, subject, link_clicked, event_timestamp
  FROM email_events
  WHERE recipient_email = '[email]' OR application_number = '[app_number]'
  ORDER BY event_timestamp;
  ```
- Delivered but not opened = subject line or sender reputation issue
- Opened but not clicked = email body/CTA not compelling
- Clicked but no form progress = application UX friction

### "What's our overall funnel conversion rate?"
- Full funnel: Ad impression → Ad click → Site visit → Application start → Step completion → Submitted → Under review → Approved → Funded
- Pull from: Google Ads (impressions/clicks) → GA4 (visits/events) → Supabase loan_applications (status counts) → email_events (engagement)

### "Are our follow-up emails working?"
- Supabase:
  ```sql
  SELECT event_type, COUNT(*) FROM email_events
  WHERE event_timestamp > now() - interval '7 days'
  GROUP BY event_type;
  ```
- Benchmark: >95% delivered, >30% opened, >10% clicked
- If open rate < 20%: test subject lines, send time, sender name
- If click rate < 5%: test CTA copy, button placement, email design

## Optimization Actions by Scenario

### Low ad click-through rate
→ Test ad copy, headlines, extensions. Check keyword relevance. Review competitor ads.

### High clicks, low application starts
→ Landing page issue. Check load speed, mobile experience, CTA placement, trust signals (reviews, NMLS#, secure badges). Consider simplifying the hero section.

### High starts, drop-off at specific step
→ Simplify that step. Reduce required fields. Add helper text. Consider splitting into sub-steps. A/B test field order.

### Applications started but never submitted
→ Set up automated follow-up emails: "You're almost done — pick up where you left off" with magic link to their saved application. Trigger at 1hr, 24hr, 72hr after abandon.

### Emails not being opened
→ Test subject lines. Ensure emails aren't hitting spam (check Resend deliverability metrics). Try sending at different times. Personalize sender name.

### Emails opened but link not clicked
→ Improve CTA button (bigger, bolder, clearer value prop). Shorten email body. Add urgency.

### Lead clicked email but didn't progress in application
→ Application UX issue at the step they're on. Check if the step requires info they might not have handy. Consider a "save and continue later" prompt.

## Automated Follow-Up Triggers (TO BUILD)
- Application abandoned at step N → email at 1hr with magic link
- Application submitted but no doc upload after 48hr → reminder email
- Status changed to under_review → no action needed (already sends notification)
- No email engagement after 7 days → re-engagement email with different angle
