# Stuttgart Design Guide

**Engineered heritage.** Stuttgart is for logistics companies, so the interface
should feel like a well-kept ledger and a technical drawing: ruled, square and
flat, legible at a glance, with one indigo signal for the modern engine underneath.
Content sits in a flush, hairline-ruled frame that fills the space beside the sidebar on a plain soft-gray canvas. Color is
reserved for status and data, never decoration.

Tokens live in `app/globals.css` (`:root` / `.dark`) and are exposed to
Tailwind through `@theme inline`. **Always use the token classes below, never
raw palette classes like `bg-zinc-100`, `text-gray-600` or `border-gray-100`.**

## References

| Reference | What we take from it |
| --- | --- |
| **"Build lasting relationships" landing (primary)** | Classical engraving with one section tinted indigo, two-tone headline, small square ink CTA, `( WHAT DO WE DO? )` eyebrows, hairline grid with diagonal construction lines, flat gray tiles `01 / Conversational` |
| Halftone sign-in | Monochrome palette, mono labels, hairline-bordered white card on gray |
| Celoxis Management Overview | Calm near-white admin shell, clear status chips |
| Movara shipping dashboard | Big light numbers with small muted units, dark active nav |
| Smart construction dashboard | Segmented tick meters, color-coded legends |

## Principles

