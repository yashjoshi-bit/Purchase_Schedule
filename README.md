### Purchase Schedule app

Purchase Receipt Schedule for ERPNext Purchase Orders.

> **App name:** `purchase_schedule`
> **Repository:** `Purchase-Order-Schedule`
>
> The GitHub repository name is different from the app name. Always use the app
> name `purchase_schedule` in bench commands, and the app folder is
> `apps/purchase_schedule`.

### Installation

Requires Frappe v16 and ERPNext v16 installed on the site.

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
# 1. go to your bench folder
cd ~/frappe-bench-v16

# 2. download the app into the bench (pass the app name before the URL)
bench get-app purchase_schedule https://github.com/yashjoshi-bit/Purchase-Order-Schedule.git --branch main

# 3. install it on your site
bench --site your-site-name install-app purchase_schedule
bench --site your-site-name migrate
```

> **Important:** run `bench get-app` only once per bench. If `apps/purchase_schedule`
> already exists, do not run `get-app` again; use the **Updating** steps below.
> Running `get-app` again (especially without the `purchase_schedule` name) clones a
> duplicate `apps/Purchase-Order-Schedule` folder and fails with
> `OSError: [Errno 39] Directory not empty`. If that happens, delete the duplicate:
> `rm -rf apps/Purchase-Order-Schedule`.

Replace `your-site-name` with your site, e.g. `erpnext-v16.local`.

### Updating

```bash
cd ~/frappe-bench-v16
bench update --pull --apps purchase_schedule   # or: cd apps/purchase_schedule && git pull
bench --site your-site-name migrate
bench --site your-site-name clear-cache
```

### Usage

1. Open a saved (draft) or submitted Purchase Order and click the edit icon on an item row.
2. Click **Add Schedule**, set First Required By Date, Frequency and No of Receipts, then **Get Purchase Receipt Schedule**.
3. Adjust rows if needed and click **Add Schedule**.
4. View schedules on the Purchase Order's **Connections** tab (Schedule → Purchase Receipt Schedule) or at `/app/purchase-receipt-schedule`.

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/purchase_schedule
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

mit
