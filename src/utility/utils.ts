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
