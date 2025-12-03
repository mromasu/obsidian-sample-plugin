import { App, TFile } from "obsidian";
import { ChainGraph } from "./ChainGraph";

export const getAllFiles = (app: App) => {
    return app.vault.getMarkdownFiles().map((file) => ({
        file,
        cache: app.metadataCache.getFileCache(file),
    }))
}

export const buildChainGraph = (app: App): ChainGraph => {
    const graph = new ChainGraph();
    const allFiles = getAllFiles(app);

    allFiles.forEach((({ file, cache }) => {
        const nodeAttr = {
            resolved: true,
            aliases: cache?.frontmatter?.aliases as string[] | undefined,
        };

        graph.addNode(file.path, nodeAttr);
    }));

    allFiles.forEach(({ file: sourceFile, cache: sourceCache }) => {
        sourceCache?.frontmatterLinks?.forEach((link) => {
            const field = link.key.split(".")[0];
            if (field !== "prev") return;
            const targetFile = app.metadataCache.getFirstLinkpathDest(
                link.link,
                sourceFile.path
            );
            const targetPath = targetFile?.path ?? link.link + ".md";

            if (!targetFile) {
                graph.safe_add_node(targetPath, { resolved: false });
            }

            graph.addDirectedEdge(sourceFile.path, targetPath, {
                field: "prev",
                explicit: true,
            });
        });
    });

    return graph;
};

export const updateNodeEdges = (graph: ChainGraph, file: TFile, app: App) => {
    const cache = app.metadataCache.getFileCache(file);

    // 1. Ensure node exists (handle 'create' or 'modify' on missing node)
    if (!graph.hasNode(file.path)) {
        graph.addNode(file.path, { resolved: true, aliases: cache?.frontmatter?.aliases as string[] | undefined });
    } else {
        graph.setNodeAttribute(file.path, "resolved", true);
        graph.setNodeAttribute(file.path, "aliases", cache?.frontmatter?.aliases as string[] | undefined);
    }

    // 2. Clear existing outgoing edges
    const edgesToDelete: string[] = [];
    graph.forEachOutEdge(file.path, (edge) => edgesToDelete.push(edge));
    edgesToDelete.forEach(edge => graph.dropEdge(edge));

    // 3. Add new outgoing edges based on frontmatter
    cache?.frontmatterLinks?.forEach((link) => {
        if (link.key.split(".")[0] !== "prev") return;

        const targetFile = app.metadataCache.getFirstLinkpathDest(
            link.link,
            file.path
        );
        const targetPath = targetFile?.path ?? link.link + ".md";

        // Ensure target node exists (as unresolved if necessary)
        if (!graph.hasNode(targetPath)) {
            graph.safe_add_node(targetPath, { resolved: false });
        }

        graph.addDirectedEdge(file.path, targetPath, {
            field: "prev",
            explicit: true,
        });
    });
};
