---
name: portfolio
description: "Use for any change to the uwaism.com site — content edits, new sections, new tools, styling, deploys, debugging."
---

# Context

- The site is static HTML/CSS/JS on GitHub Pages at uwaism.com. No build step, framework, or npm. Each page is one self-contained `.html` file.
- Read `CLAUDE.md` at the start of every task for the design tokens, file inventory, hosting, and DNS details.

# Verify Before Claiming

- This project has a history of work being "finished" but never actually committed. Never tell the user something is live without checking: run `git status`, confirm the commit landed, and, where it matters, fetch the live URL and grep for the change.
- GitHub Pages' CDN serves stale copies for a few minutes after a push. If the repo has the change but the live site doesn't, explain that it may be a cache delay rather than debugging a problem that isn't there. Suggest checking in a private window.

# House Rules

- Never introduce a framework, bundler, or dependency to solve something plain HTML handles.
- The hero animation on `index.html` is deliberately faint and masked away from the headline. Several passes went into toning it down. Don't make it more prominent unless the user explicitly asks.
- The FIRE calculator is educational, never advice. Never remove or weaken the disclaimer, add personalized recommendations, or name specific securities to buy. The user holds the CIRE certification and is pursuing the CFA; this matters.
- Don't delete or rename the `CNAME` file; it's what binds the domain.
- Keep everything working at phone width.

# Working Style

- The user isn't a developer. Explain what changed in plain language, not by walking through the diff line by line.
- When a step requires the user to click through a web dashboard (GitHub, Cloudflare, Porkbun), give exact menu paths, not approximations.