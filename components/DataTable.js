import EmptyState from './EmptyState';

export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  keyField = 'id',
  emptyTitle = 'No records found',
  emptyDescription = 'No data currently available in this view.',
  onEmptyAction,
  emptyActionLabel,
}) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl bg-white border border-slate-200/90 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx} className={`px-5 py-3.5 ${col.className || ''}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...Array(4)].map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((_, cIdx) => (
                    <td key={cIdx} className="px-5 py-4">
                      <div className="h-4 bg-slate-200/80 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        onAction={onEmptyAction}
        actionLabel={emptyActionLabel}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white border border-slate-200/90 shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`px-5 py-3.5 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.map((row, rIdx) => (
              <tr
                key={row[keyField] ?? rIdx}
                className="hover:bg-slate-50/80 transition-colors group"
              >
                {columns.map((col, cIdx) => (
                  <td
                    key={cIdx}
                    className={`px-5 py-3.5 text-slate-700 whitespace-nowrap ${
                      col.className || ''
                    }`}
                  >
                    {col.render
                      ? col.render(row, rIdx)
                      : typeof col.accessor === 'function'
                      ? col.accessor(row)
                      : row[col.accessor] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
        <span>Showing <strong className="font-semibold text-slate-700">{data.length}</strong> record{data.length === 1 ? '' : 's'}</span>
        <span className="text-[11px] text-slate-400">Live MySQL 8.0 query</span>
      </div>
    </div>
  );
}
