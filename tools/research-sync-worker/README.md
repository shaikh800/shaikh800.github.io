# research-sync-worker

Lets a signed-in **member's** browser save their own profile, upload record,
or access request to `research_data.json` — without ever holding a GitHub
token itself. Only the admin's browser does that today (the token pasted
into Drive & Access); this Worker is the missing write path for everyone
else. See the comment at the top of `worker.js` for the full design.

## One-time setup

1. **Create a dedicated GitHub token** (don't reuse your admin browser token):
   GitHub → Settings → Developer settings → Personal access tokens →
   **Fine-grained tokens** → Generate new token.
   - Repository access: **Only select repositories** → `shaikh800.github.io`
   - Permissions: **Contents → Read and write**. Nothing else.
   - Copy the token — you'll paste it once in step 3 and never need the raw
     value again after that.

2. **Log in to Cloudflare** (one time per machine):
   ```
   npx wrangler login
   ```
   This opens a browser tab to approve access, then returns here.

3. **Deploy and set the two secrets**, from this folder:
   ```
   cd tools/research-sync-worker
   npx wrangler deploy
   npx wrangler secret put GITHUB_TOKEN     # paste the token from step 1
   npx wrangler secret put CLIENT_KEY       # paste: M-eYQsJn_Gsu5m-DYh3S2ZjjSWl_Hy-r
   ```
   `wrangler deploy` prints the Worker's URL, something like
   `https://research-sync-worker.<your-subdomain>.workers.dev`.

4. **Wire the URL into the site**: open `research.html`, find
   `SYNC_WORKER_URL` near the top of its `<script>` block, and replace the
   placeholder with the URL from step 3. Commit and push.

That's it — from then on, a member's "My Account" save, their own uploads,
and their access requests all reach `research_data.json` on their own,
with no need for you to be signed in anywhere for it to happen.

## Redeploying after a code change

```
cd tools/research-sync-worker
npx wrangler deploy
```

Secrets persist across redeploys — no need to set them again unless you're
rotating the token.

## Admin saves without a GitHub token (adminRead / adminWrite)

The same Worker also lets the **logged-in admin** save Civil resources, notices,
exams, 3D works and research data, so no GitHub token has to be pasted on any
device. The browser sends the admin session token it got from the Google Apps
Script login; the Worker checks it with the script (`adminVerify`) before
touching anything. It can only write `civil_data.json`, `modeling_data.json` and
`research_data.json`, and refuses a save that would delete more than one item of
a list at once.

After pulling this change, **redeploy once** (the secrets stay as they are):

```
cd tools/research-sync-worker
npx wrangler deploy
```

`wrangler.toml` now carries `GAS_URL` (the public admin-login script URL, the
same as `SITE_GAS_URL` in `assets/site-auth.js`). If you ever redeploy the Apps
Script under a new URL, update it in both places.

Until the Worker is redeployed, a device that still has a GitHub token saved
keeps working through the old path; a device without one shows
"the sync service needs a one-time update".
