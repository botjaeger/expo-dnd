# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

expo-dnd is a cross-platform drag-and-drop library for React Native/Expo supporting iOS, Android, and Web. Published as `@botjaeger/expo-dnd` on npm.

## Repository Structure

```
expo-dnd/
├── src/
│   ├── components/          # DndProvider, Draggable, Droppable, SortableList,
│   │   │                    # SortableFlatList, AutoSortable, DraggableList
│   │   └── sortable-shared/ # Shared sortable infrastructure (items, overlay, container hook)
│   ├── hooks/               # useDraggable, useDroppable, useAutoScroll, useLayoutMeasurement
│   ├── context/             # DndContext provider, types, useDndContext hook
│   ├── collision/           # rectIntersection algorithm and types
│   ├── animations/          # dragEffects presets (pickup, scaleUp, scaleDown, bounce)
│   ├── portal/              # PortalProvider for rendering overlays above modals
│   └── utils/               # Platform detection, geometry, sortable helpers, height utilities
├── dist/                    # Build output (CJS + ESM + DTS)
└── package.json
```

## Common Commands

```bash
npm install          # Install dependencies
npm run build        # Build library (tsup → dist/)
npm run dev          # Build in watch mode
npm run typecheck    # Type check with tsc --noEmit
```

## Architecture

### Two-Thread Model
- **UI thread** (worklets): Gesture handling, animations, layout measurement via Reanimated shared values
- **JS thread**: Callbacks, state updates, React renders
- Bridged via `runOnJS()` / `runOnUI()`

### State Management
- **DndContext** (React Context): Holds draggable/droppable registries (stored in Refs to avoid re-renders), callbacks, container ref
- **Shared values**: `activeId`, `translateX/Y`, `absoluteX/Y`, `overId`, `isDragging` — drive UI-thread animations without triggering renders

### Drag Flow
1. Draggable/droppable register with context on mount
2. Pan gesture sets `isDragging`, updates `absoluteX/Y` on UI thread
3. Collision detection runs per frame using pointer position (4px rect at cursor)
4. Hit → `overId` updates → Droppable's `isOver` derived value updates
5. Drop → callbacks fire → state resets, spring animation back

### Key Files
- `src/context/DndContext.tsx` — Core provider with registries, shared values, overlay management
- `src/hooks/useDraggable.ts` — Pan gesture, collision detection, overlay positioning
- `src/hooks/useDroppable.ts` — Drop zone registration and hover feedback
- `src/hooks/useAutoScroll.ts` — Edge detection and scroll animation for scroll containers
- `src/hooks/useLayoutMeasurement.ts` — Platform-aware element measurement
- `src/collision/rectIntersection.ts` — Center-point check, falls back to intersection ratio (10% threshold)
- `src/components/sortable-shared/useSortableContainer.ts` — Position tracking, heights, prefix sums, reorder callbacks

### Sortable System
Three implementations sharing infrastructure in `sortable-shared/`:

| Component | Use Case |
|---|---|
| `SortableListBase` | Manual `itemSize` prop, fixed or scroll mode |
| `AutoSortable` (exported as `SortableList`) | Auto-measures item heights, delegates to SortableListBase |
| `SortableFlatList` | FlatList-based virtualization for large lists |

`DraggableList` + `DraggableListGroup` enable cross-list drag & drop.

### Portal System
Optional `PortalProvider` renders drag overlays above modals/sheets via absolute positioning (z-index 99999). Without it, overlays render inline inside DndContext.

### Web Compatibility
- `mouseButton(1)` on pan gesture (left click only)
- `getBoundingClientRect()` for layout measurement (more reliable than `measure()` on web)
- Window scroll offset compensation (`window.scrollX/scrollY`)
- State reset in both `onEnd` and `onFinalize` to prevent stuck dragging state

## Public API

**Components:** `DndProvider`, `Draggable`, `DragHandle`, `Droppable`, `SortableList`, `SortableFlatList`, `DraggableList`, `DraggableListGroup`

**Hooks:** `useDraggable`, `useDroppable`, `useDndContext`

**Collision:** `rectIntersection`

**Animations:** `dragEffects` (`pickup`, `scaleUp`, `scaleDown`, `bounce`)

**Utils:** `isWeb`, `isIOS`, `isAndroid`, sortable helpers (`listToPositions`, `objectMove`, `reorderData`, etc.), height utilities (`resolveItemSizes`, `buildPrefixSum`, etc.)

## Dependencies

