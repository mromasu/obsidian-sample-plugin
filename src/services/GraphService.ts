import { App, TFile, Events } from "obsidian";
import { ChainGraph } from "../graph/GraphBuilder";
import { buildChainGraph, updateNodeEdges } from "../graph/ChainQueries";
import { ChainHealer } from "../graph/ChainHealer";

/**
 * Centralized service for managing the chain graph.
 * 
 * This service:
 * 1. Owns the graph instance
 * 2. Handles all graph mutations (add, update, rename, delete)
 * 3. Emits events when the graph changes
 * 4. Coordinates chain healing after deletions
 */
export class GraphService extends Events {
    private app: App;
    private _graph: ChainGraph;
    private healer: ChainHealer;

    constructor(app: App) {
        super();
        this.app = app;
        this._graph = new ChainGraph();
        this.healer = new ChainHealer(this._graph, app);
    }

    /**
     * Get the current graph instance.
     */
    get graph(): ChainGraph {
        return this._graph;
    }

    /**
     * Initialize the graph by building it from all vault files.
     * Should be called once during plugin startup after layout is ready.
     */
    initialize(): void {
        console.log("GraphService: Initializing...");
        this._graph = buildChainGraph(this.app);
        this.healer = new ChainHealer(this._graph, this.app);
        console.log(`GraphService: Initialized with ${this._graph.order} nodes, ${this._graph.size} edges`);
    }

    /**
     * Rebuild the entire graph from scratch.
     * This is an expensive operation, use sparingly.
     */
    rebuild(): void {
        console.log("GraphService: Rebuilding graph...");
        this._graph = buildChainGraph(this.app);
        this.healer = new ChainHealer(this._graph, this.app);
        this.trigger("graph-updated");
    }

    /**
     * Update a single file's node and edges in the graph.
     * Called when file metadata changes.
     */
    updateFile(file: TFile): void {
        updateNodeEdges(this._graph, file, this.app);
        this.trigger("graph-updated", file.path);
    }

    /**
     * Handle a file rename.
     * Updates the graph node ID while preserving edges.
     */
    handleRename(oldPath: string, newPath: string): void {
        console.log(`GraphService: Renaming node ${oldPath} -> ${newPath}`);
        this._graph.safe_rename_node(oldPath, newPath);
        this.trigger("graph-updated", newPath);
    }

    /**
     * Handle a file deletion.
     * Heals broken chains and updates the graph.
     * 
     * @param file - The deleted file
     */
    async handleDelete(file: TFile): Promise<void> {
        const deletedPath = file.path;
        console.log(`GraphService: Handling deletion of ${deletedPath}`);

        // First, heal the chain (reconnect prev/next nodes)
        await this.healer.healAfterDelete(deletedPath);

        // Then remove the node from the graph
        this._graph.handle_delete(deletedPath);

        this.trigger("graph-updated");
    }

    /**
     * Check if a node exists in the graph.
     */
    hasNode(path: string): boolean {
        return this._graph.hasNode(path);
    }

    /**
     * Add a new file to the graph with a known prev edge.
     * This is used during note creation when we know the relationship
     * but the metadata cache may not be ready yet.
     * 
     * @param file - The newly created file
     * @param prevPath - The path of the file that this new file links to via "prev"
     */
    addFileWithEdge(file: TFile, prevPath: string): void {
        console.log(`GraphService: addFileWithEdge ${file.path} -> ${prevPath}`);

        // Add node if it doesn't exist
        if (!this._graph.hasNode(file.path)) {
            this._graph.safe_add_node(file.path, {
                resolved: true,
                createdTime: file.stat.ctime
            });
        }

        // Ensure prev node exists
        if (!this._graph.hasNode(prevPath)) {
            this._graph.safe_add_node(prevPath, {
                resolved: false
            });
        }

        // Add edge from new file to prev file (direction: newFile -> prevFile)
        this._graph.addDirectedEdge(file.path, prevPath, {
            field: "prev",
            explicit: true
        });

        this.trigger("graph-updated", file.path);
    }
}
