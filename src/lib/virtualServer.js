// A lightweight, browser-based mock of an Express server
class VirtualServer {
  constructor() {
    this.routes = {
      GET: [], POST: [], PUT: [], DELETE: [], PATCH: [], HEAD: [], OPTIONS: []
    };
    this.loadDB();
  }

  loadDB() {
    try {
        const savedDB = localStorage.getItem('gridly-virtual-db');
        if (savedDB) {
            this.db = JSON.parse(savedDB);
            console.log("%cVirtualServer: DB Loaded", "color: green; font-weight: bold;", this.db);
        } else {
            this.db = {};
            console.log("%cVirtualServer: New DB initialized", "color: blue; font-weight: bold;");
        }
    } catch (e) {
        console.warn("VirtualServer: Failed to parse saved DB, resetting.", e);
        this.db = {};
    }
  }

  persistDB() {
      try {
          const stateToSave = JSON.stringify(this.db);
          localStorage.setItem('gridly-virtual-db', stateToSave);
          console.log("%cVirtualServer: DB Saved", "color: orange; font-weight: bold;", this.db);
      } catch (e) {
          console.error("VirtualServer: Failed to save DB to localStorage.", e);
      }
  }

  reset() {
    // Only reset routes, NEVER the DB
    this.routes = {
      GET: [], POST: [], PUT: [], DELETE: [], PATCH: [], HEAD: [], OPTIONS: []
    };
  }

  pathToRegex(path) {
    const paramNames = [];
    const regexStr = path
      .replace(/\//g, '\\/')
      .replace(/:([^/]+)/g, (_, paramName) => {
        paramNames.push(paramName);
        return '([^/]+)';
      });
    return {
      regex: new RegExp(`^${regexStr}\\/?$`, 'i'),
      paramNames,
    };
  }

  register(method, path, handler) {
    const upperMethod = method.toUpperCase();
    if (!this.routes[upperMethod]) this.routes[upperMethod] = [];
    const { regex, paramNames } = this.pathToRegex(path);
    this.routes[upperMethod].push({ regex, paramNames, handler, originalPath: path });
  }

  async fetch(method, url, body = null) {
    const upperMethod = method.toUpperCase();
    const [pathPart, queryPart] = url.split('?');
    const queryParams = new URLSearchParams(queryPart);
    const query = Object.fromEntries(queryParams.entries());

    let route = null;
    let match = null;
    if (this.routes[upperMethod]) {
        for (const r of this.routes[upperMethod]) {
            match = pathPart.match(r.regex);
            if (match) {
                route = r;
                break;
            }
        }
    }

    if (!route) {
        return { status: 404, ok: false, data: { error: `Cannot ${upperMethod} ${pathPart}` } };
    }

    const params = {};
    route.paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
    });

    const req = {
        method: upperMethod,
        path: pathPart,
        url,
        query,
        params,
        headers: {},
        get: (header) => "",
        body: typeof body === 'string' ? this.safeJSONParse(body) : (body || {}),
    };

    return new Promise((resolve) => {
        let statusCode = 200;
        let headers = {};

        const finish = (data) => {
            // AUTO-SAVE on any response completion
            this.persistDB();
            resolve({ 
                status: statusCode, 
                ok: statusCode >= 200 && statusCode < 300, 
                data,
                headers
            });
        };

        const res = {
            status: (code) => { statusCode = code; return res; },
            set: (key, value) => { headers[key] = value; return res; },
            header: (key, value) => { headers[key] = value; return res; },
            // All these methods must trigger finish() to ensure saving
            json: (data) => finish(data),
            send: (data) => finish(data),
            sendStatus: (code) => { statusCode = code; finish(null); },
            end: () => finish(null),
            
            // Safe stubs
            type: () => res,
            links: () => res,
            location: () => res,
        };

        try {
            const result = route.handler(req, res);
            if (result instanceof Promise) {
                result.catch(err => {
                    console.error("Async Handler Error:", err);
                    if (!statusCode || statusCode === 200) statusCode = 500;
                    finish({ error: err.message || "Internal Server Error" });
                });
            }
        } catch (error) {
            console.error("Sync Handler Error:", error);
            statusCode = 500;
            finish({ error: error.message || "Internal Server Error" });
        }
    });
  }

  safeJSONParse(str) {
      if (!str || str.trim() === '') return {};
      try { return JSON.parse(str); } 
      catch (e) { return {}; }
  }
}

export const virtualServer = new VirtualServer();