1. **Ruled, not floating.** Group content in one hairline-bordered frame and divide it with rules (`divide-y`, `gap-px bg-border` grids). No drop shadows on page content.
2. **Square and sturdy.** 4px controls, 2px chips. Nothing is a pill except avatars and status dots.
3. **Old drawing, new signal.** Line art and rules in muted ink; indigo `brand` appears once per view (the illustration's tinted section, focus rings).
4. **Two-tone headlines.** The lead phrase is muted and the subject is ink: "*Good morning,* Mike."
5. **Numbered cells.** Captions like `01 / Entries today` show the order of the page. Numbering runs continuously down a page.
6. **Figures are mono.** Amounts, dates, counts and voucher numbers use Geist Mono with `tabular-nums`.

## Color tokens

| Token | Light | Class | Use |
| --- | --- | --- | --- |
| `--canvas` | `#F3F3F1` | `bg-canvas` | App background behind cards |
| `--card` / `--background` | `#FFFFFF` | `bg-card`, `bg-background` | Cards, popovers, inputs |
| `--surface-muted` | `#F7F7F6` | `bg-surface-muted` | Table header, row hover, inset areas |
| `--border` | `#E8E8E6` | `border` (default color) | 1px hairlines |
| `--foreground` | `#111113` | `text-foreground` | Primary text |
| `--muted-foreground` | `#75757B` | `text-muted-foreground` | Secondary text, labels |
| `--primary` | `#111113` (ink) | `bg-primary` | Primary buttons, active nav pill |
| `--accent` | neutral `#F4F4F2` | `bg-accent` | **Hover only** (shadcn menus/ghost buttons) |
| `--brand` / `--brand-soft` | `#5B5BF0` / `#EEEEFE` | `text-brand`, `bg-brand-soft` | Highlights, focus ring, chart series 1 |
| `--success` / `--success-soft` | `#23864B` / `#E8F6EE` | `text-success`, `bg-success-soft` | Positive / pass / credit |
| `--warning` / `--warning-soft` | `#B4620F` / `#FDF3E6` | `text-warning`, `bg-warning-soft` | Pending, attention (chip text; chart-2 is the brighter amber `#F29A3A`) |
| `--destructive` / `--danger-soft` | `#D93A40` / `#FDECEC` | `text-destructive`, `bg-danger-soft` | Errors, delete, debit |
| `--chart-1…5` | indigo, amber, green, slate, violet | `var(--chart-n)` | Data series, in that order |

> `accent` stays neutral because shadcn uses it for hover backgrounds. The indigo highlight is `brand`.

All text tokens meet 4.5:1 on `card` and `canvas`; soft tints pair only with their own hue.

Dark values exist under `.dark` (charcoal canvas `#0E0E10`, surface `#17171A`) but no toggle ships yet.

## Typography

| Role | Spec |
| --- | --- |
| Page title | `heading text-4xl md:text-5xl leading-[1.05]` (Instrument Sans 400), two-tone |
| Dialog / section title | `heading text-2xl`, two-tone |
| Display number | `text-3xl font-light tabular-nums` + unit `text-sm text-muted-foreground` |
| Page eyebrow | `eyebrow` (Geist Mono, 11px, uppercase, `tracking-[0.08em]`, muted), in parentheses: `( Finance · Acme )` |
| Cell caption | `eyebrow normal-case tracking-normal`: `01 / Details` |
| Body | `text-sm` Geist Sans, `text-foreground/80` in dense tables |
| Figures | `font-mono tabular-nums`, right-aligned in tables |
| Wordmark | `font-bodoni` (Bodoni Moda), logo only |

## Shape, elevation, spacing

- `--radius: 0.375rem`, which gives `rounded-sm` 2px (chips), `rounded-md` 4px (buttons, inputs, selects, frames) and `rounded-lg` 6px.
- **No shadow on page content.** `shadow-card` is only for things that float above the page: dialogs, popovers and menus.
- Borders are 1px `border` hairlines. Separate cells with `divide-y`/`border-t`, or with a `gap-px bg-border` grid.
- 4px base. Page gutter `p-4 md:p-6`, cell padding `px-5 py-4` to `px-8 py-10` for the hero.

## Utilities

- `bg-dot-grid`: an optional 18px dot grid on the canvas. It is no longer used in the app shell (`bg-canvas` only).
- `eyebrow`: a mono micro-label.
- `heading`: Instrument Sans 400, tight tracking, balanced wrapping.

## Components

**Ruled page frame** (see `app/(main)/page.tsx`)
The frame is flush, with no outer padding, so it uses all the space beside the sidebar.
```tsx
<div className="flex min-h-full flex-col divide-y border-l bg-card">
  <section>…compact greeting strip…</section>
  <DashboardTransactionsTable … />  {/* edge to edge, flex-1 */}
</div>
```

**Greeting strip**: a compact two-column strip, `px-4 py-4 md:px-6 md:py-5`. The left column holds the eyebrow, a two-tone `heading text-2xl md:text-3xl` title, a mono date line and the single ink CTA. The right column (`md+`) holds `BlueprintLorry` at `h-40`, divided by `border-l`, with a faint 17° `bg-border` construction line crossing the strip.

**Blueprint illustration** (`components/shared/blueprint-lorry.tsx`)
- A side elevation of a cab-over lorry in hairline `currentColor` (`text-muted-foreground`), with wheel wells, hub cross-hairs, centre-lines and dimension marks (`7.2 M`, `3.4 M`).
- The cab is filled `--brand` and one cargo panel is a brand dot matrix: the classic build with the modern engine.
- New illustrations follow the same rules: line art in tokens, one tinted section, real measurements as labels.

**Page header strip** (`components/shared/page-header.tsx`)
- `PageHeader` takes `eyebrow`, `lead` (the muted half of the two-tone title), `title`, `description` (a mono line) and `actions`.
- On detail and sub pages pass `back={{ href, label }}`. It renders a text link above the eyebrow that names the destination. It changes color on hover (muted to ink) with no background, e.g. **← Clients**, **← Acme Ltd** or **← Invoice 0412** (aria-label "Back to {label}"). Use the page’s real name, not the word "Back". Keep the eyebrow for context, e.g. `( Acme Ltd · Invoices )`, and never put the back link inside it.
- `HeaderFigure` is the mono-captioned figure on the right, e.g. `( Current balance )` LKR 1,240,000.00. Pass `tone="negative"` for red.
- Every list or detail page is `flex h-full flex-col divide-y bg-card`, built as PageHeader, then a toolbar row (`px-4 py-3`), then content that fills the remaining height edge to edge.

**Record grid** (accounts list)
- Tiles are `Link`s in `grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`. Each has `border-b sm:border-r px-5 py-4` and a `hover:bg-surface-muted`.
- The same tile pattern serves the settings overview: caption `01 / Departments`, icon + name + one-line description, and an entry count.
- Each tile shows a mono caption `01 / {type}`, the name, and the figure in mono `text-2xl font-light`, red when negative. A hover arrow marks it as a link.

**Ruled table** (`components/shared/ruled-table.tsx`)
- `RuledTable table={tanstackTable} onRowClick? emptyMessage?` gives the edge-to-edge scroll area: sticky mono header on `surface-muted`, hairline rows, `first:pl-4 last:pr-4`.
- `TableCaption label count` sits in the toolbar above it.
- Paginated tables end with `TablePager table`, a `border-t` row with "Page 2 of 5 · 48 rows" in mono and outline Previous / Next buttons.
- New tables use this. The dashboard and account tables follow the same spec inline.

**Toolbar controls** (one row above a table, `flex flex-wrap gap-2`)
- Search: `Input` with `min-w-48 flex-1` and sentence-case placeholder ("Search by description or amount").
- **Sort:** `SortPopover` from `components/shared/transactions-sort-popover.tsx` is an outline button with a "( Sort by )" list that checks the active option. Pass `options` for other tables (e.g. invoices).
- **Selects:** `bg-card w-full sm:w-36` to `sm:w-44`, each with an `aria-label`. Type filters prefix options with a status dot.
- **Multi-select filters:** an outline button that reads its state ("Active", "2 statuses"), with a "( Show )" label in the menu.
- **Clear:** ghost button with icon and text.
- **Loading:** `LoadingState` labels are mono `eyebrow`. Skeleton rows are `h-9 rounded-md`, and the bar is a 2px brand line.
- **Floating layers:** popovers, selects, menus and sheets use `shadow-card`. Overlays are `bg-foreground/20 backdrop-blur-[2px]`.

**Company chips** (`components/shared/company-chips.tsx`)
- Wherever a list of companies shows (profile, users table), use `CompanyChips`: 2px-corner `surface-muted` chips with a hairline ring, and the active company `brand-soft` with a dot.
- Pass `max` in tables to collapse the rest into "+N" (hover shows the names). Always show names, never raw ids.
- The company switcher lives on the profile page (`05 / Active company`), not in the sidebar.

**Settings rows** (profile)
- `section grid md:grid-cols-[18rem_minmax(0,32rem)] px-6 py-6` holds a numbered caption with a one-line description on the left and the form on the right.
- Results show as a `success-soft` `<output>` or a `danger-soft` `role="alert"` note above the submit button.

**Row actions** (clickable rows that also have edit/delete)
- Wrap the actions cell in an element that calls `stopPropagation()`. Dialogs portal out, but React events still bubble to the row.
- Row actions are ghost `icon-sm` buttons (edit, delete with a `danger-soft` hover) followed by an `ArrowUpRight` open link.
- On detail pages the same dialogs take `triggerVariant="button"` for outline **Edit details** / **Delete** buttons.

**Report panels** (`app/(main)/reports/components/report-panel.tsx`)
- `ReportPanel label="02 / Month-end balances" caption actions bodyClassName` is a ruled cell with a caption row and a body. It has no card chrome, and `bodyClassName="p-0"` makes tables run edge to edge.
- Lay panels out in `grid gap-px bg-border` and number them continuously down the page.
- Page-wide filters (month, account) live in the page header's actions, never inside one widget.

**Chart colour** (`app/(main)/reports/components/report-colors.ts`)
- Series use `SERIES_COLORS`, eight validated hues led by brand indigo, through `seriesColor(stableIndex)`.
- The index is the entity's position in the full list, never its rank in a filtered view, so an account keeps its colour across charts and tables.
- Past slot 8 a series is drawn `--muted-foreground`, never a reused hue.
- Credit / debit / net use `FLOW_COLORS`: indigo, amber, slate. Not red/green in charts. Tables keep `text-success` / `text-destructive` plus +/− signs.
- Single-measure bars use one colour (`--chart-1`). The axis names the categories.
- Every multi-series chart has a legend and a table view, because slots 3–5 are below 3:1 on the surface.
- Up to 4 series use the inline legend. Charts with many series (e.g. account balance trends) use `ChartLegendPopover`, an outline **Legend** button in the panel actions that opens a scrollable list of colour, name and check mark. Picking an item focuses that series and "All accounts" resets.

**Tabs on ruled pages**: an underline style. `TabsList` is a `border-b` row. Triggers are `border-b-2` with transparent bg, the active one gets `border-foreground`, and labels are numbered (`01 / Account summary`).

**Facts grid** (client and invoice detail)
- A `dl` in `grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4` with `bg-card px-5 py-4` cells.
- Each cell has an `eyebrow normal-case` caption (`01 / VAT No`) and a `text-sm` value. Money uses a mono `LKR` unit with a mono value, and the key figure gets `text-2xl font-light`.

**Document pages** (invoice document, template preview)
- The printed document sits on `bg-canvas` inside `rounded-md border bg-white shadow-card`, centred.
- The document itself keeps its own print styling and is not themed.


- `ruledDialogContentClass` goes on `DialogContent`. `RuledDialogHeader` takes `eyebrow`, `lead`, `title` and `description`.
- Content is split into `RuledDialogSection label="01 / …"` blocks, a two-column grid on `sm+`.
- `RuledDialogFooter summary=…` holds the live mono summary, with a ghost Cancel and an ink Submit.
- The transaction form lives once in `transaction-form-fields.tsx` and is shared by the add and edit dialogs.

**Confirmations** (`components/custom/confirmation-dialog.tsx`)
- Same header and footer recipe. It takes `eyebrow`, `lead`, `title`, `description`, `confirmLabel`, `cancelLabel`, `destructive` and `pending`, and defaults to "Discard your changes?".
- It also takes `trigger` (renders its own trigger button), `children` (body content), `keepOpen` (stay open while an async confirm runs) and `confirmDisabled`.
- Use it instead of `window.confirm` or a bare `AlertDialog`. Show outcomes such as "Reset link sent" inside its `children` with a `success-soft` / `danger-soft` note, never with `alert()`.

**Buttons**
- `default` is the square ink block: the one primary action per view, e.g. **Record transaction**.
- `outline` is a white block with a hairline border, for filters and secondary actions.
- `ghost` is for Cancel and icon actions.

**Inputs and selects**: white, hairline, 4px corners, `px-3`, with an indigo focus ring. For money, use a mono `LKR` prefix inside the field and a mono `tabular-nums` value.

**Status chip** (`Badge`): a 2px-corner chip with variants `neutral`, `brand`, `success`, `warning` and `danger`.

**Table** (`app/(main)/components/logistics/data-table.tsx`)
- Fills the frame edge to edge: the toolbar is `px-4 py-3`, the scroll area is `border-t` with no side border, and the pagination bar is `border-t px-4 py-3`.
- Sticky `bg-surface-muted` header in mono uppercase.
- Hairline rows with no vertical rules. Dates are muted mono; amounts are mono and right-aligned.
- The active page in pagination is an ink block.

**Dialog** (`add-transaction-dialog.tsx` is the reference)
- `p-0 gap-0` content, a `shadow-card` float, and sections ruled with `border-b`.
- Header: eyebrow `( New entry · Ledger )`, a two-tone `heading` title and a one-line description.
- Numbered sections, `01 / Details`, `02 / Allocation`, `03 / Money flow`, each a `grid sm:grid-cols-2 gap-4` with `px-6 py-5`.
- Money flow is a `From → To` strip with a square arrow box, then the large amount field.
- Footer: `bg-surface-muted border-t`, with a live mono summary on the left (`LKR 48,250.00 · Fuel → Cash`) and ghost Cancel plus ink Submit on the right.

**App shell** (`app/(main)/layout.tsx`, `components/layout/sidebar.tsx`)
- The sidebar is a ruled column on `bg-canvas`, divided by `border-b`/`border-t`. From top to bottom:
  - brand block: the Bodoni wordmark (`h-14`) only
  - `( Modules )` nav
  - Settings and Log out
  - a profile row with a square ink monogram
- Nav items are `h-9 rounded-md px-2` with a right-aligned mono index (`01`…). The active item is the ink block `bg-primary text-primary-foreground`.
- `<main>` carries the single `border-l` rule against the sidebar, with no outer padding. Pages fill it edge to edge.

**Sign-in** (`app/(auth)/sign-in/page.tsx`)
- A split screen: a `30rem` form column and a blueprint panel (`lg+`).
- Form column: brand row `h-14 border-b`, then eyebrow `( Sign in · Ledger access )`, a two-tone title ("*Welcome back.* Sign in to continue."), full-width ink Submit, an `Or` rule and an outline Google button. The footer note is mono.
- Panel: `( Finance · Fleet · Operations )` in its `h-14` header row, the `BlueprintLorry` centred, a diagonal construction line, and a two-tone tagline ("*Built like a ledger.* Runs your fleet.") above a `border-t`.

**Segmented meter** (for progress and utilisation)
```tsx
<div className="flex gap-[2px]">
  {Array.from({ length: 40 }, (_, i) => (
    <span key={i} className={cn("h-4 w-1 rounded-sm", i < filled ? "bg-brand" : "bg-border")} />
  ))}
</div>
```

## Do / Don't

- ✅ Token classes (`bg-card`, `text-muted-foreground`, `border`). ❌ `bg-white`, `bg-zinc-100`, `text-gray-600`.
- ✅ One ink button per view. ❌ Several black buttons competing.
- ✅ Flush, full-width content with rules between sections. ❌ Floating shadowed cards, or gray panels wrapping white cards.
- ✅ Indigo once per view, as a signal. ❌ Indigo backgrounds, gradients or decoration.
- ✅ Real units and measurements in labels. ❌ Status copy that isn't backed by data.
- ✅ `tabular-nums` for any figure that lines up in a column.

## Rollout status

- Done: tokens, app shell (ruled sidebar, flush main), sign-in, accounts list and detail, profile (account facts, active company switch, username and password sections), settings (overview tiles, account type and department lists, add/edit/delete lookup dialogs), users (users, companies and audit log tabs, invite user, company, password reset and company status dialogs), reports (overview, custom report, report filters, panels, charts, custom report, share and export dialogs), fleet (register, vehicle detail, vehicle and delete dialogs), clients (list, detail, invoices, invoice detail, document, new and edit invoice, template, analytics, and all their dialogs), add account, edit and delete transaction, confirmations, primitives (button, input, card, badge, dialog), the dashboard (greeting strip and full-width table) and the Add Transaction dialog.
- Follow-up: none of the app pages are on the old styling. The printed invoice and export documents keep their own print styles on purpose.
