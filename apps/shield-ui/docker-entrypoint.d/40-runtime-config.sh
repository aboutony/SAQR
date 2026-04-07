#!/bin/sh
set -eu

cat >/usr/share/nginx/html/runtime-config.production.js <<EOF
(function bootstrapProductionRuntime(global) {
  global.SAQR_RUNTIME = {
    mode: 'production-ready',
    profile: '${SAQR_UI_RUNTIME_PROFILE:-delivery-handoff}',
    apiBase: '${SAQR_UI_API_BASE:-http://localhost:3001}',
    auth: {
      enabled: ${SAQR_UI_AUTH_ENABLED:-true},
      tokenStorageKey: '${SAQR_UI_TOKEN_STORAGE_KEY:-saqr_api_bearer_token}',
      staticBearerToken: '${SAQR_UI_STATIC_BEARER_TOKEN:-}',
    },
    experience: {
      enableDemoData: false,
      autoActivateDemo: false,
      enableExecutiveDemoControls: false,
      exposeSimulationHelpers: false,
      enableDemoWorkflowAutomation: false,
      allowSilentApiFallback: false,
    },
  };
})(window);
EOF

