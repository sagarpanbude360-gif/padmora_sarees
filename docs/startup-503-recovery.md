# Recovering from a startup 503

A hosting 503 does not identify its cause. Inspect the Node application startup log before changing settings.

The security update intentionally exits before listening when JWT_SECRET is missing, a known placeholder or shorter than 16 characters. A valid existing secret is preserved. New secrets should be cryptographically random and at least 32 characters.

1. Open the Hostinger Node application's environment settings for the failing deployment.
2. If the log identifies JWT_SECRET, set a strong value there (not in GitHub). Generate it privately with Node: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep an existing strong value. Changing it invalidates sessions and signed inquiry links.
3. Save and redeploy/restart the application. Ensure Supabase environment variables remain configured.
4. If startup still fails, inspect the first error and its stack trace, with secrets redacted. Database initialization errors are a different failure and require that evidence.
5. Verify home, products, customer login and admin login after recovery.

The OTP debug startup bug is fixed: false/0/off no longer count as enabled. Even a true debug flag cannot log login codes on a production/public HTTPS deployment; it generates a warning instead of stopping the entire store.

Run the isolated configuration checks with `node --test backend/tests/startup-config.test.js`. They do not contact Supabase, send email or modify data.

This patch does not supply hosting secrets, change database permissions or prove the live outage is resolved. Do not remove secret validation, restore a public fallback secret or generate a different production secret on every restart to bypass the failure.
