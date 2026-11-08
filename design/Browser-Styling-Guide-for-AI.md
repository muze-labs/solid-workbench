# Browser Styling Guide for AI

Use these instructions when creating or modifying HTML and CSS for browser applications. The goal is simple, extensible, efficient styling with replaceable components and clear boundaries.

These rules combine Atomic Design's composition model, ITCSS's ordering model, and The DS's use of native browser features and CSS custom properties. They do not require installing The DS. Inspect the existing application and follow its established design system before adding anything.

## Core rules

1. Compose interfaces from small parts with clear responsibilities.
2. Order styling decisions from general defaults to local exceptions.
3. Keep selectors flat and specificity low. **Avoid nested selectors whenever possible.**
4. Give each component a small, explicit styling interface through its own custom properties.
5. **A component outside The DS must not consume The DS variables directly in its implementation. Map them to component-owned variables in a separate adapter.**
6. Use native HTML and CSS capabilities before introducing custom machinery.
7. Share design relationships and reusable rules; avoid copying whole component styles.
8. Verify behaviour in context. Small CSS is useful, but does not by itself prove performance or correctness.

## 1. Compose small parts

Use Atomic Design as a way to think about composition: small controls combine into functional groups, which combine into larger sections and complete pages. Develop the parts and the whole together. Do not impose an elaborate taxonomy or folder hierarchy merely to match the terminology.

Separate responsibilities such as surface appearance, typography, spacing, layout, and interaction state. A larger component should normally arrange its children without reaching into their internal styling.

Reuse existing components and primitives. Add CSS for the new responsibility or difference, rather than repeating everything the constituent parts already provide.

Do not make a reusable component depend on a particular page, ancestor chain, or incidental HTML wrapper. Document any structural relationship it actually requires.

## 2. Establish a predictable cascade

When using The DS, preserve its layer order:

```css
@layer reset, setup, theme, base, component, page, utility;
```

| Layer | Responsibility |
| --- | --- |
| `reset` | Minimal normalization of browser defaults |
| `setup` | Foundational values, such as the palette |
| `theme` | Configurable defaults and design-system adapters |
| `base` | Element defaults and shared primitives |
| `component` | Reusable interface components |
| `page` | Application-specific composition and overrides |
| `utility` | Small, explicit adjustments |

For another system, use its existing layer contract or establish a similarly small order. Declare that order before introducing the layers. Do not create a new layer for every component.

Keep a component's related code together where practical. A single file may contain its adapter in `theme` and its implementation in `component`: file organization and cascade precedence serve different purposes.

For normal declarations within the author origin, later layers outrank earlier layers before selector specificity is compared. Within a layer, specificity still matters, followed by source order when other factors tie. Unlayered normal author styles outrank layered normal styles. Avoid accidentally using unlayered rules as a permanent override mechanism.

Avoid `!important`. It reverses layer precedence and complicates this model. Use it only for a specific, justified requirement, not to repair an escalating selector conflict.

## 3. Prefer flat selectors; avoid nesting

**Default to one directly applied class per styling rule. Avoid descendant chains and avoid CSS or preprocessor nesting when a flat rule is sufficient.** Nesting syntax can conceal increasing specificity and structural coupling; it does not provide component isolation.

Prefer:

```css
.contact-card { /* surface */ }
.contact-card-title { /* title */ }
.contact-card-action { /* action */ }
.contact-card-action:hover { /* interaction */ }
```

Avoid:

```css
.dashboard .sidebar .contact-card header h2 { /* fragile */ }
.contact-card .contact-card-title { /* unnecessary ancestor */ }

.contact-card {
  header {
    h2 { /* unnecessary CSS nesting */ }
  }
}
```

Apply `.contact-card-title` directly to the relevant element. Its name communicates ownership without requiring an ancestor selector.

- Use namespaced component classes to prevent collisions.
- Avoid IDs for styling; IDs remain appropriate for labels, fragments, and accessibility relationships.
- Avoid qualifying a class with an element name unless element-specific behaviour requires it.
- Keep state selectors direct, such as `.contact-card-action:disabled` or `.contact-card[aria-busy="true"]`.
- Prefer changing the component's own properties for a variant over introducing a page-specific descendant override.
- Use `:where()` when a selector needs zero specificity, not as a way to disguise an unnecessarily complicated relationship.

