'use client';

export default function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border bg-white animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isSuccess
            ? 'bg-emerald-100 text-emerald-700'
            : isError
            ? 'bg-rose-100 text-rose-700'
            : 'bg-blue-100 text-blue-700'
        }`}
      >
        {isSuccess ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 13l4 4L19 7" />
          </svg>
        ) : isError ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>

      <div className="text-xs max-w-xs">
        <p className={`font-bold ${isError ? 'text-rose-900' : 'text-slate-900'}`}>
          {isSuccess ? 'Success' : isError ? 'Error' : 'Notice'}
        </p>
        <p className="text-slate-600 mt-0.5 leading-snug">{message}</p>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          aria-label="Dismiss toast"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
