const webpack = require('webpack');

module.exports = function override(config) {
    const fallback = config.resolve.fallback || {};
    Object.assign(fallback, {
        "buffer": require.resolve("buffer/"),
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "assert": require.resolve("assert/"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "os": require.resolve("os-browserify/browser"),
        "url": require.resolve("url/")
    });
    config.resolve.fallback = fallback;

    config.resolve.alias = {
        ...(config.resolve.alias || {}),
        'accounts': require.resolve('viem/accounts')
    };

    config.module.rules.push({
        test: /\.m?js/,
        resolve: {
            fullySpecified: false
        }
    });

    config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
            process: 'process/browser.js',
            Buffer: ['buffer', 'Buffer']
        })
    ]);

    config.ignoreWarnings = [/Failed to parse source map/];
    return config;
}