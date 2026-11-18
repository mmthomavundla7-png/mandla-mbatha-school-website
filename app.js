const schoolLogo=document.getElementById("schoolLogo");
if(schoolLogo)schoolLogo.addEventListener("error",()=>{schoolLogo.hidden=true;});
document.getElementById("year").textContent=new Date().getFullYear();
const menuToggle=document.getElementById("menuToggle");
if(menuToggle){
 const nav=document.querySelector("header nav");
 menuToggle.addEventListener("click",()=>{
  const isOpen=nav.classList.toggle("show");
  menuToggle.setAttribute("aria-expanded",String(isOpen));
  menuToggle.setAttribute("aria-label",isOpen?"Close navigation menu":"Open navigation menu");
 });
 nav.querySelectorAll("a").forEach(link=>link.addEventListener("click",()=>{
  nav.classList.remove("show");menuToggle.setAttribute("aria-expanded","false");
 }));
}
document.getElementById("applicationForm").addEventListener("submit",async e=>{
 e.preventDefault();const form=e.currentTarget;const status=document.getElementById("formStatus");
 const data=Object.fromEntries(new FormData(form).entries());data.consent=data.consent==="yes";status.textContent="Submitting…";
 try{const r=await fetch("/api/applications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
 const result=await r.json();if(!r.ok)throw new Error(result.error||"Unable to submit.");
 status.textContent="Thank you. Your enquiry has been received. Reference: "+result.reference;form.reset();
 }catch(err){status.textContent=err.message+" Please contact the school by telephone or email."; }
});
// Optional AI school-information assistant. It is backed by the website server.
const assistantForm=document.getElementById("assistantForm");
if(assistantForm){
 const messages=[];
 const messageBox=document.getElementById("chatMessages");
 const status=document.getElementById("assistantStatus");
 const questionInput=document.getElementById("assistantQuestion");
 function addBubble(text,role){const bubble=document.createElement("p");bubble.className="chat-bubble "+(role==="user"?"user-bubble":"assistant-bubble");bubble.textContent=text;messageBox.appendChild(bubble);messageBox.scrollTop=messageBox.scrollHeight;}
 assistantForm.addEventListener("submit",async e=>{
  e.preventDefault();const question=questionInput.value.trim();if(!question)return;
  messages.push({role:"user",content:question});addBubble(question,"user");questionInput.value="";questionInput.disabled=true;assistantForm.querySelector("button").disabled=true;status.textContent="The assistant is preparing an answer…";
  try{const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to get an answer.");messages.push({role:"assistant",content:data.answer});addBubble(data.answer,"assistant");status.textContent="For confirmed details, contact the school directly.";}
  catch(error){messages.pop();status.textContent=error.message+" Phone 063 099 7903 or email mandlambathaschoolnpc@gmail.com.";}
  finally{questionInput.disabled=false;assistantForm.querySelector("button").disabled=false;questionInput.focus();}
 });
}