Peer dependencies (must be installed by consumer):
- `react` (>=18.0.0)
- `react-native` (>=0.72.0)
- `react-native-reanimated` (>=3.0.0)
- `react-native-gesture-handler` (>=2.10.0)

## Git Workflow

**Direct pushes to `main` are not allowed.** All changes go through pull requests.

### Branch → PR → Squash Merge

1. Create a feature branch: `git checkout -b feat/haptic-feedback`
2. Make commits with any messages during development
3. Open a PR against `main`
4. Squash merge with a **conventional commit message** as the merge title

### Commit Convention (determines version bump)

| Prefix | Bump | Example |
|---|---|---|
| `fix:` or `fix(scope):` | patch (0.1.0 → 0.1.1) | `fix: overlay clipping in ScrollView` |
| `feat:` or `feat(scope):` | minor (0.1.0 → 0.2.0) | `feat: add haptic feedback on drop` |
| `feat!:` or `BREAKING CHANGE` | major (0.1.0 → 1.0.0) | `feat!: rename SortableList props` |
| `docs:`, `ci:`, `chore:`, `refactor:` | no publish | `docs: update README examples` |

### CI Pipeline

On every push/PR to `main`:
- **CI** (`publish.yml`) — type check + build

### Release Pipeline (release-please)

On every push to `main`:
1. **release-please** scans conventional commits since last release
2. Opens/updates a **Release PR** with version bump + `CHANGELOG.md`
3. When you merge the Release PR:
   - Creates a git tag (e.g. `v0.2.0`)
   - Creates a GitHub Release with changelog
   - Auto-publishes to npm

Non-publishing prefixes (`docs:`, `ci:`, `chore:`, etc.) don't trigger a Release PR.

## Testing

No automated tests. Test manually across platforms.

Key scenarios:
- Drag an item and drop on a valid zone
- Drag an item and release outside any zone (should animate back)
- Sortable list reordering (fixed and scroll modes)
- Cross-list drag with DraggableListGroup
- On web: verify items don't get stuck in dragging state

## Design Context

### Users
React Native developers building iOS, Android, and Web apps who need drag-and-drop functionality. They value correctness, performance, and clear APIs over flashy visuals. They're evaluating the library through its docs, example app, and interactive demos — confidence in reliability is key.

### Brand Personality
**Technical, precise, reliable.** The library should feel like a well-engineered tool — no-nonsense, trustworthy, and built for developers who care about quality. Communication is direct and clear, never marketing-heavy.

### Aesthetic Direction
- **Visual tone**: Technical & functional — information-dense, utility-focused, dev-tool aesthetic
- **Theme**: Dark-first (default `#0a0a0a` background), light mode available
- **Primary accent**: `#3b82f6` (blue) — used consistently for interactive elements and highlights
- **Typography**: System fonts for body, `monospace` for code, logos, and technical labels. Bold weight hierarchy (800 for headings, 600-700 for labels, 400-500 for body).
- **Reference**: [dnd-kit.com](https://dnd-kit.com) — clean developer docs with interactive demos
- **Anti-patterns**: Avoid marketing fluff, decorative gradients, excessive animations, or playful/casual tone. No generic "SaaS landing page" aesthetics.

### Existing Color System
```
Dark mode:  bg #0a0a0a, surface #141414, border #262626, text #fafafa/#a1a1aa, accent #3b82f6
Light mode: bg #fafafa, surface #ffffff, border #e5e5e5, text #0a0a0a/#71717a, accent #3b82f6
Semantic:   textInverse #ffffff, dim #6b6b6b, accentBg rgba(59,130,246,0.06), accentBgHover rgba(59,130,246,0.1)
Accents:    purple #8b5cf6, teal #14b8a6, orange #f97316, green #22c55e, red #ef4444
```

### Accessibility
WCAG AA compliance: adequate color contrast ratios, keyboard navigation support, screen reader basics, respect `prefers-reduced-motion`.

### Design Principles
1. **Clarity over cleverness** — Every UI element should communicate its purpose immediately. Prefer explicit labels, clear hierarchy, and predictable layouts.
2. **Show, don't tell** — Interactive demos and live code examples are more valuable than paragraphs of explanation. Let the library speak through its behavior.
3. **Performance is visible** — Smooth 60fps animations, instant feedback on drag gestures, and snappy transitions aren't just technical goals — they're the primary design language.
4. **Minimal footprint** — The library provides logic and animation; consuming apps own styling. Default styles should be functional and unobtrusive, never opinionated.
5. **Platform-native feel** — Respect each platform's conventions. Shadows on iOS, elevation on Android, cursor changes on web. Don't fight the platform.
