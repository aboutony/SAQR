(function bootstrapProductionRuntime(global) {
  global.SAQR_RUNTIME = {
    mode: 'production-ready',
    profile: 'delivery-handoff',
    apiBase: 'http://localhost:3001',
    auth: {
      enabled: true,
      tokenStorageKey: 'saqr_api_bearer_token',
      staticBearerToken: '',
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
