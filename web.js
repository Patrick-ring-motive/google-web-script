class Web{};
(()=>{

const setProperty = (object,property)=>{
  const [key,value] = Object.entries(property).pop()
  return Object.defineProperty(object,key,{
    value,
    enumerable:true,
    configurable:false,
    writeable:false,
    writable:false
  });
};

const instanceOf = (x,y) =>{
  try{
    return x instanceof y;
  }catch(_){
    return false;
  }
};

const len = x => x?.length || x?.size || x?.byteLength;
const isNum = x => x > -1;
const hasBits = x => !!(x?.bytes || x?.getBytes);
const getBits = x => x.getBytes?.() ?? x.bytes();
const isBits = x => Array.prototype.every.call(x,isNum);
const hasBuffer = x => !!x?.buffer;
const isBuffer = x => instanceOf(x,ArrayBuffer) || x?.constructor?.name == 'ArrayBuffer';
const isArray = x => Array.isArray(x) || instanceOf(x,Array) || x?.constructor?.name == 'Array';
const isString = x => typeof x === 'string' || instanceOf(x,String) || x?.constructor?.name == 'String';

function toBits(x){
    if(isString(x)){
      return Utilities.newBlob(x).getBytes();
    }
    if(isBuffer(x) || hasBuffer(x)){
      return Object.setPrototypeOf(new Uint8Array(x.buffer ?? x),Array.prototype);
    }
    if(hasBits(x)){
      return Object.setPrototypeOf(getBits(x),Array.prototype);
    }
    if(isBits(x)){
      return x;
    }
    if(isArray(x)){
      return x.map(toBits).flat();
    }
    return x;
};
  
const Blob = class WebBlob extends Utilities.newBlob{

  constructor(parts=[],type,name){
    type = type?.type ?? type ?? parts?.type ?? parts?.getContentType?.();
    if(!len(parts)){
      return super(parts,type,name);
    }
    if(isString(parts)){
      return super(parts,type,name);
    }
    return super(toBits(parts),type,name);
  }
  
  get size(){
    return this.getBytes().length;
  }

  get type(){
    return this.getContentType();
  }

  text(){
    return this.getDataAsString();
  }

  bytes(){
    return new Uint8Array(this.getBytes());
  }

  arrayBuffer(){
    return new Uint8Array(this.getBytes()).buffer;
  }

  slice(){
    return new Web.Blob(this.getBytes().slice(...arguments),this.getContentType());
  }

};

setProperty(Web,{Blob});

const Headers = class WebHeaders{
  
  constructor(entries){
    if(!entries)return this;
    try{
      for(const [key,value] of entries){
        this.append(key,value);
      }
      return this;
    }catch(_){
      for(const key in entries){
        this.append(key,entries[key]);
      }
      return this;
    }
  }

  get size(){
    return Object.keys(this).length
  }
  
  delete(key){
    if(!key)return;
    key = String(key).toLowerCase();
    for(const k in this){
      if(String(k).toLowerCase() === key){
        delete this[k];
      }
    }
  }
  
  set(key,value){
    this.delete(key);
    this[String(key).toLowerCase()] = value;
  }

  get(key){
    if(this[key])return this[key];
    key = String(key).toLowerCase();
    for(const k in this){
      if(String(k).toLowerCase() === key){
        return this[k];
      }
    }
  }

  getSetCookie(){
    const cookies = [];
    for(const key in this){
      if(String(key).toLowerCase() === 'set-cookie'){
        cookies.push(this[key]);
      }
    }
    return cookies;
  }

  getAll(head){
    head = String(head).toLowerCase();
    if(/^(set-)?cookie$/.test(key)){
      const cookies = [];
      for(const key in this){
        if(String(key).toLowerCase() === head){
          cookies.push(this[key]);
        }
      }
      return cookies;
    }
    const value = this.get(head);
    if(value == undefined)return [];
    return String(value).split(',').map(x=>x.trim());
  }

  has(key){
    if(this[key] != undefined)true;
    key = String(key).toLowerCase();
    for(const k in this){
      if(String(k).toLowerCase() === key && this[k] != undefined){
        return true;
      }
    }
    return false;
  }

  append(key,value){
    key = String(key).toLowerCase();
    if(/^(set-)?cookie$/.test(key)){
      while(this[key] != undefined)key = key.replace(/./g,x=>x[`to${Math.random()>.5?'Upp':'Low'}erCase`]());
      this[key] = value;
    }else{
      if(this[key] == undefined){
        this[key] = value;
      }else{
        this[key] = `${this[key]}, ${value}`;
      }
    }
  }

  entries(){
    return Object.entries(this).values();
  }

  [Symbol.iterator](){
    return this.entries();
  }

  keys(){
    return Object.keys(this).values();
  }

  values(){
    return Object.values(this).values();
  }

  forEach(){
    return new Map(this).forEach(...arguments);
  }
  
};

setProperty(Web,{Headers});

const $body = Symbol('*body');
  
const Response = class WebResponse {
  constructor(body, options = {}) {
    Object.assign(this,{body,headers:{},status:200,...options});
    if(body){
      this[$body] = new Web.Blob(body);
    }
  }
  getAllHeaders() {
    return this.headers;
  }
  getHeaders() {
    return this.headers;
  }
  getContent() {
    return this.bodyBlob?.getBytes?.();
  }
  getAs(type){
    return this.bodyBlob?.getAs?.(type);
  }
  getBlob(type){
    return this.bodyBlob;
  }
  getContentText(charset) {
    return charset ? this.bodyBlob.getDataAsString(charset) : this.body;
  }
  toString(){
    return this.body;
  }
  getResponseCode() {
    return this.status;
  }
};


})();
