# Profile Card Compact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the profile page start directly with a compact “八月资料卡” module instead of a large “教练档案” hero.

**Architecture:** Keep the existing profile data flow unchanged. Only adjust the profile WXML structure and WXSS presentation so the first card combines the title, profile tags, metadata, and a small coach visual.

**Tech Stack:** WeChat Mini Program WXML/WXSS, existing profile page JS data fields, existing coach PNG assets.

---

### Task 1: Rebuild Profile Header Module

**Files:**
- Modify: `miniprogram/pages/profile/index.wxml`
- Modify: `miniprogram/pages/profile/index.wxss`

- [ ] **Step 1: Replace the separate hero and profile card markup**

Use one first module with title `{{user.nickname}}资料卡`, subtitle `霸气按目标盯进度`, tags, metadata, and `/assets/coach/coach-whistle-clipboard.png`.

- [ ] **Step 2: Replace profile header styles**

Remove the tall hero rules and add compact first-card rules. Keep the warm background, white card, orange chips, and dark headline.

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: all existing Jest tests pass.

- [ ] **Step 4: Visual check**

Open `pages/profile/index` in WeChat DevTools and confirm the first visible module is `八月资料卡`, with the heat-plan card moved upward and no obvious text overflow.
