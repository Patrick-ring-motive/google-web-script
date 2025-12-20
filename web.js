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

const len = x => x?.length || x?.size || x?.byteLength;

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
