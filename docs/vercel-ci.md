# Vercel CI

The `Vercel deployment` job in `.github/workflows/deploy.yml` deploys through
the Vercel CLI only after the production build, accessibility, authenticated
accessibility, and native transaction checks succeed. Pull requests from this
repository deploy to Vercel Preview; pushes and manual runs on `main` deploy
to Vercel Production. Fork pull requests do not receive Vercel credentials or
deployments.

## GitHub setup

Create two GitHub Actions environments:

- `vercel-preview`
- `vercel-production`

Add these environment secrets to **both** environments:

- `VERCEL_TOKEN`: a Vercel token scoped to the `out-class` project.
- `VERCEL_ORG_ID`: the Vercel team ID.
- `VERCEL_PROJECT_ID`: the Vercel project ID.

Use the same project and team IDs for both environments. Restrict
`vercel-production` to the `main` branch and add required reviewers if
production releases need approval. The production environment must receive the
project's Production environment variables through `vercel pull`; Preview
deployments use its Preview variables.
If internal pull-request authors should not access Preview environment
variables, require reviewers on `vercel-preview` too because the preview build
executes the pull-request code.

The local `.vercel/project.json` contains the IDs for this linked project but
is intentionally ignored by Git. Do not commit it or any Vercel token.

## Vercel project setup

The workflow owns deployments. Disable automatic Git deployments for this
project in Vercel's Git settings before enabling the workflow, otherwise a
push or pull request can create a second deployment through Vercel's native
Git integration. Keep the Git connection itself if it is needed for repository
metadata or comments; disable its automatic deployment behavior.

The CLI is pinned in the workflow. It builds using the selected Vercel
environment and deploys the prebuilt output, so production database checks
continue to run with the Production environment variables before promotion.
