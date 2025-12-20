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
      return getBits(x);
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

})();
