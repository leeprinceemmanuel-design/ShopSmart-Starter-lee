# AWS resource register

Fill this in **while** you create each resource. No passwords, keys, account IDs or connection strings here.

## Account

| Item | Value |
| --- | --- |
| Account plan (Free or Paid) | ________ |
| Credits remaining on __/__/2026 | US$ ________ |
| Plan / credit expiry date | ________ |
| Root MFA on? | Yes / No |
| Budget alert created? | Yes / No (name: ________) |
| Evidence | `release-evidence/AWS-00-account-plan-credits.png` (account ID and email blurred) |

## Resources

| Service | Name | Region | Owner | Purpose | Created | Planned removal | Removed (date) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EC2 instance | `shopsmart-demo` | ap-southeast-1 | Lee, P. E. C. | Runs Caddy, Express API, PostgreSQL | ____ | after grading: ____ | ____ |
| EBS volume (root, 20 GiB gp3) | attached to `shopsmart-demo` | ap-southeast-1 | Lee, P. E. C. | Disk for OS, code and database | ____ | deleted with the instance | ____ |
| Public IPv4 address | auto-assigned to `shopsmart-demo` | ap-southeast-1 | Lee, P. E. C. | Public address for `<SITE_HOST>` | ____ | released with the instance | ____ |
| Security group | `shopsmart-web-sg` | ap-southeast-1 | Lee, P. E. C. | 443/80 public, 22 my IP only | ____ | after the instance | ____ |
| Key pair | `shopsmart-key` | ap-southeast-1 | Lee, P. E. C. | SSH access to the instance | ____ | after the instance | ____ |
| Budget | ________ | global | Lee, P. E. C. | Email alert on any spend | ____ | keep or delete after grading | ____ |
| (optional) Gemini API key | ShopSmart staging key | outside AWS (Google) | Lee, P. E. C. | Live AI drafts | ____ | after grading | ____ |

## Expected duration

| | |
| --- | --- |
| Demo window | from ____ to ____ |
| Why it matters | The instance, its disk and its public IPv4 address use credits every hour while they exist, even when nobody visits. |
| Removal plan | `DEPLOY_AWS.md` Step 12, on ____. Re-check Billing one day later. |
