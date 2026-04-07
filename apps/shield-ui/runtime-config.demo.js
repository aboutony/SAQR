(function bootstrapDemoRuntime(global) {
  global.SAQR_RUNTIME = {
    mode: 'demo',
    profile: 'client-demo',
    apiBase: 'http://localhost:3001',
    auth: {
      enabled: false,
      tokenStorageKey: 'saqr_api_bearer_token',
      staticBearerToken: '',
    },
    experience: {
      enableDemoData: true,
      autoActivateDemo: true,
      enableExecutiveDemoControls: true,
      exposeSimulationHelpers: true,
      enableDemoWorkflowAutomation: true,
      allowSilentApiFallback: true,
    },
  };
})(window);
