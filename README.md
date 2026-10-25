# Heading South

New website for Heading South, a tribute to Zach Bryan.

## Original materials

The repository initially contained only `HeadingSouth_Background.jpg` (3888 × 2592), a sunset photograph supplied by the client. No site code, build tooling, or hosting configuration existed.

The client's immediate request is a photo-backed placeholder:

> Heading South: A Tribute to Zach Bryan  
> COMING IN 2027

## First release

A responsive, full-screen sunset photograph with warm ivory lettering, a bold typographic band name, and restrained concert-poster styling. The user approved the Instagram link and February 20, 2027 Long Beach debut announcement, with no booking contact. Built in plain HTML and CSS, without dependencies or external fonts.

Site files are in `public/`. Run `node scripts/serve.mjs` from this repository and open http://127.0.0.1:4173 for local preview. Stop with Ctrl+C.

The image source and public-domain statement are recorded in [docs/IMAGE-SOURCE.md](docs/IMAGE-SOURCE.md). The original file is retained; the served derivative is 1920 × 1280.

Upcoming shows, performance videos, biography, photos, and booking details can follow when approved content is available. Do not create empty sections or fictional content to fill the page.

## Publication

Production domain: `HeadingSouthTribute.com`. DNS and production launch require explicit user approval. A review deployment must remain separate.

Cloudflare Pages settings for this repository:

- Project name: `headingsouthtribute`
- Production branch: `main`
- Framework preset: None
- Build command: `exit 0`
- Build output directory: `public`
- Root directory: leave blank (repository root)
- Environment variables: none

Use the `pages.dev` address for review. Cloudflare's "production branch" means its default deployment; it does not connect the client's domain. No custom-domain configuration is included. Search indexing is disabled during review through robots.txt and a robots meta tag; these do not restrict access.

## Verification

The page, stylesheet, image, favicon, and robots.txt returned HTTP 200 locally. `git diff --check` passed. Browser automation access to Brave was denied, so desktop and mobile visual verification remains outstanding. Responsive breakpoints, fluid typography, visible keyboard focus, and reduced-motion handling are implemented.

See [AGENTS.md](AGENTS.md) for project rules.
