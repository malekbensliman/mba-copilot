'use client';

import { AlertTriangle } from 'lucide-react';
import type { DiagnosticsResult } from '../types';

/**
 * A banner shown only when a configuration check fails. It turns a would-be
 * cryptic 500 into a precise "here's what to fix" message (e.g. wrong Pinecone
 * dimension). When everything is healthy it renders nothing.
 */
export default function SetupDiagnostics({ result }: { result: DiagnosticsResult }) {
  const failed = result.checks.filter((check) => !check.ok);
  if (failed.length === 0) {
    return null;
  }

  return (
    <div className="border-b-2 border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="font-semibold text-amber-900">Setup needs attention</p>
          <ul className="mt-1 space-y-1 text-sm text-amber-800">
            {failed.map((check) => (
              <li key={check.name}>
                <span className="font-medium">{check.name}:</span> {check.detail}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-700">
            Fix these in your Vercel project&apos;s Environment Variables (or the Pinecone
            console), then redeploy.
          </p>
        </div>
      </div>
    </div>
  );
}
