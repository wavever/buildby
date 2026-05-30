import { parentPort } from 'worker_threads';
import { analyzeApp } from './analyzer.js';

parentPort.on('message', ({ id, app, includeNativeDetails, sizeBytes }) => {
  try {
    const result = analyzeApp(app, {
      includeLocalizedName: false,
      includeNativeDetails,
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
