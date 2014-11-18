import json

from flask import Flask, request, Response, make_response
import requests as http

app = Flask(__name__)
http_methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
db = {}

def cache_request(url, **kwargs):
    method = kwargs.get('method', 'GET')
    request_headers = kwargs.get('request_headers', {})
    response_headers = kwargs.get('response_headers', {})
    request_data = kwargs.get('request_data', {})
    response_data = kwargs.get('response_data', {})

    data = {
        'method': method,
        'request_headers': request_headers,
        'response_headers': response_headers,
        'request_data': request_data,
        'response_data': response_data
    }

    db[url] = data

def check_cache_for_request(url):
    return db.get(url, False)

def perform_live_request(url, **kwargs):
    r = http.get('http://%s' % url)

    return r

def build_url_hash(url, query_args):
    print 'url: %s' % url

    arg_strings = []
    for k, v in request.args.items():
        arg_strings.append('%s=%s' % (k, v))

    if len(arg_strings) != 0:
        url = '%s?%s' % (url, '&'.join(arg_strings))

    return url

@app.route('/cache')
def return_cache_index():
    #return json.dumps(db.keys())
    #x = db['brigades.opendatanetwork.com/resource/8wkm-jj5x.json?$limit=1']

    v = json.dumps(db.keys())
    return v


@app.route('/write')
def write_cache():
    f = open('cache.json', 'w')
    f.write('%s' % db.values())
    f.close()

    return 'OK'

@app.route('/<path:url>', methods=http_methods)
def handle_request(url):
    url = build_url_hash(url, request.args)

    if url == 'favicon.ico':
        return 'favicon.ico'
    else:
        cached_data = check_cache_for_request(url)

        # if cached_data:
        #     print 'CACHED** url: %s' % url
        #     data = cached_data
        #
        #     resp = Response('%s' % json.dumps(data['response_data']))
        #     headers = data['response_headers']
        #
        #     for key, value in headers.items():
        #         resp.headers[key] = value
        #
        #     return resp
        # else:
        if True:
            r = perform_live_request(url)

            #cache_request(url, request_headers = {},
            #    response_headers = r.headers,
            #    request_data = {},
            #    response_data = json.loads(r.content))

            content_type = r.headers['content-type']

            if content_type == 'application/json':
                content = json.dumps(r.content)
            else:
                content = r.content

            resp = make_response(content, r.status_code)

            for key, value in r.headers.items():
                resp.headers[key] = value


            return resp

if __name__ == '__main__':
    app.run(debug=True)
