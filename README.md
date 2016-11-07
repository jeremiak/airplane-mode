# :airplane: airplane-mode
[![CircleCI](https://circleci.com/gh/jeremiak/airplane-mode.svg?style=svg)](https://circleci.com/gh/jeremiak/airplane-mode)

An easy-to-use http cache inspired by [Runscope](http://www.runscope.com) and in-flight WiFi

## Purpose

Provide an easy to set up http cache for offline development.

With `airplane-mode` you can cache any url (headers and response) easily so that when your internet connection isn't reliable you can still develop features.

## Wait, but why?

Over the past few weeks I've spent quite a bit of time on airplanes. On my last trip, I wanted to write a bit of client-side d3 but because the page required an API response for the data, I was stuck with either paying for expensive (yet shitty) airplane internet or just not doing development. Those seemed like a bad set of options.

`airplane-mode` is a quick solution to that problem. Now I/you can easily cache a few responses you know you'll need for offline development and then not worry about connectivity.

## Installation & usage

Run `npm install -g airplane-mode`

Once installed, just use the command `airplane-mode` to run. `airplane-mode` accepts a few flags

* `--clear-cache` will clear the entire cache when the server starts
* `--cors` will force every response to have `Access-Control-Allow-Origin` set to `'*'`
* `--port 3000` will set up the server at port `3000` if it is available

Now you can easily populate your cache, by prefixing all of the requests you want cached with `http://0.0.0.0:3000`.

For example, if I wanted the JSON from [http://www.theschmearcampaign.com/api/bakers.json](`http://www.theschmearcampaign.com/api/bakers.json`) to be available through the cache, I simply need to make a request to `http://0.0.0.0:3000/http://www.theschmearcampaign.com/api/bakers.json`

The cache is persistent using LevelDB. You can reset the cache in two ways:

1. `DELETE http://0.0.0.0:3000/cache/:url` will remove the matching entry
2. `DELETE http://0.0.0.0:3000/cache` will remove all entries
3. `airplane-mode --clear-cache` will remove all entries and start the server

If you want to take a look at the current contents of the cache at anytime, just visit `http://0.0.0.0:3000/cache`
