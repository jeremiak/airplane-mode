# makeshift http cache

## purpose

provide an easy to set up http cache for offline development.

with makeshift you can cache any url (headers and response) easily so that when your internet connection isn't reliable you can still develop features.

## wait, but why?

over the past few weeks I've spent quite a bit of time on airplanes. on my last trip, I wanted to write a bit of client-side d3 but because the page required an API response for the data, I was stuck with either paying for expensive (yet shitty) airplane internet or just not doing development. those seemed like a bad set of options.

makeshift is a quick solution to that problem. now i/you can easily cache a few responses you know you'll need for offline development and then not worry about connectivity.

## installation & usage

run `npm install -g makeshift-http-cache`

once installed, just use the command `makeshift` to run.

now you can easily populate your cache, by prefixing all of the requests you want cached with `http://0.0.0.0:3000`.

for example, if I wanted the JSON from `developer.trade.gov/api.json` to be available through the cache, I simply need to make a request to `http://0.0.0.0:3000/developer.trade.gov/api.json`

the cache is an in-memory cache that lasts for the lifespan of the application. resetting the cache is easy: just restart makeshift.

currently, makeshift doesn't support `https` but hopefully that will change in the near future
