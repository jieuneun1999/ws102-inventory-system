import React from 'react'

export function ErrorBoundary({ error }: { error?: Error | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white/90 dark:bg-[#1a1a1a]/90 rounded-lg shadow-lg p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Unexpected Application Error</h2>
        <p className="text-sm text-muted-foreground mb-4">Something went wrong while loading the app.</p>
        {error?.message && (
          <pre className="text-xs text-left bg-gray-100 rounded p-2 mb-4 overflow-x-auto">{error.message}</pre>
        )}
        <div className="flex gap-2 justify-center">
          <button
            className="px-4 py-2 rounded bg-[#4D0E13] text-white font-semibold"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <button
            className="px-4 py-2 rounded border border-gray-300"
            onClick={() => window.open('https://github.com/jieuneun1999/ws102-inventory-system','_blank')}
          >
            Get help
          </button>
        </div>
      </div>
    </div>
  )
}

export default ErrorBoundary