A short structural selector is acceptable when structure is the actual contract, for example `.item-list > .item-list-item`. Keep that relationship local and intentional. Do not add selectors that reach through multiple independent components. The rule is to avoid nesting where possible, not to prohibit meaningful relationships.

## 4. Give external components their own styling interface

**If a component is not part of The DS itself, its implementation must use its own custom properties rather than `--ds-*` properties.** This includes layout, typography, colours, spacing, borders, shadows, states, and animations wherever they consume host design values.

Create a small adapter that maps host values to the component's vocabulary. Keep all references to The DS variables in that adapter. Give the component's variables names that describe its own needs.

```css
@layer reset, setup, theme, base, component, page, utility;

/* contact-card.theds.css — the design-system boundary */
@layer theme {
  .contact-card {
    --contact-card-space: var(--ds-space);
    --contact-card-radius: var(--ds-box-radius);
    --contact-card-background: var(--ds-color-background);
    --contact-card-text: var(--ds-color-contrast);
  }
}

/* contact-card.css — independent component implementation */
@layer component {
  .contact-card {
    display: grid;
    gap: var(--contact-card-space, 1rem);
    padding: var(--contact-card-space, 1rem);
    border-radius: var(--contact-card-radius, 0.25rem);
    background: var(--contact-card-background, Canvas);
    color: var(--contact-card-text, CanvasText);
  }

  .contact-card-title {
    margin: 0;
    font: inherit;
    font-weight: 700;
  }

  .contact-card-description {
    margin: 0;
  }
}

/* An application-level variation */
@layer page {
  .contact-card-compact {
    --contact-card-space: 0.5rem;
  }
}
```

```html
<article class="contact-card contact-card-compact">
  <h2 class="contact-card-title">Ada Example</h2>
  <p class="contact-card-description">Project contact</p>
</article>
```

To use another design system, replace the adapter. The component implementation and its public variable names stay unchanged. Separate files are helpful but not mandatory; a clearly marked adapter section is enough for a small component.

Provide sensible standalone fallbacks where useful. Expose meaningful customization points without turning every literal into a public variable. A structural choice such as `display: grid` can remain an implementation detail.

The variable boundary alone does not remove dependencies on host classes or components. If the component also requires `.ds-*` classes or DS-specific markup, document that dependency or move the integration outside the independent component.

## 5. Resolve variables at the right scope

Custom properties inherit, but `var()` references inside their values resolve before inheritance. An alias defined at the root does not automatically recalculate against a descendant's overridden input.

```css
/* This alias is resolved on the root. */
:root {
  --brand: blue;
  --button-background: var(--brand);
}

.special-section {
  --brand: red;
  /* Inherited --button-background still contains blue. */
}
```

Resolve adapter mappings on the component root, as in the contact-card example, or on an explicitly defined theme boundary. This lets the mapping consume the host values available at that location. If a host token is itself an inherited root-level alias, the host must also refresh that alias at its theme boundary.

A property declared directly on a component takes precedence over an inherited value, regardless of the ancestor selector's specificity or layer. Consequently, override a mapped component property on the component itself, or deliberately design a different inheritance contract. Do not promise arbitrary ancestor overrides without checking how the component initializes its variables.

Avoid cyclic property references. Keep mappings short enough to trace in developer tools.

## 6. Make spacing and typography coherent

Use a small shared spacing scale and typographic scale. Derive related sizes from common units rather than inventing unrelated values for every component. External components access those shared values through their own adapter properties.

Give spacing a clear owner:

- Containers own gaps between their child components.
- Components own their internal spacing.
- Text defaults establish a consistent reading rhythm.

The DS deliberately uses vertical rhythm, collapsing margins, and separate box/spacing primitives. Preserve those conventions when extending an existing DS composition. In other layouts, `gap` and padding may be simpler. Do not mix mechanisms accidentally: Grid and Flexbox do not collapse their items' margins.

