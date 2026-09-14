import { parentPort } from 'worker_threads';
import { analyzeApp } from './analyzer.js';

parentPort.on('message', ({
  id,
  app,
  includeNativeDetails,
  sizeBytes,
  // Batch scans skip both for speed; single-app inspection opts in.
  includeSignature = false,
  includeLocalizedName = false,
}) => {
  try {
    const result = analyzeApp(app, {
      includeLocalizedName,
      includeNativeDetails,
      includeSignature,
      sizeBytes,
    });
    parentPort.postMessage({ id, result });
  } catch {
    parentPort.postMessage({
      id,
      result: {
        name: app.name,
        path: app.path,
        platform: app.platform,
        stack: 'unknown',
        stackName: 'Unknown',
        variant: null,
        category: 'unknown',
        confidence: 'low',
        evidence: ['Analysis failed'],
        color: 'gray',
        description: 'Could not analyze this application',
        website: null,
        metadata: {},
        sizeBytes: 0,
        signature: null,
        notarization: null,
      },
    });
  }
});
