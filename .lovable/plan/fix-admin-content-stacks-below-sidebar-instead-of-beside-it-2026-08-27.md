# Fix: Admin content stacks below sidebar instead of beside it

## Cause
In `src/components/admin/AdminSidebar.tsx`, both sidebar `<aside>` elements have conflicting position classes:

- Line 113 (mobile sidebar): `fixed ... relative ...`
- Line 124 (desktop sidebar): `fixed ... relative ...`

`fixed` and `relative` both set the CSS `position` property. When `relative` wins the cascade, the sidebar stops being pinned to the left edge and becomes a normal in-flow block — so the whole menu renders at the top of the page and all admin content is pushed down below it, exactly what you're seeing.

## Fix
1. **AdminSidebar.tsx** — remove the stray `relative` class from both `<aside>` elements (keep `fixed`). The decorative gradient inside already uses `absolute inset-0`, and a fixed element establishes its own positioning context, so nothing else changes visually.
2. **AdminLayout.tsx** — verify `<main className="lg:ml-64 ...">` still correctly offsets content by the sidebar width (it does; no change expected).
3. Verify on desktop width that the sidebar is pinned left with content beside it, and on mobile (<1024px) that the hamburger + slide-in drawer still work.

## Note on smaller windows
Below 1024px screen width, the sidebar is intentionally hidden and replaced by a hamburger button (top-left). That is by design — if you were viewing in a narrow window, that also explains part of the behavior.

## Files touched
- `src/components/admin/AdminSidebar.tsx` (remove 2 conflicting classes)
