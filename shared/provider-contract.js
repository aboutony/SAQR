function assertProviderContract(name, provider, methods) {
    if (!provider || typeof provider !== 'object') {
        throw new Error(`${name} provider must be an object`);
    }

    methods.forEach((methodName) => {
        if (typeof provider[methodName] !== 'function') {
            throw new Error(`${name} provider must implement ${methodName}()`);
        }
    });

    return provider;
}

module.exports = {
    assertProviderContract,
};
