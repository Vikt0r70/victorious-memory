"use client";

import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import EmptyState from "@/components/ui/EmptyState";

export interface UsageLog {
  id: string | number;
  agent_role: string;
  provider_id: string;
  provider_name?: string;
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens: number;
  latency_ms: number;
  status: string;
  fallback_position?: number;
  error_message?: string | null;
  created_at: string;
}

interface AgentRole {
  value: string;
  label: string;
}

interface UsageLogTableProps {
  data: UsageLog[];
  filter: string;
  onFilterChange: (filter: string) => void;
  agentRoles: AgentRole[];
}

function formatTimestamp(isoStr: string): string {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
      " " + d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return isoStr;
  }
}

export default function UsageLogTable({
  data,
  filter,
  onFilterChange,
  agentRoles,
}: UsageLogTableProps) {
  const columns: ColumnDef<UsageLog, any>[] = [
    {
      accessorKey: "created_at",
      header: "Time",
      cell: ({ row }) => (
        <span className="text-[12px] font-mono text-muted-foreground whitespace-nowrap">
          {formatTimestamp(row.original.created_at)}
        </span>
      ),
    },
    {
      accessorKey: "agent_role",
      header: "Agent Role",
      cell: ({ row }) => (
        <span className="badge bg-accent border-border text-primary font-medium uppercase text-[10px]">
          {row.original.agent_role}
        </span>
      ),
    },
    {
      accessorKey: "provider_name",
      header: "Provider",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-foreground font-medium">
            {row.original.provider_name || row.original.provider_id}
          </span>
          {row.original.fallback_position !== undefined && (
            <span className="text-[10px] text-muted-foreground">
              {row.original.fallback_position === 0
                ? "Primary"
                : `Fallback #${row.original.fallback_position}`}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "model",
      header: "Model",
      cell: ({ row }) => (
        <span className="font-mono text-[12px] text-muted-foreground bg-background px-2 py-0.5 rounded border border-[#292932]">
          {row.original.model || "—"}
        </span>
      ),
    },
    {
      accessorKey: "total_tokens",
      header: "Tokens (In / Out)",
      cell: ({ row }) => {
        const total = row.original.total_tokens || 0;
        const p = row.original.prompt_tokens;
        const c = row.original.completion_tokens;
        return (
          <div className="text-right">
            <div className="font-mono text-foreground">{total.toLocaleString()}</div>
            {p !== undefined && c !== undefined && (
              <div className="text-[10px] text-muted-foreground font-mono">
                {p} / {c}
              </div>
            )}
          </div>
        );
      },
      meta: { align: "right" },
    },
    {
      accessorKey: "latency_ms",
      header: "Latency",
      cell: ({ row }) => (
        <span className="font-mono text-[12px] text-secondary-foreground">
          {row.original.latency_ms ? `${row.original.latency_ms}ms` : "—"}
        </span>
      ),
      meta: { align: "right" },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const error = row.original.error_message;
        const isOk = status === "success";
        return (
          <div className="flex items-center gap-1.5" title={error || ""}>
            <span
              className={`w-2 h-2 rounded-full ${
                isOk ? "bg-[#4ade80]" : "bg-destructive"
              }`}
            />
            <span
              className={`badge border text-[11px] ${
                isOk
                  ? "bg-success/10 border-[#4ade80] text-success"
                  : "bg-destructive/10 border-[#ffb4ab] text-destructive"
              }`}
            >
              {status}
            </span>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  if (data.length === 0) {
    return (
      <EmptyState
        title="No usage logs found"
        message="No LLM calls have been recorded yet."
        icon="analytics"
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-foreground">
            Recent Invocations
          </h3>
          <p className="text-[12px] text-muted-foreground">
            Detailed metrics and fallback tracking for LLM requests
          </p>
        </div>
        <select
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="all">All Agent Roles</option>
          {agentRoles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-card border border-input rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="border-b border-input bg-muted/30 hover:bg-transparent"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="p-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-accent/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`p-3 text-[13px] ${
                        (cell.column.columnDef.meta as any)?.align === "right"
                          ? "text-right"
                          : ""
                      }`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-[12px] text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()} ({data.length} total entries)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-2 border border-input rounded-md shadow-sm text-[12px] text-muted-foreground hover:bg-accent disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-2 border border-input rounded-md shadow-sm text-[12px] text-muted-foreground hover:bg-accent disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
