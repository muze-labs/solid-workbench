// Deliberately no Workbench library or framework: tests the wire contract.
export function independentViewPeer(
  origin,
  presentation = 'interactive-scroll',
  { startupError = '' } = {}
) {
  return `<!doctype html><meta name="viewport" content="width=device-width">
    <title>Independent guarded viewer</title>
    <label>Recoverable draft <textarea id="draft">keep this draft</textarea></label>
    <script>
    const hostOrigin=${JSON.stringify(origin)};
    let port, generation, revision=-1, frozen=false, allowed=false, sequence=0;
    const pending=new Map();
    const report=(value)=>parent.postMessage({type:'fixture-report',...value},hostOrigin);
    const send=(method,input)=>new Promise((resolve,reject)=>{
      const id='fixture-'+(++sequence);pending.set(id,{resolve,reject});
      port.postMessage({type:'call',id,method,input});
    });
    addEventListener('message',async event=>{
      if(event.source!==parent || event.origin!==hostOrigin)return;
      if(event.data?.type==='fixture-control') {
        allowed=event.data.allowed===true;
        if(event.data.disconnect) {
          port.postMessage({type:'disconnect'});port.close();
        }
        return;
      }
      if(event.data?.type!=='solid-apps:offer'||port||!event.ports[0])return;
      port=event.ports[0];
      port.onmessage=async ({data})=>{
        if(data.type==='reply') {
          const request=pending.get(data.id);if(!request)return;
          pending.delete(data.id);
          data.error?request.reject(data.error):request.resolve(data.result);
          return;
        }
        if(data.type!=='call')return;
        let result;
        if(data.method==='capability') {
          generation=data.input.input.generation;
          report({opened:data.input.input.resource,inputs:data.input.input});
          result={result:{version:1,generation,ready:true,
            presentation:${JSON.stringify(presentation)},appearance:['font'],constraints:{minWidth:160}}};
        }
        else if(data.method==='view') {
          const input=data.input;
          if(input.generation!==generation) {
            port.postMessage({type:'reply',id:data.id,error:{code:'denied',message:'stale'}});return;
          }
          if(input.operation==='prepare') {
            frozen=allowed;document.querySelector('#draft').disabled=frozen;
            result={allowed,frozen,message:'Finish the draft before leaving.'};
            report({prepared:frozen,draft:document.querySelector('#draft').value});
          }
          else if(input.operation==='update') {
            if(input.revision>revision)revision=input.revision;
            result={revision};
            report({revision,draft:document.querySelector('#draft').value,appearance:input.appearance});
          }
          else result={ready:true};
        }
        else if(data.method==='can-close')result={allowed:false};
        else {port.postMessage({type:'reply',id:data.id,error:{code:'denied',message:'unsupported'}});return;}
        port.postMessage({type:'reply',id:data.id,result});
      };
      port.start();
      const startupError=${JSON.stringify(startupError)};
      await send('register',{restoring:Boolean(startupError),generation:'independent-view',
        capabilities:['https://vocab.muze.nl/capabilities/view-resource']});
      if(startupError){
        await send('restore-error',{message:startupError});return;
      }
      await send('ready',null);
      try {await send('embed-provider',{capability:'urn:sibling'});report({delegation:'unexpected'});}
      catch(error){report({delegation:error.code});}
    });
    parent.postMessage({type:'solid-apps:embedded-ready',generation:'independent-view'},hostOrigin);
    </script>`;
}
