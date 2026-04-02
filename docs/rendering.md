# Rendering System

Rendering is implemented primarily in `src/webview/components/VirtualMemoryGrid.tsx`.

## Virtualization model

- Row height is fixed (`ROW_HEIGHT = 22`).
- Visible range is computed from `scrollTop` and viewport height.
- Overscan rows are included (`OVERSCAN_ROWS = 10`).
- The component progressively increases revealed window near bottom:
  - `INITIAL_WINDOW_ROWS = 32`
  - `WINDOW_GROWTH_ROWS = 32`
  - `GROWTH_THRESHOLD_ROWS = 12`

Rows are rendered as an absolute-positioned block inside a tall container to simulate full scroll height.

## Byte rendering pipeline

For each visible row:

1. Compute `rowOffset` and row address from `baseAddress`.
2. Request row bytes via `getBytes(rowOffset, bytesPerRow)`.
3. For each column:
   - slice unit bytes (`unitSize`)
   - determine state: loading, unreadable, changed, normal
   - render hex cell via `formatUnit`
   - optionally render decoded cell via `formatDecodedByte`

## Alignment logic used in code

The grid aligns address, hex, and decoded using fixed character widths.

### Core width constants

| Constant | Value | Purpose |
| --- | ---: | --- |
| `ADDRESS_WIDTH_CH` | `18` | `0x` + 16-digit address width |
| `ADDRESS_HEX_GAP_CH` | `2` | gap after address column |
| `CELL_GAP_CH` | `1` | gap between cells in a group |
| `MID_GAP_EXTRA_CH` | `1` | midpoint visual split |
| `SECTION_GAP_CH` | `3` | gap between hex and decoded groups |

### Cell width rules

- `getHexCellWidth(unitSize, format)` computes width for hex area.
- `getDecodedCellWidth(hexCellWidth, mode)` currently returns `hexCellWidth`.
- `ByteCell` applies `width: ${widthCh}ch` to every rendered cell.

This enforces one-to-one width parity between hex and decoded sections.

## Header rendering

`HeaderRow`:

- shows `Address` text in fixed address cell
- creates per-column hex header labels from offsets (`00`, `01`, ...)
- inserts midpoint gap element at `Math.floor(columns / 2)`
- mirrors header structure in decoded section when decoded is shown

## Byte formatting logic

### Hex/unit formatting

`formatUnit(bytes, unitSize, endianness, format)`:

- if any byte is null -> returns placeholder of `~` repeated to cell width
- applies endian ordering (`little` reverses bytes)
- packs bytes into bigint and calls `formatValue`

`formatValue(value, unitSize, format)`:

- `hex`: uppercase, padded to `unitSize * 2`
- `dec`: padded using `getDecWidth(unitSize)`
- `oct`: padded to `ceil((unitSize * 8)/3)`
- `bin`: padded to `unitSize * 8`

### Decoded formatting

`formatDecodedByte(byte, mode, width)` behavior:

- `ascii`:
  - printable `0x20..0x7E` -> character
  - `0x00` -> `.`
  - `0x0A` -> `↵`
  - `0x0D` -> `⏎`
  - `0x09` -> `⇥`
  - otherwise -> `·`
  - result padded with `padStart(width, ' ')`
- `uint8` -> decimal padded to width
- `int8` -> signed decimal padded to width
- `bin` -> binary padded and sliced to width
- `hidden` -> spaces

## Placeholders and special states

- Loading row slice (`bytes === null`):
  - hex/decoded cell shows dotted placeholder (`··` padded)
- Unreadable byte/unit (`null` present):
  - hex shows repeated `~`
  - decoded shows `~~` padded
- Changed bytes:
  - variant style `changed` applies highlighted background and color

## Styling primitives

Font and row metrics are centralized:

- `FONT_FAMILY = var(--vscode-editor-font-family, Consolas, "Courier New", monospace)`
- `FONT_SIZE = 13px`
- `LINE_HEIGHT = 22px`

All major row/cell containers use `whiteSpace: 'pre'` to preserve spacing.
