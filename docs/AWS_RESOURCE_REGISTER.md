# AWS resource register

No passwords, keys, account IDs or connection strings are kept here.

## Account

| Item | Value |
| --- | --- |
| Account plan | **Free plan** (checked 13 Nov 2026) |
| Credits remaining on 13 Nov 2026 | **US$137** |
| Plan / credit expiry | **178 days left** on 13 Nov 2026, so about **10 May 2027** |
| Root MFA on? | **Yes** |
| Budget alert created? | Yes / No (fill in: name ________) |
| AWS project | Free plan project "Lift Off Soon", fixed to Region **ap-southeast-2 (Sydney)** |
| Who else can see these resources | Project members: the owner (me) and my SAM10 partner, added through the Team page for SAM10. ShopSmart is my individual work; the partner did not change these resources. |
| Other resources in the same project | `libralink-server` (SAM10 project). **Not part of ShopSmart.** Left untouched. |
| Evidence | `release-evidence/AWS-00-account-plan-credits.png` (account ID and email covered) |

## Resources created for ShopSmart

All tagged `Owner=Lee`, `Purpose=PDC50 ShopSmart demo`, `RemoveBy=2026-11-30` (instance and volume).

| Service | Name / ID | Region | Owner | Purpose | Created | Planned removal | Removed (date) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EC2 instance | `shopsmart-demo` (`i-0245833c019d259a1`), t3.micro, Ubuntu 24.04 | ap-southeast-2 | Lee, P. E. C. | Runs Caddy, Express API, PostgreSQL 16 | 13 Nov 2026 | after grading, by 30 Nov 2026 | ____ |
| EBS volume | root volume of `shopsmart-demo`, 20 GiB gp3 | ap-southeast-2 | Lee, P. E. C. | Disk for OS, code and database | 13 Nov 2026 | deleted with the instance | ____ |
| Public IPv4 address | `13.238.143.254`, auto-assigned (not an Elastic IP) | ap-southeast-2 | Lee, P. E. C. | Site address `13-238-143-254.sslip.io` | 13 Nov 2026 | released with the instance | ____ |
| Security group | `shopsmart-web-sg` (`sg-070ef97ceb96a2909`) | ap-southeast-2 | Lee, P. E. C. | 443/80 from anywhere, 22 from my IP only | 13 Nov 2026 | after the instance | ____ |
| Key pair | `shopsmart-key` (RSA, .pem kept outside the project) | ap-southeast-2 | Lee, P. E. C. | SSH to the instance | 13 Nov 2026 | after the instance | ____ |
| Gemini API key (outside AWS) | server key in `/etc/shopsmart/api.env` | Google | Lee, P. E. C. | Optional AI drafts | 13 Nov 2026 | delete after grading | ____ |

## Expected duration and cost

| | |
| --- | --- |
| Demo window | 13 Nov 2026 until grading, at the latest 30 Nov 2026 |
| Why it matters | The instance, its disk and its public IPv4 address use credits every hour while they exist, even when nobody visits. |
| Rough cost | About US$0.50 a day for t3.micro + 20 GiB gp3 + one public IPv4 (estimate; check Billing). About US$9 at most for the whole window, paid from credits. |
| Removal plan | `DEPLOY_AWS.md` Step 12. Check Billing again one day after removal. |
