# Changes in this branch

Seven commits on top of `upstream/main`. Two of them fix defects that stop a
fresh checkout from building at all. The rest make the client work against a
server that serves video behind an authenticated route, fix three problems in
the feed player, stop a class of broken upload, and extend the share sheet.

Nothing here is instance-specific: no branding, no fixed hostname, no EAS
project, no app identifiers.

---

## 1. Add the DM components that the messages screen imports

`fbde698` · 4 files, new

`src/app/private/messages/[id].tsx` imports `dmGroupHelpers`,
`GroupInfoSheet`, `ImageViewer` and `BottomSheetModal`. None of those files are
in the tree, so the screen cannot resolve its imports. This adds them.

Worth checking against your own copy — it looks like they were meant to be part
of an earlier commit and were never added.

## 1b. Sync package-lock.json with package.json

`836d606` · 1 file

`npm ci` refuses to install:

```
npm ci can only install packages when your package.json and
package-lock.json are in sync.
Missing: @react-native/metro-config@0.85.3 from lock file
Missing: @react-native/metro-babel-transformer@0.85.3 from lock file
Missing: @react-native/babel-preset@0.85.3 from lock file
Missing: @react-native/babel-plugin-codegen@0.85.3 from lock file
```

A clean checkout cannot be installed, and an EAS build fails in the
install-dependencies phase before it reaches anything else.

Regenerated with `npm install`. Only the lock file changes; `package.json` is
untouched.

## 2. Send the access token with media requests

`f860dd4` · 13 files

When media sits behind an authenticated route, the request itself has to carry
the OAuth token. Native players (expo-video, ExoPlayer, AVPlayer) and
expo-image both accept a `headers` field on their source object, so the token
travels there rather than in the URL.

`mediaSource()` wraps a URL into such a source, and attaches the header only
when **both** hold: the URL points at the instance the user is currently signed
in to, and it uses https.

That condition matters. A federated video (`is_local: false`) has a `src_url`
on a foreign server; attaching the header unconditionally would hand that
server the user's access token. Requiring https keeps the token off plaintext
connections.

The remaining files in this commit switch their media URLs over to it.

## 3. Load profile thumbnails with a component that forwards headers

`6ab505c` · 1 file

The profile grid used React Native's `Image`, which did not carry the
`Authorization` header, so thumbnails behind the authenticated route came back
401 and the grid stayed blank. Everything else in the app already used
`expo-image`.

Measured on a live instance: the phone browser fetched the same thumbnails with
29 of 29 requests succeeding, while the app's own requests failed.

## 4. Fix feed scrolling, buffering and seeking

`67481b4` · 2 files

Three separate problems in the same screen.

**Scrolling stopped between two videos.** The list snapped by the measured
container height while each item rendered at the full window height. The
difference is the height of the tab bar, so every swipe stopped that much
short, leaving a strip of the previous video on screen while the next one
played. `VideoPlayer` was already handed an `itemHeight` prop and never used
it. `pagingEnabled` is also dropped, since React Native treats it as mutually
exclusive with `snapToInterval`.

**Every mounted player pulled its whole file at once.** A player starts
buffering as soon as it has a source, and `windowSize` decides how many are
mounted, so scrolling meant several complete downloads in flight competing with
the video actually on screen. Measured on one instance: up to eight concurrent
full downloads, 44 MB a minute for a library totalling 112 MB. `bufferOptions`
now cap the read-ahead and `windowSize` drops from 3 to 2.

**The scrub bar did nothing.** The pan gesture was lost to the surrounding
vertical list before it ever reached the handler; it now claims horizontal
movement through `activeOffsetX` and hands vertical swipes back through
`failOffsetY`. Tapping the bar seeks too, both as the expected behaviour and as
a fallback. Seeking happens while dragging rather than on release, and the
chosen position is held until playback resumes — a paused player emits no
progress events, so the thumb used to snap back to the old position. Progress
events are only emitted while the controls are visible: they default to off in
expo-video, and leaving them on re-rendered the whole component several times a
second for every mounted player.

## 5. Stop uploading empty or truncated videos

`27c1a2b` · 2 files

A 28-byte file once reached the server, which rejected it correctly — the
upload had been a real video of several megabytes.

`Video.compress` can resolve with a path to a stub file when a transcode is
interrupted: the app backgrounded, storage full, a codec failure. It does not
throw, and the result was returned unchecked. The upload then verified only
that the file existed, never its size.

Now the compressed result is discarded in favour of the original when it is
implausibly small, and the upload refuses anything under 1 KB with a message
that says what happened.

## 6. Add download and copy-link to the share sheet

`8327bd4` · 1 file

The sheet offered a single entry, the native share.

**Download** saves the video to the gallery, and appears only when the server
reports `permissions.can_download` for that video, so the uploader's setting is
respected rather than bypassed. Because the file sits behind the authenticated
route, the download carries the same headers the player uses — a plain URL
fetch would return 401 instead of a video. The staging copy in the cache is
removed once the gallery has its own.

**Copy link** puts the share URL on the clipboard.

---

## Note on dependencies

`package.json` is untouched; only the lock file is regenerated, and only to
match it. The features here rely on `expo-clipboard`,
`expo-file-system`, `expo-media-library`, `expo-haptics`, `expo-image` and
`react-native-gesture-handler`, all of which are already dependencies.
