import { MultiGraph } from "graphology";

export type ChainNodeAttributes = {
    resolved: boolean;
    aliases?: string[];
}

export type ChainEdgeAttributes = {
    field: "prev";
    explicit: boolean;
}

export type ChainEdge = {
    id: string;
    attr: ChainEdgeAttributes;
    source_id: string;
    target_id: string;
    source_attr: ChainNodeAttributes;
    target_attr: ChainNodeAttributes;
};

export class ChainGraph extends MultiGraph<ChainNodeAttributes, ChainEdgeAttributes> {
    constructor() {
        super();
    }
    //============================================
    // Safe Operations
    //============================================

    //======================= Add Node =======================
    safe_add_node(id: string, attr: ChainNodeAttributes) {
        try {
            this.addNode(id, attr);
        } catch (e) {
            console.log(e);
        }
    }

    //======================= Rename Node =======================
    safe_rename_node(old_id: string, new_id: string) {
        if (!this.hasNode(old_id)) return;
        if (this.hasNode(new_id)) {
            console.warn(`Cannot rename ${old_id} to ${new_id}: Target exists.`);
            return;
        }

        // 1. Copy Node Attributes
        const attr = this.getNodeAttributes(old_id);
        this.addNode(new_id, attr);

        // 2. Move In-Edges (Links pointing TO the file)
        this.forEachInEdge(old_id, (edge, attr, source, target) => {
            if (source === old_id) { // Self-loop
                this.addDirectedEdge(new_id, new_id, attr);
            } else {
                this.addDirectedEdge(source, new_id, attr);
            }
        });

        // 3. Move Out-Edges (Links pointing FROM the file)
        this.forEachOutEdge(old_id, (edge, attr, source, target) => {
            if (target === old_id) { // Self-loop
                // handled in In-Edge loop usually
            } else {
                this.addDirectedEdge(new_id, target, attr);
            }
        });

        // 4. Drop Old Node
        this.dropNode(old_id);
    }

    //======================= Delete node =======================
    handle_delete(id: string) {
        if (!this.hasNode(id)) return;

        // Check if there are incoming edges (other files linking to this one)
        if (this.degree(id) > 0 && this.inDegree(id) > 0) {
            // It has incoming links, so it becomes an "unresolved" node
            this.setNodeAttribute(id, "resolved", false);
            this.removeNodeAttribute(id, "aliases"); // Aliases are gone with the file

            // Remove outgoing edges (since the file content is gone, it links to nothing)
            const edgesToDelete: string[] = [];
            this.forEachOutEdge(id, (edge) => edgesToDelete.push(edge));
            edgesToDelete.forEach(edge => this.dropEdge(edge));
        } else {
            // No one links to it, safe to drop completely
            this.dropNode(id);
        }
    }
};