Prefer logical properties such as `margin-inline`, `padding-block`, and `max-inline-size` when appropriate. Let content wrap and grow. Avoid fixed heights for text-bearing controls unless there is a clear requirement and overflow is handled.

## 7. Use native browser capabilities

Start with semantic HTML. Use real buttons for actions, links for navigation, labelled form controls, and appropriate native elements such as `details`/`summary` and `dialog`.

Use Grid and Flexbox for layout. Use media queries for viewport or user-preference conditions and container queries when a component should respond to its available space. Establish the intended query container; do not assume a component can query its own size through an ordinary ancestor container query.

Use JavaScript for application behaviour that needs it. Avoid recreating browser layout or interaction capabilities merely to satisfy a framework pattern. Check support against the project's actual browser targets.

Preserve keyboard access, visible focus, readable contrast, zoom/reflow, and reduced-motion preferences. Removing native outlines requires an effective replacement. Decorative shadows or outlines must not obscure focus indicators.

## 8. Keep delivery and rendering economical

- Reuse shared rules. Avoid duplicating a component's complete stylesheet for each page or variant.
- Keep source modular and deliver CSS in a small number of cacheable resources appropriate to the application. A build step is optional; a prebuilt combined stylesheet is often enough.
- Avoid unnecessary chains of CSS imports. Keep fonts optional and load only the families and weights the application needs.
- Deliver application styles separately from design-catalogue examples, editor data, and documentation.
- Scope dynamic changes to the smallest appropriate region. A root-level variable change may affect many descendants.
- Avoid unnecessary layout-triggering animation and expensive visual effects. Prefer suitable transform/opacity animations when they achieve the desired effect, and verify the result.
- Measure before optimizing selector performance. Low specificity primarily improves maintainability; specificity is not a rendering-cost score.

Do not claim that an architecture guarantees speed. Distinguish transferred CSS size, font loading, style recalculation, layout, and painting when investigating performance.

## 9. Working procedure and review

Before writing CSS, inspect existing primitives, tokens, layers, and supported browsers. Decide which styling responsibility the new code owns. Reuse what already exists.

Implement the smallest sufficient component, with flat selectors and an explicit adapter when it consumes host design values. Add only necessary variants and responsive behaviour.

Before declaring the work complete, check the relevant items:

- Can the component be understood without tracing a page's ancestor chain?
- Are selectors flat, with any structural exceptions justified?
- Are all `--ds-*` references for an external component confined to its adapter?
- Can a different host design system be connected by changing that adapter?
- Do overrides work at the documented scope, including inherited and derived variables?
- Are cascade layers doing the work instead of selector escalation or `!important`?
- Does the component work in its actual composition, with long content and narrow available space?
- Are keyboard states, focus, disabled states, zoom, and relevant themes usable?
- Is production delivery free of unnecessary catalogue data and duplicated CSS?

Use browser inspection for meaningful layout and interaction changes. Report what was actually checked and any remaining limitation; do not substitute code inspection for a claim of observed browser behaviour.

## References and provenance

Distilled from Auke van Slooten's requirements and the discussion of The DS, Atomic Design, and ITCSS on 8 November 2026. The external-component variable boundary and preference for flat selectors are explicit project rules. The example above is illustrative guidance, not a verbatim extract from The DS.

- [The DS repository](https://github.com/muze-nl/the-ds) — implementation inspected at commit `2583aa3`; the originally supplied `muze-labs/the-ds` URL was inaccessible.
- [SimplyDesign data](http://simplydesign.dev.muze.nl/data/data.json) — especially the `/design-system/` content and examples.
- [Atomic Design methodology — Brad Frost](https://atomicdesign.bradfrost.com/chapter-2/).
- [ITCSS — Harry Roberts](https://www.creativebloq.com/web-design/manage-large-css-projects-itcss-101517528).
- [CSS cascade layers — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@layer).
- [Custom-property resolution — W3C](https://www.w3.org/TR/css-variables-1/#cycles).
- [CSS selector performance — Chrome DevTools](https://developer.chrome.com/docs/devtools/performance/selector-stats).

When implementing against a newer version of a design system, inspect its current code and token names rather than assuming these examples describe every version.
