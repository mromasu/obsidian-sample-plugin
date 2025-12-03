import { MarkdownView } from "obsidian";
import { getPrevNotes, getNextNotes } from "./graph/ChainDetector";
import type ChainPlugin from "./main";

export const renderChainView = (plugin: ChainPlugin, view?: MarkdownView) => {
    const activeView = view || plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;

    const currentFile = activeView.file;
    if (!currentFile) return;

    const { containerEl } = activeView;

    // Create or reuse container
    let viewContainer = containerEl.querySelector(".chain-view") as HTMLElement;
    if (!viewContainer) {
        viewContainer = containerEl.createDiv({ cls: "chain-view" });
    }

    viewContainer.empty();

    // Get prev and next notes
    const prevNotes = getPrevNotes(plugin.graph, currentFile.path);
    const nextNotes = getNextNotes(plugin.graph, currentFile.path);

    // Render prev notes
    if (prevNotes.length > 0) {
        const prevDiv = viewContainer.createDiv({ cls: "chain-prev" });
        prevDiv.createEl("span", { text: "← Prev: " });
        prevNotes.forEach((path) => {
            const link = prevDiv.createEl("a", {
                text: path.replace(".md", ""),
                cls: "internal-link",
            });
            link.addEventListener("click", () => {
                plugin.app.workspace.openLinkText(path, currentFile.path);
            });
        });
    }

    // Render next notes
    if (nextNotes.length > 0) {
        const nextDiv = viewContainer.createDiv({ cls: "chain-next" });
        nextDiv.createEl("span", { text: "Next → " });
        nextNotes.forEach((path) => {
            const link = nextDiv.createEl("a", {
                text: path.replace(".md", ""),
                cls: "internal-link",
            });
            link.addEventListener("click", () => {
                plugin.app.workspace.openLinkText(path, currentFile.path);
            });
        });
    }

    // Insert into editor
    const scroller = containerEl.querySelector(".cm-scroller");
    if (scroller && viewContainer.parentElement !== scroller) {
        scroller.insertBefore(viewContainer, scroller.firstChild);
    }
};