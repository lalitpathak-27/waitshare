# WaitShare starter — reward wallet preview

This update adds a **demo-only USD wallet and simulated withdrawal flow** to the existing WaitShare Flask website.

## What was added

- Dashboard balance shown in USD, with an illustrative INR estimate.
- A $10 minimum withdrawal threshold.
- Withdrawal request form and recent withdrawal history.
- SQLite `withdrawals` table and server-side balance checks.
- Demo withdrawal references and a clearly marked `SIMULATED_NOT_PAID` status.
- Existing sponsored-ad preview and browser extension files are retained.

## Important: this is not a real payout system

The existing project has a preview login and fictional demo credits, not verified user accounts or verified advertising revenue. The new withdrawal endpoint only simulates a withdrawal and deducts fictional demo credits. It does **not** collect bank/UPI details, contact a payment provider, or transfer money. The displayed ₹85 per $1 conversion is a fixed test value, not a live exchange rate.

Do not advertise demo balances as real earnings. Before any real-money launch, the project needs proper authentication, verified revenue accounting, user consent/privacy controls, fraud prevention, provider-approved business onboarding, tax/legal review, secure beneficiary onboarding, payout idempotency, signed webhook verification, and production database transactions. Do not reward ad clicks or manufacture ad impressions. Because the project owner is under 18, a parent/legal guardian and appropriately authorized business adult must handle any financial-provider onboarding and real-money operations.

## Run in VS Code

Use Python 3.10 or newer.

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Windows CMD:

```cmd
.venv\Scripts\activate.bat
```

Install and run:

```bash
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000 and choose **Explore with demo account**.

## Test the wallet preview

1. The demo account starts with a fictional $12.50 balance on a fresh database (an existing database retains its current demo balance).
2. Scroll to **Withdrawal Preview**.
3. Request a demo withdrawal of at least $10.
4. The amount is deducted from the demo balance and a `SIMULATED_NOT_PAID` record is shown.
5. No bank transfer occurs.

The existing **Add Demo Activity** button adds fictional test credits only.

## API endpoints

- `GET /api/dashboard` — demo wallet balance, activity, and withdrawal history.
- `POST /api/demo-event` — add fictional test credits.
- `POST /api/withdrawals` — record a simulated withdrawal; JSON body: `{"amount_usd": 10}`.
- `GET /health` — health check.

All endpoints are for local preview only. This starter's demo login is not authentication and must not be exposed as a public wallet/payment service.

## Browser extension

The existing `extension/` directory is unchanged. Load it using Edge `edge://extensions` → Developer mode → Load unpacked, and select the `extension` folder.
