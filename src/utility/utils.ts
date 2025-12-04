import { App, TFile } from "obsidian";

export const updateFrontmatter = async (app: App, file: TFile, newPrevLinks: string[]) => {
    await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
        if (newPrevLinks.length === 0) {
            delete frontmatter["prev"];
        } else if (newPrevLinks.length === 1) {
            frontmatter["prev"] = `[[${newPrevLinks[0]}]]`;
        } else {
            frontmatter["prev"] = newPrevLinks.map(link => `[[${link}]]`);
        }
    });
};

/**
 * Reconstructs file content by stitching YAML frontmatter back together with markdown content.
 * Handles edge cases where YAML or content might be empty.
 * 
 * @param content - The markdown content (without frontmatter)
 * @param yaml - The YAML frontmatter content (without --- delimiters)
 * @returns The complete file content with properly formatted frontmatter
 */
export const reconstructFileContent = (content: string, yaml: string): string => {
    // If no YAML frontmatter, return content only
    if (!yaml || yaml.trim() === "") {
        return content;
    }

    // If no content, return YAML only
    if (!content || content.trim() === "") {
        return `---\n${yaml}\n---`;
    }

    // Both present: properly format with separators and spacing
    return `---\n${yaml}\n---\n\n${content}`;
};
