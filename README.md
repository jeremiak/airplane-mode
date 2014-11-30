# :airplane: airplane-mode

an easy-to-use http cache inspired by [runscope](http://www.runscope.com) and in-flight wifi

## purpose

provide an easy to set up http cache for offline development.

with airplane-mode you can cache any url (headers and response) easily so that when your internet connection isn't reliable you can still develop features.

## wait, but why?

over the past few weeks i've spent quite a bit of time on airplanes. on my last trip, i wanted to write a bit of client-side d3 but because the page required an API response for the data, i was stuck with either paying for expensive (yet shitty) airplane internet or just not doing development. those seemed like a bad set of options.

airplane-mode is a quick solution to that problem. now i/you can easily cache a few responses you know you'll need for offline development and then not worry about connectivity.

## installation & usage

run `npm install -g airplane-mode`

once installed, just use the command `airplane-mode` to run.

now you can easily populate your cache, by prefixing all of the requests you want cached with `http://0.0.0.0:3000`.

for example, if i wanted the JSON from `developer.trade.gov/api.json` to be available through the cache, i simply need to make a request to `http://0.0.0.0:3000/developer.trade.gov/api.json`

the cache is an in-memory cache that lasts for the lifespan of the application. resetting the cache is easy: just restart airplane-mode.

currently, airplane-mode doesn't support `https` but hopefully that will change in the near future

if you want to take a look at the current contents of the cache at anytime, just visit `http://0.0.0.0:3000/cache`
