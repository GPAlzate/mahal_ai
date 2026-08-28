# Mahal AI — Codex Instructions

## UI/UX

Always invoke the `ui-ux-pro-max` skill before answering any UI/UX question — design evaluation, component layout, spacing, color, accessibility, interaction patterns, or anything visual. Run the skill search first, then answer.

## Tech Stack

- **Framework**: Next.js (App Router) with TypeScript
- **Database**: Neon (serverless Postgres) via raw SQL tagged templates (`lib/db.ts`)
- **Storage**: Vercel Blob (receipt images)
- **AI**: OpenAI API (receipt parsing via `lib/services/OpenAIService.ts`)
- **Styling**: Tailwind CSS v4
- **Package manager**: `pnpm`

## Database Schema

### `receipts`
| Column | Type | Nullable |
|---|---|---|
| `id` | bigint | NO |
| `title` | varchar | YES |
| `status` | USER-DEFINED (enum) | NO |
| `share_code` | text | YES |
| `image_uri` | text | YES |
| `receipt_time` | timestamp | NO |
| `created_at` | timestamp | NO |
| `updated_at` | timestamp | NO |
| `deleted_at` | timestamp | YES |

### `participants`
| Column | Type | Nullable |
|---|---|---|
| `id` | bigint | NO |
| `receipt_id` | bigint | NO |
| `display_name` | text | NO |
| `created_at` | timestamp | NO |
| `updated_at` | timestamp | NO |
| `deleted_at` | timestamp | YES |

### `receipt_lines`
| Column | Type | Nullable |
|---|---|---|
| `id` | bigint | NO |
| `receipt_id` | bigint | NO |
| `line_type` | USER-DEFINED (enum) | NO |
| `item_name` | text | NO |
| `unit_price` | numeric | NO |
| `quantity` | numeric | NO |
| `created_at` | timestamp | NO |
| `updated_at` | timestamp | NO |
| `deleted_at` | timestamp | YES |

**`line_type` values**: `PRCH` (purchase), `TAX`, `TIP`, `SRVC` (service charge), `DSCT` (discount)

### `line_participants`
| Column | Type | Nullable |
|---|---|---|
| `receipt_line_id` | bigint | NO |
| `participant_id` | bigint | NO |
| `share_quantity` | numeric | NO |

Junction table linking participants to receipt lines with a share quantity (supports fractional shares).

## Project Structure

```
app/
  [code]/page.tsx          # Share code join page
  receipts/[id]/
    assign/page.tsx        # Line item assignment flow
    participants/          # Participant management
    summary/               # Receipt summary view
  api/
    receipts/              # Receipt CRUD
    line-participants/     # Assignment endpoints
    blob-upload/           # Image upload
    split-groups/          # Split group endpoints

lib/
  db.ts                    # Neon SQL client
  client/
    api-client.ts          # Typed fetch wrappers
    hooks/                 # React hooks (useReceipt, useParticipants, useAssignments)
  services/
    ReceiptService.ts
    ReceiptLineService.ts
    ReceiptSummaryService.ts
    LineParticipantService.ts
    ParticipantService.ts
    OpenAIService.ts
  helpers/
    CurrencyHelper.ts
    ShareCodeHelper.ts
  schemas/                 # Zod validation schemas

components/                # Shared UI components
```

## Key Patterns

- All DB access goes through service classes in `lib/services/`
- Batch assignments use `LineParticipantService.batchAssignParticipants()`
- Summary calculation lives in `ReceiptSummaryService.calculateSummaryFromReceipt()`
- Soft deletes: rows with `deleted_at != null` are considered deleted
- Assign page flow: items → discounts (if any) → misc charges → summary
- Discounts can be assigned to specific participants or left unassigned (proportional split)

## Build Notes

- `pnpm build` fails due to a pre-existing Tailwind v4 + PostCSS config issue
- `pnpm tsc --noEmit` has pre-existing errors in zod schemas and route files — not related to feature work
- Use `pnpm` (not `npx`) for all commands
