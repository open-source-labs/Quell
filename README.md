<p align="center"><img src="./demo/client/src/images/quell_logos/QUELL-nested-LG@0.75x.png" width='500' style="margin-top: 10px; margin-bottom: -10px;"></p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/oslabs-beta/Quell/blob/master/LICENSE)
![AppVeyor](https://img.shields.io/badge/build-passing-brightgreen.svg)
![AppVeyor](https://img.shields.io/badge/version-1.0.1-blue.svg)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/oslabs-beta/Quell/issues)

# Quell

Quell is a light-weight caching layer implementation for GraphQL responses on both the client- and server-side. Use Quell to prevent redundant client-side API requests and to minimize costly server-side response latency.

Accelerated by [OS Labs](https://github.com/oslabs-beta/) and developed by [Nick Kruckenberg](https://github.com/kruckenberg), [Mike Lauri](https://github.com/MichaelLauri), [Rob Nobile](https://github.com/RobNobile) and [Justin Jaeger](https://github.com/justinjaeger).

## Features

- Client-side caching utilizing sessionStorage
- Server-side caching utilizing a configurable Redis in-memory data store
- Automatic unique cache key generation
- Partial and exact match query caching
- Programmatic rebuilding of GraphQL queries to fetch only the minimum data necessary to complete the response based upon current cache contents

Currently, Quell can only cache query-type requests without arguments, aliases, fragments, variables, or directives. Quell will still process these other requests, but will not cache the responses.

## Installation

Quell is divided up into two npm packages:

- Download @quell/client from npm in your terminal with `npm i @quell/client`
- Download @quell/server from npm in your terminal with `npm i @quell/server`

### Installing and Connecting a Redis Server

If not already installed on your server, install Redis.
- Mac-Homebrew:
    - At the terminal, type `brew install redis`
    - After installation completes, type `redis-server`
    - Your server should now have a Redis database connection open (note the port on which it is listening)
- Linux or non-Homebrew:
    - Download appropriate version of Redis from [redis.io/download](http://redis.io/download)
    - Follow installation instructions
    - Once Redis is successfully installed, follow instructions to open a Redis database connection (note the port on which it is listening)

## Documentation

- [@quell/client README](./quell-client/README.md)
-  [@quell/server README](./quell-server/README.md)

### Contribute to Quell

Interested in making a contribution to Quell? [Click](./CONTRIBUTING.md) for our open-source contribution guidelines.

Thank you for your interest and support!!
Team Quell
