<p align="center"><img src="../demo/client/src/images/quell_logos/QUELL-nested-LG@0.75x.png" width='500' style="margin-top: 10px; margin-bottom: -10px;"></p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/open-source-labs/Quell/blob/master/LICENSE)
![AppVeyor](https://img.shields.io/badge/build-passing-brightgreen.svg)
![AppVeyor](https://img.shields.io/badge/version-1.0.1-blue.svg)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/open-source-labs/Quell/issues)

# Quell Developer Tool

The Quell Developer Tool is an easy-to-use Chrome Developer Tools extension designed for Quell users. With this extension, users can:
  - Inspect and monitor the latency of client-side GraphQL/Quell requests
  - Make and monitor the latency of GraphQL/Quell requests to a specified server endpoint
  - View server-side cache data and contents, with the ability to manually clear the cache

These features require zero-to-minimal configuration and can work independently of `@quell/client` and `@quell/server`, but are designed with the needs of Quell users especially in mind.

The Quell Developer Tool is an open-source developer tool accelerated by [OS Labs](https://github.com/open-source-labs) and developed by [Chang Cai](https://github.com/ccai89), [Robert Howton](https://github.com/roberthowton), [Joshua Jordan](https://github.com/jjordan-90), [Jinhee Choi](https://github.com/jcroadmovie), [Nayan Parmar](https://github.com/nparmar1), [Tashrif Sanil](https://github.com/tashrifsanil), [Tim Frenzel](https://github.com/TimFrenzel), [Robleh Farah](https://github.com/farahrobleh), [Angela Franco](https://github.com/ajfranco18), [Ken Litton](https://github.com/kenlitton), [Thomas Reeder](https://github.com/nomtomnom), [Andrei Cabrera](https://github.com/Andreicabrerao), [Dasha Kondratenko](https://github.com/dasha-k), [Derek Sirola](https://github.com/dsirola1), [Xiao Yu Omeara](https://github.com/xyomeara), [Nick Kruckenberg](https://github.com/kruckenberg), [Mike Lauri](https://github.com/MichaelLauri), [Rob Nobile](https://github.com/RobNobile) and [Justin Jaeger](https://github.com/justinjaeger).

## Installation

The Quell Developer Tool is currently available as a Chrome Developer Tools extension. The easiest way to install it is to [add it from the Chrome Web Store.](https://chrome.google.com/webstore/detail/quell-developer-tool/jnegkegcgpgfomoolnjjkmkippoellod)

The latest build can also be built from source and added manually as a Chrome extension. To build the latest version, execute the following commands:

```
git clone https://github.com/open-source-labs/Quell.git Quell
cd Quell/quell-extension
npm install
npm run build
```
Then, in the Chrome Extensions Page (`chrome://extensions/`), click on "Load unpacked" and navigate to `.../Quell/quell-extension/dist/` and click "Select". (You may need to toggle on "Developer mode" to do this.) The extension should now be loaded and available in the Chrome Developer Tools.

## Usage and Configuration

The Quell Developer Tool will work out-of-the-box as a GraphQL network monitor from its **Client** tab. Minimal configuration as described below is required to benefit from Quell Developer Tool's other features.

### Server

To enable the features on the **Server** tab, navigate to the **Settings** tab and complete the following fields:
  - *GraphQL Route*. Your server's GraphQL endpoint (default: `http://localhost:3000`)
  - *Server Address*. The HTTP address of server (default: `/graphQL`)

With this information the Quell Developer Tool will retrieve your GraphQL schema (and display it on the **Settings** tab) and permit you to make and view the latency of GraphQL queries from the **Server** tab.

To enable the "Clear Cache" button, you can additionally specify a server endpoint configured with `@quell/server`'s `clearCache` middleware.
  - *Clear Cache Route*. Endpoint which `QuellCache.clearCache` middleware is configured (default: `/clearCache`)

Here is an example configuration

```javascript
app.get('/clearCache', quellCache.clearCache, (req, res) => {
  return res.status(200).send('Redis cache successfully cleared');
});
```
### Cache

The **Cache** tab will display data from the Redis-based `@quell/server` cache. For it to do so, Quell Developer Tool requires an endpoint at which `@quell/server`'s `getRedisInfo` is configured. This enpoint can be specified in the **Settings** tab:
  - *Redis Route*. Endpoint at which `QuellCache.getRedisInfo` is configured. (default: `/redis`)

The `getRedisInfo` middleware accepts an options object with the following keys:
  - `getStats` (`true`/`false`) - return a suite of statistics from Redis cache
  - `getKeys` (`true`/`false`) - return a list of keys currently stored in Redis cache
  - `getValues` (`true`/`false`) - return list of keys from Redis cache with their values

Here is an example configuration:

```javascript
app.use('/redis', ...quellCache.getRedisInfo({
  getStats: true,
  getKeys: true,
  getValues: true
}))
```

## More information

For more on `@quell/client` and `@quell/server`, see their documentation:
- [@quell/client README](../quell-client/README.md)
- [@quell/server README](../quell-server/README.md)
