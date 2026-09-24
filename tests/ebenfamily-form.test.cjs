const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/ebenfamily.js'),'utf8');
function fixture(fail=false){
  let submit,request,resets=0;
  const fields={nome:{value:' Ana '},empresa:{value:' Silva '},email:{value:' ana@example.test '},telefone:{value:' 51999990000 '},mensagem:{value:''}};
  const form={elements:fields,reportValidity:()=>true,addEventListener:(_,handler)=>submit=handler,reset:()=>resets++};
  const button={disabled:true,textContent:''},status={hidden:true,textContent:''},details={open:false};
  const ids={exclusaoForm:form,enviarExclusao:button,exclusaoStatus:status,'excluir-conta':details};
  vm.runInNewContext(source,{
    document:{getElementById:id=>ids[id],querySelectorAll:()=>[]},
    location:{hash:'#excluir-conta'},window:{addEventListener:()=>{}},
    fetch:async(url,options)=>{request={url,options};if(fail)throw new Error('offline');return {type:'opaque'};},
  });
  return {fields,button,status,details,get request(){return request;},get resets(){return resets;},submit:()=>submit({preventDefault(){}})};
}
test('envia as cinco chaves do contato, com sobrenome em empresa',async()=>{
  const f=fixture();assert.equal(f.details.open,true);await f.submit();
  const data=JSON.parse(f.request.options.body);
  assert.deepEqual(Object.keys(data),['nome','empresa','email','telefone','mensagem']);
  assert.equal(data.nome,'Ana');assert.equal(data.empresa,'Silva');
  assert.match(data.mensagem,/EbenFamily.*exclusão de conta/);
  assert.match(data.mensagem,/Motivo não informado/);
  assert.equal(f.request.options.method,'POST');assert.equal(f.request.options.mode,'no-cors');
  const contact=fs.readFileSync(path.join(root,'contato/index.html'),'utf8');
  assert.ok(contact.includes(f.request.url));
  assert.equal(f.resets,1);assert.equal(f.button.disabled,false);
  assert.match(f.status.textContent,/ainda não foi excluída/);
});
test('falha de rede preserva formulário e permite tentar novamente',async()=>{
  const f=fixture(true);await f.submit();
  assert.equal(f.resets,0);assert.equal(f.button.disabled,false);
  assert.match(f.status.textContent,/Não foi possível enviar/);
});
test('não envia nome composto apenas por espaços',async()=>{
  const f=fixture();f.fields.nome.value='   ';await f.submit();
  assert.equal(f.request,undefined);assert.match(f.status.textContent,/Preencha/);
});
test('ambos os GIFs e link da política estão na página',()=>{
  const html=fs.readFileSync(path.join(root,'ebenfamily/index.html'),'utf8');
  for(const gif of ['ebenfamily-demo.gif','family-illustration.gif'])assert.ok(html.includes('../img/'+gif));
  assert.ok(html.includes('href="./privacy/"'));
  assert.ok(html.includes('href="../produtos/"'));
  assert.ok(!html.includes('href="#"'));
});