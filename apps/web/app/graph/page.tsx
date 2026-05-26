"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { graphApi } from "@/lib/api";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import MemoryDetailModal from "@/components/modals/MemoryDetailModal";
import EdgeDetailModal from "@/components/modals/EdgeDetailModal";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

const NODE_COLORS: Record<string, string> = {
  decision: "#8083ff", preference: "#c0c1ff", bugfix: "#ffb4ab",
  pattern: "#bcc7de", architecture: "#d97721", lesson: "#4ade80",
  research: "#3b82f6", reference: "#f97316", constraint: "#a855f7", context: "#908fa0",
};

const EDGE_COLORS: Record<string, string> = {
  supersedes: "#f97316", contradicts: "#ef4444", depends_on: "#3b82f6",
  caused_by: "#a855f7", fixed_by: "#22c55e", enables: "#eab308",
  related_to: "#6b7280", consolidates: "#14b8a6",
};

export default function GraphPage() {
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState("");
  const [filterScope, setFilterScope] = useState<string[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterRelations, setFilterRelations] = useState<string[]>([]);
  const [depth, setDepth] = useState(2);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredNode, setHoveredNode] = useState<any>(null);

  // Load graph data
  useEffect(() => {
    setLoading(true);
    graphApi.getGraph({ limit: "120", depth: String(depth) })
      .then((d) => {
        setGraphData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [depth]);

  const formattedGraphData = useMemo(() => {
    const nodes = (graphData.nodes || []).map((n: any) => ({
      id: n.id,
      val: 18 + (n.access_count || 0) * 0.5,
      data: n,
    }));
    const links = (graphData.edges || []).map((e: any) => ({
      source: e.source || e.source_id,
      target: e.target || e.target_id,
      data: e,
    }));
    return { nodes, links };
  }, [graphData]);

  const filteredData = useMemo(() => {
    let nodes = formattedGraphData.nodes;
    let links = formattedGraphData.links;

    if (filterTypes.length > 0) {
      nodes = nodes.filter((n: any) => filterTypes.includes(n.data.memory_type));
    }
    if (filterProject) {
      nodes = nodes.filter((n: any) => n.data.project_id === filterProject);
    }
    if (filterScope.length > 0) {
      nodes = nodes.filter((n: any) => filterScope.includes(n.data.scope));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter((n: any) => (n.data.content || "").toLowerCase().includes(q));
    }

    const nodeIds = new Set(nodes.map((n: any) => n.id));
    links = links.filter((l: any) => {
      if (!nodeIds.has(l.source) || !nodeIds.has(l.target)) return false;
      if (filterRelations.length > 0) {
        return filterRelations.includes(l.data.relation_type);
      }
      return true;
    });

    return { nodes, links };
  }, [formattedGraphData, filterTypes, filterProject, filterScope, filterRelations, searchQuery]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node.data);
    setSelectedEdge(null);
  }, []);

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node ? node.data : null);
  }, []);

  const activeNodeEdges = selectedNode
    ? graphData.edges.filter(
        (e) => (e.source || e.source_id) === selectedNode.id || (e.target || e.target_id) === selectedNode.id
      )
    : [];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] leading-[38px] font-semibold tracking-tight">Graph Explorer</h1>
          <p className="text-[#c7c4d7] text-[14px] mt-1">Visualize memory relationships</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[#c7c4d7] text-[18px]">search</span>
            <input
              className="bg-[#0d0d15] border border-[#464554] rounded-sm py-1.5 pl-8 pr-3 text-[13px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff] placeholder-[#908fa0]"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <span className="text-[13px] text-[#908fa0]">
            {filteredData.nodes.length} nodes · {filteredData.links.length} edges
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap text-[11px]">
        {Object.entries(EDGE_COLORS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: v }} />
            <span className="text-[#c7c4d7] capitalize">{k.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Graph Canvas */}
        <div className="flex-1 bg-[#0d0d15] border border-[rgba(51,65,85,0.5)] rounded-lg relative overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner />
            </div>
          ) : filteredData.nodes.length === 0 ? (
            <EmptyState title="No graph data yet." message="Ingest conversations to build the graph." icon="hub" />
          ) : (
            <ForceGraph2D
              graphData={filteredData}
              nodeColor={(node: any) => NODE_COLORS[node.data?.memory_type] || "#908fa0"}
              nodeVal={(node: any) => node.val}
              nodeLabel={(node: any) => {
                const content = node.data?.content || "";
                return content.length > 100 ? content.slice(0, 100) + "..." : content;
              }}
              nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                const label = ((node.data?.content || node.id || "") as string).slice(0, 20);
                ctx.font = `${10 / globalScale}px 'JetBrains Mono'`;
                ctx.fillStyle = "#e4e1ed";
                ctx.textAlign = "center";
                ctx.fillText(label, node.x, node.y + (node.val || 5) + 14 / globalScale);
              }}
              nodeCanvasObjectMode={() => "after"}
              linkColor={(link: any) => EDGE_COLORS[link.data?.relation_type] || "#6b7280"}
              backgroundColor="#0d0d15"
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              width={undefined}
              height={undefined}
            />
          )}
        </div>

        {/* Right Panel */}
        <div className="w-[320px] bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg overflow-y-auto p-4 space-y-4">
          {selectedNode ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-semibold text-[#e4e1ed]">Node Details</h3>
                <button onClick={() => setSelectedNode(null)} className="text-[#c7c4d7] hover:text-[#e4e1ed]">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div>
                <span className="badge bg-[#c0c1ff]/10 border border-[#c0c1ff] text-[#c0c1ff] text-[11px]">{selectedNode.id?.slice(0, 12)}</span>
              </div>
              <p className="text-[14px] text-[#e4e1ed] leading-relaxed">{selectedNode.content}</p>
              <div className="flex flex-wrap gap-2">
                <span className={`badge border ${
                  selectedNode.memory_type === "decision" ? "bg-[#8083ff]/10 border-[#8083ff] text-[#8083ff]" :
                  selectedNode.memory_type === "bugfix" ? "bg-[#ffb4ab]/10 border-[#ffb4ab] text-[#ffb4ab]" :
                  "bg-[#bcc7de]/10 border-[#bcc7de] text-[#bcc7de]"
                }`}>{selectedNode.memory_type}</span>
                <span className="badge bg-[#34343d] border border-[#464554] text-[#c7c4d7]">{selectedNode.scope}</span>
                <span className={`badge border ${
                  selectedNode.status === "active" ? "bg-[#4ade80]/10 border-[#4ade80] text-[#4ade80]" :
                  "bg-[#d97721]/10 border-[#d97721] text-[#d97721]"
                }`}>{selectedNode.status}</span>
              </div>
              {selectedNode.confidence_score && (
                <div>
                  <div className="text-[11px] font-bold uppercase text-[#908fa0] mb-1">Confidence</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[14px] text-[#e4e1ed]">{selectedNode.confidence_score?.toFixed(2)}</span>
                    <div className="flex-1 h-1.5 bg-[#0d0d15] rounded-full overflow-hidden">
                      <div className="h-full bg-[#c0c1ff] rounded-full" style={{ width: `${(selectedNode.confidence_score || 0) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )}
              {selectedNode.tags && selectedNode.tags.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase text-[#908fa0] mb-1">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.tags.map((t: string) => (
                      <span key={t} className="badge bg-[#292932] border border-[#464554] text-[#c7c4d7] text-[10px]">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Connected edges */}
              <div>
                <div className="text-[11px] font-bold uppercase text-[#908fa0] mb-2">Connected Edges</div>
                <div className="space-y-2">
                  {activeNodeEdges.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 text-[12px] bg-[#292932] p-2 rounded-sm cursor-pointer hover:bg-[#334155]/40" onClick={() => setSelectedEdge(e)}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EDGE_COLORS[e.relation_type] || "#6b7280" }} />
                      <span className="text-[#c7c4d7] uppercase font-mono text-[10px]">{e.relation_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : selectedEdge ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-semibold text-[#e4e1ed]">Edge Details</h3>
                <button onClick={() => setSelectedEdge(null)} className="text-[#c7c4d7] hover:text-[#e4e1ed]">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: EDGE_COLORS[selectedEdge.relation_type] || "#6b7280" }} />
                <span className="badge border text-[11px] capitalize" style={{ borderColor: EDGE_COLORS[selectedEdge.relation_type] || "#6b7280", color: EDGE_COLORS[selectedEdge.relation_type] || "#6b7280" }}>
                  {selectedEdge.relation_type?.replace("_", " ")}
                </span>
              </div>
              <div className="bg-[#0d0d15] border border-[#464554] rounded-sm p-3 space-y-2">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#908fa0]">Source</span>
                  <span className="font-mono text-[#c7c4d7]">{selectedEdge.source || selectedEdge.source_id}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#908fa0]">Target</span>
                  <span className="font-mono text-[#c7c4d7]">{selectedEdge.target || selectedEdge.target_id}</span>
                </div>
                {selectedEdge.description && (
                  <p className="text-[13px] text-[#e4e1ed]">{selectedEdge.description}</p>
                )}
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#908fa0]">Confidence</span>
                  <span className="font-mono text-[#c7c4d7]">{(selectedEdge.confidence || 0).toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-[18px] font-semibold text-[#e4e1ed]">Filters</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-[#908fa0] block mb-1.5">Depth</label>
                  <input
                    type="range" min="1" max="3" step="1"
                    value={depth}
                    onChange={(e) => setDepth(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-[12px] text-[#c7c4d7] text-right">{depth} hop{depth > 1 ? "s" : ""}</div>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-[#908fa0] block mb-1.5">Memory Types</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(NODE_COLORS).map((t) => (
                      <button
                        key={t}
                        onClick={() => setFilterTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
                        className={`badge text-[10px] border transition-colors cursor-pointer ${
                          filterTypes.includes(t)
                            ? "bg-[#c0c1ff]/20 border-[#c0c1ff] text-[#c0c1ff]"
                            : "bg-[#292932] border-[#464554] text-[#c7c4d7] hover:bg-[#334155]/40"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-[#908fa0] block mb-1.5">Relation Types</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(EDGE_COLORS).map((t) => (
                      <button
                        key={t}
                        onClick={() => setFilterRelations((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
                        className={`badge text-[10px] border transition-colors cursor-pointer ${
                          filterRelations.includes(t)
                            ? "bg-[#c0c1ff]/20 border-[#c0c1ff] text-[#c0c1ff]"
                            : "bg-[#292932] border-[#464554] text-[#c7c4d7] hover:bg-[#334155]/40"
                        }`}
                      >
                        {t.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hover Tooltip */}
      {hoveredNode && (
        <div className="fixed bottom-4 left-4 bg-[#1e293b] border border-[#464554] rounded-lg p-3 shadow-xl max-w-sm z-50">
          <div className="text-[11px] font-bold uppercase text-[#908fa0] mb-1">{hoveredNode.memory_type}</div>
          <p className="text-[13px] text-[#e4e1ed] line-clamp-3">{hoveredNode.content}</p>
        </div>
      )}

      {/* Modals */}
      {selectedNode && (
        <MemoryDetailModal
          memoryId={selectedNode.id}
          onClose={() => setSelectedNode(null)}
        />
      )}
      {selectedEdge && (
        <EdgeDetailModal
          edge={selectedEdge}
          onClose={() => setSelectedEdge(null)}
          onDelete={(id) => {
            setGraphData((prev) => ({
              ...prev,
              edges: prev.edges.filter((e) => e.id !== id),
            }));
            setSelectedEdge(null);
          }}
        />
      )}
    </div>
  );
}
