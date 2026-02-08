# ADR-0001: Email CSS Isolation via Shadow DOM

> **Status**: Accepted
> **Date**: 2026-02-08
> **Feature**: FEATURE-00008 (AC-6)
> **Deciders**: System Architect

---

## Context

FlowState renders email HTML content using `dangerouslySetInnerHTML` after sanitization with DOMPurify. The current DOMPurify configuration includes `ADD_TAGS: ['style']`, which allows email `<style>` tags to pass through sanitization and render in the main document.

Because the email content is rendered as a direct child of a React component in the main DOM tree, any CSS rules in the email's `<style>` tags apply globally. This means email styles can:

- Override FlowState's Tailwind utility classes
- Break layout of surrounding components
- Change typography, colors, or spacing application-wide
- Be exploited by a malicious sender to deface the UI

This is a security and UX integrity issue.

---

## Decision

Render email HTML content inside a **Shadow DOM** attached to a container element within the `ThreadMessage` component.

### Implementation

1. Create an `EmailContent` component that:
   - Renders an empty `<div>` as a mount point
   - Attaches a Shadow DOM (`mode: 'open'`) via a `useRef` + `useEffect`
   - Injects the sanitized HTML into the shadow root's `innerHTML`
   - Injects a minimal base stylesheet into the shadow root for typography and link styling

2. DOMPurify configuration changes:
   - Keep `ADD_TAGS: ['style']` — styles are safe inside Shadow DOM since they cannot escape the shadow boundary
   - Keep `ADD_ATTR: ['target']` for links
   - Continue using `USE_PROFILES: { html: true }`

3. The `EmailContent` component replaces the current `dangerouslySetInnerHTML` div in `ThreadMessage.tsx`.

### Shadow DOM base styles

The shadow root needs a minimal stylesheet injected to provide readable defaults (since Tailwind's base styles and `prose` classes won't penetrate the shadow boundary):

```css
:host {
  display: block;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: inherit;
  word-break: break-word;
}
a { color: #6366f1; }
img { max-width: 100%; height: auto; }
blockquote {
  border-left: 3px solid #e2e8f0;
  padding-left: 12px;
  margin-left: 0;
  color: #64748b;
}
```

Dark mode is handled by setting `color: inherit` on `:host`, which inherits from the parent component's text color.

---

## Alternatives Considered

### Option A: `<iframe srcdoc>`

- **Pros**: Complete isolation (separate document context), well-understood security model.
- **Cons**: iframes create a separate browsing context with its own scroll, which makes height calculation complex. Dynamic resizing requires `postMessage` or `ResizeObserver` on the iframe's content document. Iframes are also heavier on memory and slower to render.
- **Rejected because**: The auto-height problem creates UX jank (emails either clip or have double scrollbars). The implementation complexity is higher for marginal isolation benefit over Shadow DOM.

### Option B: Strip all `<style>` tags (remove from `ADD_TAGS`)

- **Pros**: Simplest fix — one line change.
- **Cons**: Many emails rely on `<style>` tags for layout (newsletter grids, responsive design, themed formatting). Stripping styles makes most HTML emails look broken — unstyled tables, missing colors, collapsed layouts.
- **Rejected because**: It degrades email rendering quality to the point where users would prefer to open Gmail directly, undermining the product's value proposition.

### Option C: CSS prefixing / scoping via PostCSS

- **Pros**: No DOM API changes needed.
- **Cons**: Requires parsing and rewriting CSS at runtime, which is fragile (media queries, pseudo-elements, `@font-face`). Edge cases are numerous. No mature library exists for client-side CSS scoping.
- **Rejected because**: Runtime CSS rewriting is fragile and slow.

---

## Consequences

### Positive
- Email styles cannot escape the shadow boundary — FlowState's UI is protected
- Email `<style>` tags continue to work, preserving HTML email formatting
- No iframes, no height calculation issues, no double scrollbars
- Minimal runtime cost — Shadow DOM is a native browser API

### Negative
- React does not natively render into Shadow DOM — the component must use imperative DOM manipulation (`useRef` + `useEffect` with `innerHTML`)
- The `email-content` prose class currently on the container div won't apply inside Shadow DOM — a base stylesheet must be injected manually
- Event delegation from React won't reach into the shadow tree — link clicks inside emails need explicit handling if we want to intercept them (e.g., to open in new tab)
- Testing requires accessing the shadow root, which some testing utilities don't support out of the box

### Migration
- Only `ThreadMessage.tsx` renders email HTML today (confirmed via codebase grep)
- The change is isolated to creating a new `EmailContent` component and swapping it in `ThreadMessage.tsx`
- No other components or stores are affected

---

## References

- [FEATURE-00008 AC-6](../../product/features/feature-00008.md)
- [Architecture Alignment Review — Issue 6.2](../architecture-alignment-review.md)
- [MDN: Using Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
