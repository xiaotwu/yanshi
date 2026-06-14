<script setup lang="ts">
import { withBase } from "vitepress";

const path = (value: string) => withBase(value);
</script>

<template>
  <main class="yanshi-landing">
    <section class="yanshi-hero" aria-labelledby="yanshi-home-title">
      <div class="yanshi-hero-copy">
        <p class="yanshi-hero-kicker">Yanshi · 偃师</p>
        <h1 id="yanshi-home-title">A desktop AI agent workspace where real tools and animated workers meet.</h1>
        <p class="yanshi-hero-lede">
          Yanshi brings project-scoped chats, a real runtime, tool execution, and the Yanshi Atelier
          into one calm macOS app.
        </p>
        <div class="yanshi-hero-actions" aria-label="Primary documentation actions">
          <a class="yanshi-button primary" :href="path('/getting-started/introduction')">Get Started</a>
          <a class="yanshi-button secondary" :href="path('/getting-started/installation')">Install on macOS</a>
          <a class="yanshi-button secondary" :href="path('/concepts/runtime')">Read the Architecture</a>
        </div>
        <div class="yanshi-status-strip" aria-label="Current release status">
          <span class="status-pill available">Available now</span>
          <span class="status-pill foundation">Runtime foundation implemented</span>
          <span class="status-pill setup">Setup required for external services</span>
        </div>
      </div>

      <div class="yanshi-hero-visual" aria-label="Yanshi desktop shell and Atelier preview">
        <div class="desktop-mock">
          <div class="mock-titlebar">
            <span class="traffic red"></span>
            <span class="traffic yellow"></span>
            <span class="traffic green"></span>
            <span class="mock-search">Search docs and chats</span>
          </div>
          <div class="mock-shell">
            <nav class="mock-sidebar" aria-hidden="true">
              <span class="mock-brand"><img :src="path('/yanshi-mark.svg')" alt="" /> Yanshi</span>
              <span class="mock-nav active"></span>
              <span class="mock-nav"></span>
              <span class="mock-nav short"></span>
              <span class="mock-nav"></span>
            </nav>
            <section class="mock-chat" aria-hidden="true">
              <span class="mock-label">New Chat</span>
              <div class="mock-bubble user"></div>
              <div class="mock-bubble agent">
                <span></span>
                <span></span>
                <span class="short"></span>
              </div>
              <div class="mock-runtime-card">
                <span class="runtime-dot"></span>
                <span>Action → Observation</span>
                <strong>SQLite persisted</strong>
              </div>
            </section>
            <aside class="mock-atelier">
              <span class="atelier-title">Yanshi Atelier</span>
              <div class="atelier-stage">
                <img class="atelier-worker worker-a" :src="path('/screens/puppet-manager.svg')" alt="" />
                <img class="atelier-worker worker-b" :src="path('/screens/puppet-browser.svg')" alt="" />
                <img class="atelier-worker worker-c" :src="path('/screens/puppet-reviewer.svg')" alt="" />
                <span class="desk desk-a"></span>
                <span class="desk desk-b"></span>
              </div>
            </aside>
          </div>
        </div>
        <div class="atelier-preview">
          <span class="preview-dot"></span>
          <span>Workers reflect real runtime state</span>
        </div>
      </div>
    </section>

    <section class="docs-entry" aria-labelledby="docs-entry-title">
      <div>
        <p class="section-kicker">Documentation</p>
        <h2 id="docs-entry-title">Start with the product, then go deeper.</h2>
      </div>
      <div class="docs-card-grid">
        <a class="docs-card" :href="path('/getting-started/quickstart')">
          <span class="card-index">01</span>
          <strong>Quickstart</strong>
          <span>Install dependencies, build the app, and launch the local final candidate.</span>
        </a>
        <a class="docs-card" :href="path('/concepts/runtime')">
          <span class="card-index">02</span>
          <strong>Yanshi Runtime</strong>
          <span>LangGraph orchestration, actions, observations, approvals, tools, and persistence.</span>
        </a>
        <a class="docs-card" :href="path('/concepts/atelier')">
          <span class="card-index">03</span>
          <strong>Yanshi Atelier</strong>
          <span>How the worker world mirrors real agent activity without fake progress.</span>
        </a>
        <a class="docs-card" :href="path('/integrations/overview')">
          <span class="card-index">04</span>
          <strong>AI Integrations</strong>
          <span>Providers, ACP, MCP, skills, secrets, and current implementation status.</span>
        </a>
        <a class="docs-card" :href="path('/desktop/permissions')">
          <span class="card-index">05</span>
          <strong>macOS Permissions</strong>
          <span>Computer Use, Browser Chromium, privacy grants, and setup-required states.</span>
        </a>
        <a class="docs-card" :href="path('/release/limitations')">
          <span class="card-index">06</span>
          <strong>Known Limitations</strong>
          <span>What is available now, what is foundational, and what is externally blocked.</span>
        </a>
      </div>
    </section>

    <section class="public-status" aria-labelledby="status-title">
      <div>
        <p class="section-kicker">Public status</p>
        <h2 id="status-title">Clear about what is real today.</h2>
        <p>
          Yanshi is a v0.1 Local Final Candidate: real end-to-end on this machine, not yet a public
          notarized release. The docs use the same status language as the product.
        </p>
      </div>
      <div class="status-table">
        <div><span>Desktop app + bundled runtime</span><span class="status-pill available">Available now</span></div>
        <div><span>Yanshi Runtime / approvals / persistence</span><span class="status-pill available">Available now</span></div>
        <div><span>OpenAI-compatible providers</span><span class="status-pill available">Available now</span></div>
        <div><span>ACP external agents</span><span class="status-pill foundation">Foundation implemented</span></div>
        <div><span>MCP servers</span><span class="status-pill foundation">Foundation implemented</span></div>
        <div><span>Browser tool Chromium</span><span class="status-pill setup">Setup required</span></div>
        <div><span>Native provider adapters</span><span class="status-pill planned">Planned</span></div>
        <div><span>Computer Use permissions</span><span class="status-pill blocked">Blocked until granted</span></div>
        <div><span>Signing and notarization</span><span class="status-pill blocked">External requirement</span></div>
      </div>
    </section>

    <section class="quickstart-band" aria-labelledby="quickstart-title">
      <div>
        <p class="section-kicker">Build locally</p>
        <h2 id="quickstart-title">From source to packaged macOS app.</h2>
      </div>
      <pre class="yanshi-code" tabindex="0"><code>pnpm install
pnpm build
pnpm desktop:release
uv run --project runtime/python pytest</code></pre>
      <p>
        Continue with the <a :href="path('/getting-started/quickstart')">Quickstart</a> or jump to
        <a :href="path('/release/build')">Build and Release</a> for packaging detail.
      </p>
    </section>
  </main>
</template>
