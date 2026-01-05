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
    const keys = JSON.parse(ScriptCache().get(this[$cacheName] + 'keys') ?? '[]');
    key = this[$cacheName] + Str(key?.url ?? key);
    keys.push(key);
    ScriptCache().put(this[$cacheName] + 'keys',JSON.stringify(keys));
    return ScriptCache().put(key,JSON.stringify({
      headers:value?.headers,
      body:[...value?.bytes?.()??[]]
    }));
  }
};

setProperty(Web,{Cache});
