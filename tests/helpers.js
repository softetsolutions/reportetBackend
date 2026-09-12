export function mockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    cookies: {},
    headers: {},
    ...overrides,
  };
}

export function mockRes() {
  return {
    statusCode: 200,
    body: null,
    cookies: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    cookie(name, value) {
      this.cookies[name] = value;
      return this;
    },
    clearCookie() {
      return this;
    },
  };
}

export function queryChain(result) {
  const c = {
    populate() {
      return c;
    },
    select() {
      return c;
    },
    sort() {
      return c;
    },
    skip() {
      return c;
    },
    limit() {
      return c;
    },
    lean() {
      return c;
    },
    session() {
      return c;
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return Promise.resolve(result).catch(onRejected);
    },
  };
  return c;
}

export function stub(object, method, impl) {
  const original = object[method];
  object[method] = impl;
  return () => {
    object[method] = original;
  };
}

export function routeEntries(router) {
  return (router.stack || [])
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));
}
