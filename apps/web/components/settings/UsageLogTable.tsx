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

interface UsageLog {
  id: string;
  agent_role: string;
  provider_id: string;
  provider_name: string;
  model: string;
  total_tokens: number;
  latency_ms: number;
  status: string;
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

export default function UsageLogTable({
  data,
  filter,
  onFilterChange,
  agentRoles,
}: UsageLogTableProps) {
  const columns: ColumnDef<UsageLog, any>[] = [
    {
      accessorKey: "agent_role",
      header: "Agent",
      cell: ({ row }) => (
        <span className="badge bg-[#292932] border-[#464554] text-[#c7c4d7]">
          {row.original.agent_role}
        </span>
      ),
    },
    {
      accessorKey: "provider_name",
      header: "Provider",
      cell: ({ row }) => row.original.provider_name || row.original.provider_id,
    },
    {
      accessorKey: "model",
      header: "Model",
      cell: ({ row }) => row.original.model || "—",
    },
    {
      accessorKey: "total_tokens",
      header: "Tokens",
      cell: ({ row }) => row.original.total_tokens?.toLocaleString() || "—",
      meta: { align: "right" },
    },
    {
      accessorKey: "latency_ms",
      header: "Latency",
      cell: ({ row }) =>
        row.original.latency_ms ? `${row.original.latency_ms}ms` : "—",
      meta: { align: "right" },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const className =
          status === "success"
            ? "bg-[#4ade80]/10 border-[#4ade80] text-[#4ade80]"
            : status === "error"
            ? "bg-[#ffb4ab]/10 border-[#ffb4ab] text-[#ffb4ab]"
            : "bg-[#908fa0]/10 border-[#908fa0] text-[#908fa0]";
        return (
          <span className={`badge border ${className}`}>{status}</span>
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
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[20px] font-semibold text-[#e4e1ed]">
            Usage Logs
          </h2>
          <p className="text-[13px] text-[#c7c4d7]">
            Recent LLM calls and their performance
          </p>
        </div>
        <select
          className="bg-[#0d0d15] border border-[#464554] rounded-sm p-2 text-[13px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="all">All Agents</option>
          {agentRoles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="border-b border-[#464554] hover:bg-transparent"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-left p-3 text-[11px] font-bold uppercase tracking-wider text-[#908fa0]"
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
            <TableBody className="divide-y divide-[rgba(51,65,85,0.3)]">
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-0 hover:bg-[#292932]/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`p-3 text-[13px] ${
                        (cell.column.columnDef.meta as any)?.align === "right"
                          ? "text-right font-mono text-[#c7c4d7]"
                          : "text-[#c7c4d7]"
                      } ${
                        cell.column.id === "model" ? "font-mono" : ""
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
        <div className="flex items-center justify-between mt-4">
          <div className="text-[12px] text-[#908fa0]">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1.5 border border-[#464554] rounded-sm text-[12px] text-[#c7c4d7] hover:bg-[#292932] disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1.5 border border-[#464554] rounded-sm text-[12px] text-[#c7c4d7] hover:bg-[#292932] disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
