import { ChainGraph } from "./GraphBuilder";
import { getNextNotes, getPrevNotes } from "./ChainQueries";

/**
 * Represents a chain segment with metadata
 */
export type ChainSegment = {
    path: string;
    isReply: boolean; // Whether this is the start of a reply branch
};

/**
 * Given an active note and the next notes, determine which is the main chain
 * and which are reply branches.
 * 
 * Strategy: The note with the EARLIEST creation date is the main chain.
 * All others are replies.
 */
export const classifyNextNotes = (
    graph: ChainGraph,
    activeNotePath: string,
    nextNotes: string[]
): { main: string | null; replies: string[] } => {
    if (nextNotes.length === 0) {
        return { main: null, replies: [] };
    }

    if (nextNotes.length === 1) {
        return { main: nextNotes[0], replies: [] };
    }

    // Multiple branches exist - use creation time to decide
    const notesWithTime = nextNotes.map(path => {
        const attrs = graph.getNodeAttributes(path);
        return {
            path,
            createdTime: attrs.createdTime || 0
        };
    });

    // Sort by creation time (earliest first)
    notesWithTime.sort((a, b) => a.createdTime - b.createdTime);

    // First is main, rest are replies
    const main = notesWithTime[0].path;
    const replies = notesWithTime.slice(1).map(n => n.path);

    return { main, replies };
};

/**
 * Build the rendering chain from the active note.
 * This traces through the main chain and identifies reply branches.
 * 
 * @param graph - The chain graph
 * @param activeNotePath - The currently active note
 * @returns Array of chain segments with metadata
 */
export const buildRenderingChain = (
    graph: ChainGraph,
    activeNotePath: string
): ChainSegment[] => {
    const chain: ChainSegment[] = [];
    const visited = new Set<string>();

    // Start from the active note's previous chain
    let current = activeNotePath;

    // Step 1: Walk backward to find the start of the chain
    const backwardChain: string[] = [];
    while (true) {
        const prevNotes = getPrevNotes(graph, current);
        if (prevNotes.length === 0) break;

        const prev = prevNotes[0]; // Take first prev
        if (visited.has(prev)) break;

        backwardChain.unshift(prev);
        visited.add(prev);
        current = prev;
    }

    // Add backward chain to result
    for (const path of backwardChain) {
        chain.push({ path, isReply: false });
    }

    // Step 2: Add active note
    chain.push({ path: activeNotePath, isReply: false });
    visited.add(activeNotePath);

    // Step 3: Walk forward following the main branch
    current = activeNotePath;
    const replyBranches: ChainSegment[][] = [];

    while (true) {
        const nextNotes = getNextNotes(graph, current);
        if (nextNotes.length === 0) break;

        const { main, replies } = classifyNextNotes(graph, current, nextNotes);

        // Handle reply branches
        for (const replyStart of replies) {
            const replyChain = buildReplyChain(graph, replyStart, visited);
            replyBranches.push(replyChain);
        }

        // Continue with main branch
        if (!main || visited.has(main)) break;

        chain.push({ path: main, isReply: false });
        visited.add(main);
        current = main;
    }

    // Step 4: Append all reply branches at the end
    for (const replyChain of replyBranches) {
        chain.push(...replyChain);
    }

    return chain;
};

/**
 * Build a reply chain starting from a reply node
 */
const buildReplyChain = (
    graph: ChainGraph,
    startPath: string,
    visited: Set<string>
): ChainSegment[] => {
    const chain: ChainSegment[] = [];
    let current = startPath;

    // Mark the first node as a reply
    chain.push({ path: current, isReply: true });
    visited.add(current);

    // Follow the chain forward
    while (true) {
        const nextNotes = getNextNotes(graph, current);
        if (nextNotes.length === 0) break;

        const { main } = classifyNextNotes(graph, current, nextNotes);

        if (!main || visited.has(main)) break;

        chain.push({ path: main, isReply: false }); // Only first is marked as reply
        visited.add(main);
        current = main;
    }

    return chain;
};

/**
 * Given an active note, determine if we should hide certain branches.
 * 
 * If the active note is in a "reply" branch (not the oldest child of its parent),
 * we should hide sibling branches.
 */
export const shouldHideSiblings = (
    graph: ChainGraph,
    activeNotePath: string
): boolean => {
    const prevNotes = getPrevNotes(graph, activeNotePath);
    if (prevNotes.length === 0) return false;

    const parent = prevNotes[0];
    const siblings = getNextNotes(graph, parent);

    if (siblings.length <= 1) return false;

    // Check if active note is the "main" (oldest) child
    const { main } = classifyNextNotes(graph, parent, siblings);

    // If active note is NOT the main branch, hide siblings
    return main !== activeNotePath;
};
