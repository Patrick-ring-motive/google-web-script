const $cacheName = Symbol('*cacheName');
const ScriptCache = (()=>{
  let _ScriptCache;
  return ()=>{
    if(!_ScriptCache){
      _ScriptCache = CacheService.getScriptCache();
    }
    return _ScriptCache;
  };
})();
const Cache = class WebCache{
  constructor(name){
    this[$cacheName] = Str(name || 'default');
  }
  match(key){
    key = this[$cacheName] + Str(key?.url ?? key);
    const res = ScriptCache().get(key);
    if(!res)return;
    const json = JSON.parse(res);
    return new Web.Response(json.body,json);
  }
  put(key,value){
    key = this[$cacheName] + Str(key?.url ?? key);
    return ScriptCache().put(key,JSON.stringify({
      headers:value?.headers,
      body:[...value?.bytes?.()??[]]
    }));
  }
};

setProperty(Web,{Cache});
