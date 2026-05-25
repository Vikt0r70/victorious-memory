"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { graphApi } from "@/lib/api";
import MemoryDetailModal from "@/components/modals/MemoryDetailModal";
import EdgeDetailModal from "@/components/modals/EdgeDetailModal";

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

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  data: any;
  radius: number;
}

interface SimEdge {
  source: string;
  target: string;
  data: any;
}

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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const simEdgesRef = useRef<SimEdge[]>([]);
  const animFrameRef = useRef<number>(0);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; initialX: number; initialY: number }>({ active: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const draggingNodeRef = useRef<string | null>(null);

  // Load graph data
  useEffect(() => {
    graphApi.getGraph({ limit: "120", depth: String(depth) })
      .then((d) => {
        setGraphData(d);
        const nodes = (d.nodes || []).map((n: any) => ({
          id: n.id,
          x: Math.random() * 800 - 400,
          y: Math.random() * 600 - 300,
          vx: 0,
          vy: 0,
          data: n,
          radius: 18 + (n.access_count || 0) * 0.5,
        }));
        const edges = (d.edges || []).map((e: any) => ({
          source: e.source || e.source_id,
          target: e.target || e.target_id,
          data: e,
        }));
        simNodesRef.current = nodes;
        simEdgesRef.current = edges;
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [depth]);

  // Simulation step
  const stepSimulation = useCallback(() => {
    const nodes = simNodesRef.current;
    const edges = simEdgesRef.current;
    if (nodes.length === 0) return;

    const width = 1000;
    const height = 700;

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 8000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Spring force along edges
    for (const e of edges) {
      const a = nodes.find((n) => n.id === e.source);
      const b = nodes.find((n) => n.id === e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDist = 120;
      const force = (dist - targetDist) * 0.005;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Center gravity
    for (const n of nodes) {
      n.vx -= n.x * 0.0003;
      n.vy -= n.y * 0.0003;
    }

    // Update positions with damping
    for (const n of nodes) {
      if (draggingNodeRef.current === n.id) continue;
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += n.vx;
      n.y += n.vy;
      // Boundary
      n.x = Math.max(-width / 2 + 40, Math.min(width / 2 - 40, n.x));
      n.y = Math.max(-height / 2 + 40, Math.min(height / 2 - 40, n.y));
    }
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = () => {
      stepSimulation();
      draw(ctx, canvas);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [stepSimulation]);

  const draw = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const t = transformRef.current;
    const nodes = simNodesRef.current;
    const edges = simEdgesRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = "#1f1f27";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    ctx.save();
    ctx.translate(canvas.width / 2 + t.x, canvas.height / 2 + t.y);
    ctx.scale(t.scale, t.scale);

    // Edges
    for (const e of edges) {
      const s = nodes.find((n) => n.id === e.source);
      const tgt = nodes.find((n) => n.id === e.target);
      if (!s || !tgt) continue;
      ctx.beginPath();
      ctx.strokeStyle = EDGE_COLORS[e.data.relation_type] || "#6b7280";
      ctx.lineWidth = selectedEdge?.id === e.data.id ? 3 : 1.5;
      ctx.globalAlpha = selectedEdge && selectedEdge.id !== e.data.id ? 0.2 : 1;
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();

      // Arrowhead
      const dx = tgt.x - s.x;
      const dy = tgt.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const ax = tgt.x - (dx / dist) * (tgt.radius + 6);
        const ay = tgt.y - (dy / dist) * (tgt.radius + 6);
        const headSize = 5;
        const angle = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - headSize * Math.cos(angle - 0.5), ay - headSize * Math.sin(angle - 0.5));
        ctx.lineTo(ax - headSize * Math.cos(angle + 0.5), ay - headSize * Math.sin(angle + 0.5));
        ctx.closePath();
        ctx.fillStyle = EDGE_COLORS[e.data.relation_type] || "#6b7280";
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Nodes
    for (const n of nodes) {
      const color = NODE_COLORS[n.data.memory_type] || "#908fa0";
      const isSelected = selectedNode?.id === n.id;
      const isHighlighted = !searchQuery || (n.data.content || "").toLowerCase().includes(searchQuery.toLowerCase());

      if (!isHighlighted) ctx.globalAlpha = 0.2;

      // Glow for selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 8, 0, 2 * Math.PI);
        ctx.fillStyle = color + "30";
        ctx.fill();
      }

      // Node
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = isHighlighted ? "#e4e1ed" : "#6b7280";
      ctx.font = "10px 'JetBrains Mono'";
      ctx.textAlign = "center";
      const label = (n.data.content || n.data.id || "").slice(0, 20);
      ctx.fillText(label, n.x, n.y + n.radius + 14);

      ctx.globalAlpha = 1;
    }

    ctx.restore();
  };

  // Mouse handlers
  const toWorld = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const t = transformRef.current;
    return {
      x: (clientX - rect.left - rect.width / 2 - t.x) / t.scale,
      y: (clientY - rect.top - rect.height / 2 - t.y) / t.scale,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = toWorld(e.clientX, e.clientY);
    const nodes = simNodesRef.current;
    for (const n of nodes) {
      const dx = pos.x - n.x;
      const dy = pos.y - n.y;
      if (Math.sqrt(dx * dx + dy * dy) < n.radius) {
        draggingNodeRef.current = n.id;
        setSelectedNode(n.data);
        setSelectedEdge(null);
        return;
      }
    }
    // Check edges
    for (const edge of simEdgesRef.current) {
      const s = nodes.find((n) => n.id === edge.source);
      const t = nodes.find((n) => n.id === edge.target);
      if (!s || !t) continue;
      // Distance from point to line segment
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      const t2 = Math.max(0, Math.min(1, ((pos.x - s.x) * dx + (pos.y - s.y) * dy) / (len * len)));
      const projX = s.x + t2 * dx;
      const projY = s.y + t2 * dy;
      const dist = Math.sqrt((pos.x - projX) ** 2 + (pos.y - projY) ** 2);
      if (dist < 6) {
        setSelectedEdge(edge.data);
        setSelectedNode(null);
        return;
      }
    }
    setSelectedNode(null);
    setSelectedEdge(null);
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, initialX: transformRef.current.x, initialY: transformRef.current.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingNodeRef.current) {
      const pos = toWorld(e.clientX, e.clientY);
      const node = simNodesRef.current.find((n) => n.id === draggingNodeRef.current);
      if (node) {
        node.x = pos.x;
        node.y = pos.y;
        node.vx = 0;
        node.vy = 0;
      }
    } else if (dragRef.current.active) {
      const d = dragRef.current;
      transformRef.current.x = d.initialX + (e.clientX - d.startX);
      transformRef.current.y = d.initialY + (e.clientY - d.startY);
    }
  };

  const handleMouseUp = () => {
    draggingNodeRef.current = null;
    dragRef.current.active = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    transformRef.current.scale = Math.max(0.2, Math.min(5, transformRef.current.scale * delta));
  };

  const handleZoomIn = () => {
    transformRef.current.scale = Math.min(5, transformRef.current.scale * 1.2);
  };
  const handleZoomOut = () => {
    transformRef.current.scale = Math.max(0.2, transformRef.current.scale / 1.2);
  };
  const handleFit = () => {
    transformRef.current = { x: 0, y: 0, scale: 1 };
  };

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
            {graphData.nodes.length} nodes · {graphData.edges.length} edges
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
        {/* Canvas */}
        <div className="flex-1 bg-[#0d0d15] border border-[rgba(51,65,85,0.5)] rounded-lg relative overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="material-symbols-outlined animate-spin text-4xl text-[#c0c1ff]">progress_activity</span>
            </div>
          ) : graphData.nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#908fa0]">
              <span className="material-symbols-outlined text-5xl mb-3">hub</span>
              <p>No graph data yet. Ingest conversations to build the graph.</p>
            </div>
          ) : (
            <>
              <canvas
                ref={canvasRef}
                width={1000}
                height={700}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                className="w-full h-full cursor-crosshair"
              />
              {/* Zoom controls */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-1">
                <button onClick={handleZoomIn} className="bg-[#1e293b] border border-[#464554] text-[#c7c4d7] rounded-sm p-1.5 hover:bg-[#292932]">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
                <button onClick={handleZoomOut} className="bg-[#1e293b] border border-[#464554] text-[#c7c4d7] rounded-sm p-1.5 hover:bg-[#292932]">
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <button onClick={handleFit} className="bg-[#1e293b] border border-[#464554] text-[#c7c4d7] rounded-sm p-1.5 hover:bg-[#292932]">
                  <span className="material-symbols-outlined text-[18px]">fit_screen</span>
                </button>
              </div>
            </>
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
                        className={`badge text-[10px] border transition-colors ${
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
                        className={`badge text-[10px] border transition-colors ${
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

