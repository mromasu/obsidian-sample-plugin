import { App, Component, MarkdownView, TFile } from "obsidian";
import { buildRenderingChain, ChainSegment } from "./graph/BranchDetector";
import { EmbeddableMarkdownEditor } from "./views/embeddededitor";
import type ChainPlugin from "./main";

/**
 * Helper function to read a note's content and strip away the YAML frontmatter.
 * We want to display ONLY the markdown content in the embedded editor, not the metadata.
 * 
 * @param app - The Obsidian App instance
 * @param path - The file path of the note to read
 * @returns The clean markdown content without frontmatter
 */
async function extractNoteContent(app: App, path: string): Promise<{ content: string; yaml: string }> {
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
        return { content: "", yaml: "" };
    }

    // Read the file from cache for performance
    const rawContent = await app.vault.cachedRead(file);

    // Regex to match YAML frontmatter (content between --- and --- at the start of file)
    const yamlRegex = /^---\n([\s\S]*?)\n---/;
    const match = rawContent.match(yamlRegex);
    const yaml = match ? match[1] : "";

    // Replace frontmatter with empty string and trim whitespace
    const sanitized = rawContent.replace(yamlRegex, "").trim();

    return { content: sanitized, yaml };
}

/**
 * Creates a single embedded editor instance and injects it into the DOM.
 * 
 * @param app - The Obsidian App instance
 * @param parent - The parent Component (usually the Plugin) to manage lifecycle
 * @param container - The HTML element where this editor should be placed
 * @param content - The markdown content to display
 * @param sourcePath - The path of the note being displayed (for navigation)
 */
async function createEmbeddedEditor(
    app: App,
    parent: Component,
    container: HTMLElement,
    content: string,
    sourcePath: string
): Promise<void> {

    // 2. Create the container for the actual editor
    const editorContainer = container.createDiv({ cls: "chain-embedded-editor" });

    // 3. Instantiate the EmbeddableMarkdownEditor
    // This is our custom wrapper around Obsidian's internal editor
    const editor = new EmbeddableMarkdownEditor(app, editorContainer, {
        value: content,
        onBlur: (editor) => {
            // Callback when editor loses focus.
            // Currently we don't save changes back to disk automatically.
            // To implement saving, we would need to:
            // 1. Read the original file again
            // 2. Replace the body content while preserving frontmatter
            // 3. Write back to file
        }
    });

    // 4. Register the editor as a child component
    // This ensures that when the plugin is unloaded or view is cleared,
    // the editor is properly destroyed to prevent memory leaks.
    parent.addChild(editor as any);
}

/**
 * Main function to render the chain view.
 * It finds the previous and next notes, creates embedded editors for them,
 * and injects them into the current MarkdownView's DOM.
 * 
 * @param plugin - The plugin instance
 * @param view - Optional specific view to render into (defaults to active view)
 */
export const renderChainView = async (plugin: ChainPlugin, view?: MarkdownView) => {
    // Get the view to render into
    const activeView = view || plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;

    // Get the file currently being viewed
    const currentFile = activeView.file;
    if (!currentFile) return;

    const { containerEl } = activeView;
    const mode = activeView.getMode();

    // SAFETY CHECK: Only work in 'source' mode (Edit mode)
    // Preview mode has a completely different DOM structure and rendering pipeline.
    if (mode !== "source") {
        // If we switched to preview mode, clean up our injected elements
        const existing = containerEl.querySelectorAll(".chain-thread-container");
        existing.forEach(el => el.remove());
        return;
    }

    // FIND THE INJECTION POINT
    // The .cm-sizer is the container inside CodeMirror that holds the content.
    // We inject our editors directly into this container.
    const cmSizer = containerEl.querySelector(".cm-sizer");
    if (!cmSizer) return;

    // CLEANUP: Remove any existing injected views to avoid duplicates
    // This runs every time we re-render (e.g. when switching files)
    const existing = cmSizer.querySelectorAll(".chain-thread-container");
    existing.forEach(el => el.remove());

    // BUILD THE RENDERING CHAIN using branching logic
    const chainSegments = buildRenderingChain(plugin.graph, currentFile.path);

    // INJECTION LOGIC:
    // The .cm-sizer has 3 default children:
    // [0] .cm-gutters (line numbers)
    // [1] .cm-layer (selection/cursor layer)
    // [2] .cm-contentContainer (the actual document content)

    const contentContainerIndex = 2; // .cm-contentContainer is at index 2
    let insertionIndex = contentContainerIndex;

    for (let i = 0; i < chainSegments.length; i++) {
        const segment = chainSegments[i];

        // Skip the active note itself (it's already rendered)
        if (segment.path === currentFile.path) {
            insertionIndex++; // Move past the content container
            continue;
        }

        const { content, yaml } = await extractNoteContent(plugin.app, segment.path);

        // Create a container for this note
        const container = document.createElement("div");

        // Determine if this should be rendered BEFORE or AFTER active note
        const isPrevNote = i < chainSegments.findIndex(s => s.path === currentFile.path);

        // Apply CSS classes
        const baseClass = isPrevNote ? "chain-prev" : "chain-next";
        const replyClass = segment.isReply ? "chain-reply" : "";
        container.className = `chain-thread-container ${baseClass} ${replyClass}`.trim();

        // Create the editor inside it
        await createEmbeddedEditor(plugin.app, plugin, container, content, segment.path);

        // Insert the container
        if (isPrevNote) {
            // Insert BEFORE the content container
            if (cmSizer.children.length > insertionIndex) {
                cmSizer.insertBefore(container, cmSizer.children[insertionIndex]);
            } else {
                cmSizer.appendChild(container);
            }
            insertionIndex++; // Adjust for next insertion
        } else {
            // Insert AFTER the content container
            if (cmSizer.children.length > insertionIndex) {
                cmSizer.insertBefore(container, cmSizer.children[insertionIndex]);
            } else {
                cmSizer.appendChild(container);
            }
            insertionIndex++; // Adjust for next insertion
        }
    }
};