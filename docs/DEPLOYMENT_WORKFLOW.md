# EsiFit — Manual release workflow

## Why
EsiFit receives many small pushes and merges. To avoid Vercel Hobby
deployment/build quotas, **automatic Vercel Git deployments are disabled**
at the root `vercel.json` with `git.deploymentEnabled: false`.

This prevents automatic production **and preview** deployments on all branches.
It does **not** stop commits, PRs or GitHub Actions. GitHub CI continues running
its essential tests and production build on PRs and main.

Do **not** use `ignoreCommand` / Ignored Build Step for this purpose:
Vercel documents that ignored deployments can still count toward
deployment/build limits. Disabling Git deployments prevents their creation.

## Daily development
1. Push changes, open PRs, review and merge as often as needed.
2. Verify `EsiFit CI` is green on main.
3. Continue developing; the production URL deliberately remains on the last
   released commit. No background auto-deployment is attempted.
4. Do not assume a green CI run means the website has updated.

## One intentional production release
1. From `https://vercel.com/sanyzrns-projects/esi-fit` open **Deployments**.
2. Choose **Create Deployment** (possibly under the `...` menu).
3. Choose the **main** Git branch or paste the reviewed commit SHA.
   Do not use *Redeploy* on an older deployment: that can rebuild the older SHA.
4. Confirm the **Production** target and existing project settings.
5. Create the deployment once. Wait for status **READY** and verify the
   production URL points to that exact commit, then test in browser/mobile.
6. If it fails, the previous successfully published site stays available.

If the Vercel ChatGPT connection is authorized for the correct
`sanyzrns-projects` team, the same explicit release can be initiated by
the assistant when asked. Existing 403 team-authorization failures must
be resolved through the Vercel connection; they are separate from quotas.

## Re-enable automatic deployment (only with approval)
Change `git.deploymentEnabled` back to `true` (or remove the `git`
section) and intentionally release that change. Be aware that every
new branch push and merge may again create a Vercel deployment.

Docs:
- https://vercel.com/docs/project-configuration/git-configuration#gitdeploymentenabled
- https://vercel.com/docs/git#creating-a-deployment-from-a-git-reference
- https://vercel.com/docs/project-configuration/project-settings#ignored-build-step
