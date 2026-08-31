import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const dir = import.meta.dirname;

describe("companion mobile shell", () => {
  test("does not import the desktop stylesheet that locks min-width 900px", () => {
    const source = readFileSync(join(dir, "main.tsx"), "utf8");
    expect(source).not.toMatch(/app\/styles\.css/);
  });

  test("lets the phone viewport scroll instead of clipping a 900px desktop shell", () => {
    const css = readFileSync(join(dir, "styles.css"), "utf8");
    // Responsive `@media (min-width: ...)` breakpoints are fine. What breaks
    // phones is a hard `min-width: 900px` on an element (a desktop shell lock),
    // so assert the element rules outside media queries never do that.
    const outsideMedia = css.replace(/@media[^{]*\{[^}]*\}/g, "");
    expect(outsideMedia).not.toMatch(/min-width:\s*900px/);
    expect(css).toMatch(/min-width:\s*0/);
    expect(css).toMatch(/overflow:\s*auto/);
  });

  test("keeps the mobile composer text-input friendly and terminal styled", () => {
    const css = readFileSync(join(dir, "styles.css"), "utf8");
    const app = readFileSync(join(dir, "App.tsx"), "utf8");
    const html = readFileSync(join(dir, "..", "companion.html"), "utf8");

    expect(css).toMatch(/\.companion-text-input/);
    expect(css).toMatch(/\.companion-composer-utility/);
    expect(css).toMatch(/\.companion-shell\s*\{[\s\S]*height:\s*100dvh;[\s\S]*overflow:\s*hidden/);
    expect(css).toMatch(/\.companion-shell\.is-session \.companion-composer[\s\S]*align-items:\s*center/);
    expect(css).toMatch(/\.companion-shell\.is-session \.companion-composer[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 40px/);
    expect(css).toMatch(/--keyboard-inset/);
    expect(css).toMatch(/padding-bottom:\s*max\(var\(--safe-bottom\), var\(--keyboard-inset, 0px\)\)/);
    expect(css).toMatch(/scroll-padding-bottom:\s*calc\(max\(0px, calc\(72px - var\(--keyboard-inset, 0px\)\)\) \+ var\(--safe-bottom\)\)/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(app).toMatch(/inputMode="text"/);
    expect(app).toMatch(/placeholder="输入消息"/);
    expect(app).toMatch(/onInput=\{resizeMessageInput\}/);
    expect(app).toMatch(/wrap="soft"/);
    expect(app).toMatch(/input\.scrollHeight/);
    expect(css).toMatch(/\.companion-text-input\s*\{[\s\S]*white-space:\s*pre-wrap[\s\S]*word-break:\s*break-word/);
    expect(app).toMatch(/visualViewport/);
    expect(app).toMatch(/scrollIntoView\(\{ block: "nearest", inline: "nearest" \}\)/);
    expect(app).toMatch(/groupTimelineTools/);
    expect(app).toMatch(/category !== "todo"/);
    expect(app).toMatch(/companion-terminal-tool-group/);
    expect(css).toMatch(/\.companion-terminal-tool-details\s*\{[\s\S]*max-height:\s*160px[\s\S]*overflow:\s*auto/);
    expect(app).not.toMatch(/companion-voice|native-dictation|按住|Grid3X3/);
    expect(app).not.toMatch(/\bSmile\b/);
    expect(app).toMatch(/requestFullscreen/);
    expect(html).toMatch(/rel="manifest" href="\/companion-manifest\.json"/);
    // Keep text entry native/private; do not silently substitute a browser
    // recognition service for it.
    expect(app).not.toMatch(/SpeechRecognition/);
  });

  test("centers the session name and moves project context above chat on phones", () => {
    const css = readFileSync(join(dir, "styles.css"), "utf8");
    const app = readFileSync(join(dir, "App.tsx"), "utf8");

    expect(app).toMatch(/companion-connection-label-text/);
    expect(app).toMatch(/companion-session-meta[^>]*>\{session\.name && session\.name !== "\?" \? session\.name : "Untitled session"\}/);
    expect(app).toMatch(/companion-terminal-timeline[\s\S]*?companion-composer-dock[\s\S]*?companion-terminal-project[\s\S]*?<ProjectPickerButton/);
    expect(app).toMatch(/companion-composer-dock[\s\S]*?companion-terminal-toolbar[\s\S]*?className="companion-composer"/);
    expect(app).toMatch(/<CompanionModelPicker/);
    expect(app).toMatch(/client\.request<string \| undefined>\("getGitBranch", \[sessionCwd\]\)/);
    expect(app).toMatch(/branchName=\{branchName\}/);
    expect(app).not.toMatch(/<select[\s\S]*?aria-label="Model"/);
    expect(css).toMatch(/\.companion-session-main\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) auto/);
    expect(css).toMatch(/\.companion-shell\.is-session \.companion-terminal-timeline\s*\{[\s\S]*overflow-x:\s*hidden[\s\S]*overflow-y:\s*auto/);
    expect(css).toMatch(/\.companion-terminal-content \.markdown pre\s*\{[\s\S]*white-space:\s*pre-wrap[\s\S]*word-break:\s*break-word/);
    expect(css).toMatch(/\.companion-model-popover\s*\{[\s\S]*?bottom:\s*calc\(100% \+ 8px\)/);
    expect(css).toMatch(/--terminal-prompt:\s*#72d572/);
    expect(css).toMatch(/color-scheme:\s*dark/);
    expect(css).toMatch(/\.companion-shell\.is-session\s*\{[\s\S]*--surface-center:\s*#080909/);
    expect(css).toMatch(/\.companion-shell\.is-mobile,\s*\.companion-shell\.is-changes\s*\{[\s\S]*--surface-center:\s*#080909/);
    expect(css).toMatch(/\.companion-view-toggle\s*\{[\s\S]*position:\s*absolute[\s\S]*right:\s*56px/);
    expect(css).toMatch(/\.companion-shell\.is-mobile \.companion-main\s*\{\s*touch-action:\s*pan-y/);
    expect(css).toMatch(/html, body, #root\s*\{[\s\S]*overflow-x:\s*hidden/);
    expect(css).toMatch(/\.companion-main\s*\{[\s\S]*overflow-x:\s*hidden[\s\S]*overscroll-behavior-x:\s*none/);
    expect(app).toMatch(/companion-shell\$\{!isWide \? " is-mobile"/);
    expect(app).toMatch(/const PHONE_QUERY = "\(pointer: coarse\) and \(hover: none\)";/);
    expect(app).toMatch(/const isPhone = useMediaQuery\(PHONE_QUERY\);/);
    expect(app).toMatch(/const usesSideChanges = isXWide && !isPhone;/);
    expect(app).toMatch(/const mainTab: Tab = usesSideChanges \? "session" : tab;/);
    expect(app).not.toMatch(/<nav className="companion-tabs">/);
    expect(app).toMatch(/onTouchStart=\{handleViewTouchStart\}/);
    expect(app).toMatch(/onTouchEnd=\{handleViewTouchEnd\}/);
    expect(app).toMatch(/companion-view-toggle/);
    expect(app).toMatch(/wideChangesOpen/);
    expect(app).toMatch(/changesOpen/);
    expect(app).toMatch(/changes\.length > 0/);
    expect(app).toMatch(/mainTab === "session" \? " is-session" : " is-changes"/);
    expect(app).toMatch(/usesSideChanges && wideChangesOpen && changes\.length > 0/);
    expect(app).toMatch(/<aside className="companion-side">/);
    expect(css).toMatch(/\.companion-shell\.is-changes\s*\{/);
    expect(css).toMatch(/@media \(min-width: 900px\)[\s\S]*?\.companion-side\s*\{[\s\S]*display:\s*flex/);
    expect(css).toMatch(/\.companion-view-toggle\s*\{[\s\S]*background:\s*#080909/);
    expect(css).toMatch(/\.companion-view-toggle:hover,[\s\S]*\.companion-view-toggle:focus-visible[\s\S]*background:\s*#080909/);
    expect(app).not.toMatch(/: "Projects"/);
    expect(app).toMatch(/client\.request<ModelOption\[\]>\("getModels"\)/);
    expect(app).toMatch(/availableModels\[0\]\.id/);
    expect(app).toMatch(/disabled=\{!session\.sessionId\}/);
    expect(app).not.toMatch(/if \(!isWide\) \{[\s\S]*setIsFullscreen/);
    expect(app).toMatch(/document\.exitFullscreen\(\)/);
    expect(app).toMatch(/document\.documentElement\.requestFullscreen\(\)/);
    expect(css).not.toMatch(/\.companion-shell\.is-mobile\.is-fullscreen\s*\{/);
    expect(app).not.toMatch(/previewPanel|previewNonce|Frontend preview/);
    expect(css).toMatch(/\.companion-shell\.is-session \.companion-model-trigger\s*\{\s*color:\s*var\(--terminal-prompt\)/);
    expect(css).toMatch(/@media \(max-width: 639px\)[\s\S]*?\.companion-shell\.is-session \.companion-status\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, auto\) minmax\(0, 1fr\)/);
    expect(css).toMatch(/@media \(max-width: 639px\)[\s\S]*?\.companion-shell\.is-mobile \.companion-status\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, auto\) minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.companion-shell\.is-session \.companion-session-meta\s*\{[\s\S]*?justify-self:\s*center/);
    expect(css).toMatch(/\.companion-shell\.is-session \.companion-terminal-project \.companion-project-picker-copy strong::before/);
    expect(css).toMatch(/\.companion-terminal-tool-event\s*\{[\s\S]*overflow-wrap:\s*normal[\s\S]*white-space:\s*nowrap/);
    expect(css).toMatch(/\.companion-terminal-tool-preview\s*\{[\s\S]*text-overflow:\s*ellipsis/);
    expect(css).toMatch(/\.companion-terminal-tool-toggle\s*\{[\s\S]*overflow:\s*hidden[\s\S]*white-space:\s*nowrap/);
    expect(app).toMatch(/companion-terminal-welcome-tips/);
    expect(app).toMatch(/Tips for getting started/);
    expect(css).toMatch(/@media \(min-width: 900px\)[\s\S]*?\.companion-terminal-welcome-grid\s*\{[\s\S]*?grid-template-columns/);
    expect(css).toMatch(/\.companion-terminal-welcome-tips\s*\{[\s\S]*?border-left:\s*1px solid var\(--accent-primary\)/);
  });

  test("renders Changes as a dark GitHub-style diff with a compact line-number gutter", () => {
    const css = readFileSync(join(dir, "styles.css"), "utf8");
    const app = readFileSync(join(dir, "App.tsx"), "utf8");
    const preview = readFileSync(join(dir, "DiffPreview.tsx"), "utf8");

    expect(app).toMatch(/<CompanionDiffPreview diff=\{change\.diff\} path=\{change\.path\} \/>/);
    expect(app).toMatch(/formatChangeFile\(change\.path, activeProjectPath\)/);
    expect(preview).toMatch(/parseDiffLines/);
    expect(preview).toMatch(/line\.newNumber \?\? line\.oldNumber/);
    expect(preview).toMatch(/formatChangeFile/);
    expect(preview).toMatch(/filter\(\(line\) => line\.kind !== "meta"\)/);
    expect(preview).toMatch(/formatHunkLabel/);
    expect(app).toMatch(/collapsedChanges/);
    expect(app).toMatch(/aria-expanded=\{expanded\}/);
    expect(app).toMatch(/companion-change-content/);
    expect(css).toMatch(/\.companion-diff\s*\{[\s\S]*background:\s*#0d1117/);
    expect(css).toMatch(/grid-template-columns:\s*42px 16px minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.companion-change-format\s*\{[\s\S]*color:\s*#79c0ff/);
    expect(css).toMatch(/\.companion-change-card\s*\{[\s\S]*border:\s*0/);
    expect(css).toMatch(/\.companion-change-header\s*\{[\s\S]*min-height:\s*38px[\s\S]*padding:\s*5px 8px[\s\S]*border:\s*1px solid var\(--border-subtle\)[\s\S]*border-radius:\s*9px/);
    expect(css).toMatch(/\.companion-change-content\s*\{[\s\S]*padding:\s*6px 0 4px/);
    expect(css).toMatch(/\.companion-diff-line\.is-addition\s*\{[\s\S]*rgba\(46, 160, 67/);
    expect(css).toMatch(/\.companion-diff-line\.is-deletion\s*\{[\s\S]*rgba\(248, 81, 73/);
    expect(css).toMatch(/\.companion-diff-line\.is-hunk\s*\{[\s\S]*rgba\(56, 139, 253/);
  });
});
