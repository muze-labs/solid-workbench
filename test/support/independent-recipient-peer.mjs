// Test-only protocol peer: intentionally imports no Workbench client or broker.
// Independent framing catches assumptions hidden by same-library round trips.
export function independentPeer({ suiteOrigin, callerOrigin, provider = false, referenceDocument = null }) {
  return `<!doctype html><meta name="viewport" content="width=device-width">
    <title>Independent ${provider ? 'provider' : 'caller'}</title>
    <button id="choose">${provider ? 'Return recipient' : 'Choose recipient'}</button>
    <button id="cancel">Cancel</button><p id="result" role="status"></p>
    <script>
    const suiteOrigin=${JSON.stringify(suiteOrigin)};
    const callerOrigin=${JSON.stringify(callerOrigin)};
    const operation='https://vocab.muze.nl/capabilities/select-recipient';
    const isProvider=${provider};
    const referenceDocument=${JSON.stringify(referenceDocument)};
    let peer, pending, ticket, attached, counter=0;
    const requests=new Map();
    function send(method,input) {
      const id='independent-'+(++counter);
      return new Promise((resolve,reject)=>{
        requests.set(id,{resolve,reject});
        peer.postMessage({type:'call',id,method,input});
      });
    }
    function accept(port) {
      peer=port;
      port.onmessage=async ({data})=>{
        if(data.type==='reply') {
          const request=requests.get(data.id);
          if(!request)return;
          requests.delete(data.id);
          if(data.error) request.reject(data.error);
          else request.resolve(data.result);
          return;
        }
        if(data.type==='cancel') {
          if(pending?.id===data.id) pending=null;
          return;
        }
        if(data.type!=='call') return;
        let result=null;
        if(data.method==='capability') {
          pending=data;
          document.querySelector('#result').textContent='Selection requested';
          return;
        }
        if(data.method==='checkpoint') result=null;
        else if(data.method==='can-close') result={allowed:true};
        else {
          port.postMessage({type:'reply',id:data.id,
            error:{code:'denied',message:'Unsupported independent operation'}});
          return;
        }
        port.postMessage({type:'reply',id:data.id,result});
      };
      port.start();
    }
    addEventListener('message',async (event)=>{
      const expected=isProvider?parent:opener;
      const expectedOrigin=isProvider?callerOrigin:suiteOrigin;
      if(event.source===expected && (event.origin===expectedOrigin || (isProvider && event.origin===suiteOrigin)) &&
         event.data?.type==='solid-apps:offer' && event.ports[0]) {
        accept(event.ports[0]);
        await send('register',{capabilities:isProvider?[operation,
          'https://vocab.muze.nl/capabilities/browse']:[],
          generation:'independent-peer',restoring:false});
        await send('ready',null);
        window.registered=true;
      }
      if(!isProvider && event.source===document.querySelector('iframe')?.contentWindow &&
         event.origin===new URL(window.providerUrl).origin &&
         event.data?.type==='solid-apps:embedded-ready' && !attached) {
        attached=true;
        const channel=new MessageChannel();
        opener.postMessage({type:'solid-apps:embed-port',...ticket},suiteOrigin,[channel.port1]);
        event.source.postMessage({type:'solid-apps:offer',...ticket,state:null},
          event.origin,[channel.port2]);
      }
    });
    window.invoke=async function(capability=operation) {
      window.outcome=null;window.failure=null;
      const url=new URL(await send('embed-provider',{capability}));
      url.searchParams.set('solid-apps-task','');
      window.providerUrl=url.href;
      ticket=await send('embed',{url:url.href,capability});
      attached=false;
      const frame=document.createElement('iframe');
      frame.title='Recipient selection';frame.src=url.href;
      frame.style='width:100%;height:75vh;border:0';
      document.body.append(frame);
      try {
        const value=await send('embed-call',{id:ticket.id,input:{}});
        window.outcome=value;window.selected=value['@id'];
        document.querySelector('#result').textContent=value['@id'];
      }
      catch(error) {
        window.failure=error;
        document.querySelector('#result').textContent=error.code;
      }
      finally {
        await send('embed-close',{id:ticket.id});frame.remove();
      }
    };
    document.querySelector('#choose').onclick=()=>{
      if(!isProvider) return window.invoke();
      if(!pending)return;
      const result={'@id':'https://independent.example/person#me'};
      if(referenceDocument) result.document=referenceDocument;
      else if(pending.input.capability===operation) result.description={turtle:
        '<https://independent.example/person#me> <http://www.w3.org/2006/vcard/ns#fn> "Independent person" .'};
      peer.postMessage({type:'reply',id:pending.id,result:{result}});
      pending=null;
    };
    document.querySelector('#cancel').onclick=()=>{
      if(!pending)return;
      peer.postMessage({type:'reply',id:pending.id,
        result:{error:{code:'cancelled',message:'Independent cancellation'}}});
      pending=null;
    };
    if(isProvider) parent.postMessage({type:'solid-apps:embedded-ready'},'*');
    </script>`;
}
