# Changelog

## 0.4.0

- Inline editing for queued messages: ✎ turns the row into an input; Enter saves, Escape cancels.
- Queue edits support text-only content; rows with attachments stay read-only with a visible reason.
- Queue edit failures surface inline instead of only in logs.

## 0.3.9

- Give all three themes full-page backgrounds: iOS mesh + dot grid, QQ Space sky/clouds, Hacker grid + green glow.

## 0.3.8

- Give QQ Space and Hacker themes their own typing indicators: a blue chat bubble and a terminal prompt with a blinking block cursor.

## 0.3.7

- Persist composer drafts per session in localStorage so a card remount or page refresh no longer loses typed text.

## 0.3.6

- Keep the archived shelf visible but collapsed by default; the summary counter and shelf header both toggle it.

## 0.3.5

- Add icons to all four summary counters.
- Make the archived counter clickable: opens an archived shelf with restore actions.

## 0.3.4

- Show the archived-session count in the wall summary: `会话 / 置顶 / 待处理 / 归档`.

## 0.3.3

- Filter `workspaces.archivedSessionIds` out of the wall: archived sessions no longer remain as cards even though `sessions.list` still contains them.

## 0.3.2

- Archive now handles `workspace/session-active`: asks whether to stop running work and retries with `stopActivity: true`.
- Archive/fork/rename failures show a visible inline card error instead of only a log entry.

## 0.3.1

- Isolate render crashes per card: one broken card no longer takes down the whole wall.
- Harden model-directory subscriptions and retained-session readiness.
- Cap automatic history paging as a runaway-loop safeguard.

## 0.3.0

- Add a per-card action menu: open original, inline rename, fork, archive.
- Archive asks for confirmation and logs failures.

## 0.2.2

- Move the model picker from the wall status bar into each card's meta row, so every session switches its own model.
- Card model control uses a compact native select, avoiding clipping inside the card.

## 0.2.1

- Re-enable the macOS/Electron undici `setTypeOfService EINVAL` guard by default; `DSH_TOPIC_WALL_TOS_GUARD=0` opts out.
- Add current-model chip and provider/model dropdown in the top bar.
- Composer is now a multiline textarea with the image and send buttons inside the field.
- Settings error dot now tracks only unread errors.

## 0.2.0

- Three theme styles: iOS, QQ Space (Qzone), Hacker, with fixed accent colors.
- Unified card spacing, pinned sizing, radius, and settings panel dimensions across themes.
- New chat button in every workspace group; creates via `workspaceId` and stays on the wall.
- Recent-history policy: auto-load the latest 24 hours; older history loads on demand.
- Image attachments in card composer: picker, drag/drop, paste, previews, image history.
- Tool results grouped and lazily rendered; artifact cards for `deliverables/presented`.
- Approval cards breathe with the theme accent; long approval text scrolls on hover and expands on click.
- iMessage-inspired live message animations for the iOS theme.
- macOS/Electron undici TOS guard is now opt-in via `DSH_TOPIC_WALL_TOS_GUARD=1`.
- Added MIT license and static smoke test (`npm test`).
