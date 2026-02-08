# Project Constitution — AI-First, Doc-Driven Delivery

## Core Principles
- Documents are the system memory
- Skills are deterministic transforms
- Authority is explicit
- Phase artifacts are derived

## Authority Levels

### AUTHORITATIVE
- product/prd.md
- product/features/*
- architecture/overview.md
- architecture/adrs/*

### CONSTRAINING
- design/ux-design-rules.md
- engineering/engineering-constraints.md
- engineering/repo-conventions.md
- engineering/test-strategy.md

### DERIVED
- phases/phase-XX/*

## Naming Conventions
- FEATURE-00001 → product/features/feature-00001.md
- PHASE-01 → phases/phase-01/
- ADR-0001 → architecture/adrs/adr-0001-*.md
- TASK-01 → phase-scoped

## Global Rules
- PRD is append-only
- Features are never deleted, only superseded
- A skill may only modify files it owns
- If a skill cannot proceed without guessing, it must STOP

## Canonical Workflow
Product Owner  
→ System Architect + Senior Designer  
→ Product Manager  
→ Task Planner  
→ Engineer  
→ QA  
→ Product Owner
