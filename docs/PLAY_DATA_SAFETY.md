# Google Play: Data safety answers

Fill these in at Play Console > App content > Data safety. They match the public privacy policy
(https://vrabtk.github.io/family-finance-site/privacy.html). Re-check them before every release that adds data,
an SDK, or a new service provider.

## Overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes (collects), No (does not share) |
| Is all of the user data collected by your app encrypted in transit? | Yes (HTTPS only) |
| Do you provide a way for users to request that their data is deleted? | Yes |
| Account creation methods | Username (email) and password |
| Delete account URL | https://vrabtk.github.io/family-finance-site/delete-account.html |
| Users can also delete in the app | Yes: More > Delete account |
| Privacy policy URL | https://vrabtk.github.io/family-finance-site/privacy.html |

## Data types collected

| Category | Data type | Collected | Shared | Optional? | Why (purposes) |
|---|---|---|---|---|---|
| Personal info | Name | Yes | No | Required | App functionality, Account management |
| Personal info | Email address | Yes | No | Required | App functionality, Account management |
| Personal info | Phone number | Yes | No | **Optional** (user adds it in My profile) | Account management |
| Financial info | Other financial info (the expenses, salaries, loans, investments, insurance, bank balances and notes the user types in) | Yes | No | Required to use the app | App functionality |
| Personal info | User IDs (internal account id) | Yes | No | Required | App functionality, Account management |

Everything else is **not collected**: location, contacts, photos and videos, audio, files, calendar, health,
web browsing, app interactions or analytics, crash logs, advertising or device identifiers, messages.

## Notes for the answers

- **Sharing = No.** The data is processed on our behalf by two service providers: Amazon Web Services (hosting, Mumbai)
  and Brevo (sends the "forgot password" code email to the user's own address). Google does not count transfers to a
  service provider that processes data on the developer's behalf as "sharing". People in the same workspace see each
  other's workspace data; that is the user's own choice inside the app, not sharing with a third party.
- **Server logs.** The server keeps short-lived technical request logs (IP address, time, requested address) for
  security and abuse control, rotated within days. They are not used for tracking or analytics. If Play's form asks,
  this is processed ephemerally and is not "collected" for the listed purposes.
- **Data is encrypted in transit** (HTTPS). Passwords are stored only as one-way hashes. The mobile session is kept
  in the device's secure storage.
- **Deletion.** Deleting the account removes the personal data from the live database immediately. Nightly backups
  expire within 14 days. A keyed one-way hash of the email address is kept only to stop the same address registering
  again; it cannot be turned back into the address (stated in the privacy policy).
- **Families / children.** Not directed at children under 13. Target audience: adults.
- **Ads.** No ads. **Financial features declaration:** the app only tracks the user's own entries; it does not
  move money, lend, or give investment advice. Choose "My app doesn't provide any financial features" if that
  option is offered, otherwise declare "personal finance management / tracking".

## When to update

Any of these means the answers, the privacy policy and the delete-account page must change **before** the release:
a new SDK (analytics, crash reporting, ads), a new data type (location, photos, push tokens), a new email or
hosting provider, a change to backup retention, or a change to what "delete account" removes.
