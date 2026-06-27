<script setup lang="ts">
import { withBase } from "vitepress";

const path = (value: string) => withBase(value);
</script>

<template>
  <main class="yanshi-landing">
    <section class="yanshi-hero" aria-labelledby="yanshi-home-title">
      <div class="yanshi-hero-copy">
        <p class="yanshi-hero-kicker">Yanshi · 偃师</p>
        <h1 id="yanshi-home-title">A macOS-first AI agent workspace.</h1>
        <p class="yanshi-hero-lede">
          Yanshi brings chats, projects, real tools, approvals, files, and animated workers into
          one local desktop app.
        </p>
        <div class="yanshi-hero-actions" aria-label="Primary documentation actions">
          <a class="yanshi-button primary" :href="path('/getting-started/introduction')">Get Started</a>
          <a class="yanshi-button secondary" :href="path('/usage')">Usage</a>
          <a class="yanshi-button secondary" :href="path('/important-notes')">Important Notes</a>
        </div>
        <div class="yanshi-status-strip" aria-label="Current status">
          <span class="status-pill available">Local-first</span>
          <span class="status-pill foundation">Runtime sidecar</span>
          <span class="status-pill setup">Setup required for external services</span>
        </div>
      </div>

      <div class="yanshi-hero-visual" aria-label="Yanshi desktop shell and Atelier preview">
        <div class="desktop-mock">
          <div class="mock-titlebar">
            <span class="traffic red"></span>
            <span class="traffic yellow"></span>
            <span class="traffic green"></span>
            <span class="mock-search">Search chats and files</span>
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
                <span>Action -> Observation</span>
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
        <h2 id="docs-entry-title">A short guide to the project.</h2>
      </div>
      <div class="docs-card-grid">
        <a class="docs-card" :href="path('/getting-started/introduction')">
          <span class="card-index">01</span>
          <strong>Introduction</strong>
          <span>What Yanshi is and what it is for.</span>
        </a>
        <a class="docs-card" :href="path('/getting-started/installation')">
          <span class="card-index">02</span>
          <strong>Installation</strong>
          <span>Install dependencies and run the desktop app.</span>
        </a>
        <a class="docs-card" :href="path('/getting-started/quickstart')">
          <span class="card-index">03</span>
          <strong>Quickstart</strong>
          <span>Build, launch, configure a provider, and start a chat.</span>
        </a>
        <a class="docs-card" :href="path('/usage')">
          <span class="card-index">04</span>
          <strong>Usage</strong>
          <span>Chats, projects, tools, approvals, settings, and files.</span>
        </a>
        <a class="docs-card" :href="path('/important-notes')">
          <span class="card-index">05</span>
          <strong>Important Notes</strong>
          <span>Secrets, permissions, external setup, and release limits.</span>
        </a>
        <a class="docs-card" :href="path('/build-and-release')">
          <span class="card-index">06</span>
          <strong>Build</strong>
          <span>Local checks, packaging, and public release requirements.</span>
        </a>
      </div>
    </section>

    <section class="quickstart-band" aria-labelledby="quickstart-title">
      <div>
        <p class="section-kicker">Build locally</p>
        <h2 id="quickstart-title">From source to macOS app.</h2>
      </div>
      <pre class="yanshi-code" tabindex="0"><code>pnpm install
pnpm runtime:dev
pnpm desktop:dev</code></pre>
      <p>
        Use <a :href="path('/build-and-release')">Build and Release</a> for the full local package
        command and public release notes.
      </p>
    </section>
  </main>
</template>
