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
