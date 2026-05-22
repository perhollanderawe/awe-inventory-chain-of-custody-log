# Awe Inspired — SKU Catalog Request Tool

Internal Ops handoff tool. Auto-rebuilt twice daily from live Shopify (active PDPs only) + Cin7 (Assembly BOMs).

Deployed to https://polite-otter-a33a10.netlify.app via this repo (push → Netlify auto-deploys).

## Files
- `index.html` — single-page tool. Self-contained: catalog + BOM data embedded.

## How rebuild works
Each rebuild (8 AM / 4 PM Pacific) runs a Claude scheduled task that:
1. Pulls active products from Shopify per product-type collection
2. Fetches Cin7 BOMs for each catalog SKU
3. Generates a fresh `index.html` with new data + version bump
4. Commits and pushes to this repo
5. Netlify detects the push and redeploys

Rollback: `git revert <commit>` then push, or restore an earlier version from Per's `~/Downloads/SKU_Artifact_vN.html`.
