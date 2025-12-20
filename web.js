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
const isNum x => x > -1;
const isBits = x => x?.every?.(isNum);
const hasBuffer = x => !!x?.buffer;
const isBuffer = x => instanceOf(x,ArrayBuffer) || x?.constructor?.name == 'ArrayBuffer';
  
const Blob = class WebBlob extends Utilities.newBlob{

  constructor(parts=[],type,name){
    type = type?.type ?? type;
    if(!len(parts)){
      return super(parts,type,name);
    }
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
