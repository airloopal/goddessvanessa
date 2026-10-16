'use strict';
// Optional wallets share the card checkout's server-owned price and attempt lock.
const squareWalletMethods=new Set();
function squareWalletHTML(){return '<section id="square-wallets" class="square-wallets" aria-label="Express payment" hidden><p>Express payment</p><div class="square-wallet-buttons"><button type="button" id="square-apple-pay" class="square-apple-pay" data-square-wallet-action aria-label="Pay with Apple Pay" hidden></button><div id="square-google-pay" data-square-wallet-action aria-label="Pay with Google Pay" hidden></div></div><p id="square-wallet-consent" class="square-wallet-consent">Tick the acknowledgement below to enable payment.</p><span class="square-payment-divider">or pay by card</span></section>';}
async function squareDisposeWallets(){const methods=[...squareWalletMethods];squareWalletMethods.clear();await Promise.allSettled(methods.map(method=>Promise.resolve().then(()=>method.destroy())));}
function squareSyncWalletButtons(stage,button){const hint=document.getElementById('square-wallet-consent');if(hint)hint.hidden=squarePaymentAcknowledged(stage);for(const id of ['square-apple-pay','square-google-pay']){const el=document.getElementById(id);if(!el)continue;const disabled=button.disabled||button.dataset.squareConfirmation==='1';el.inert=disabled;el.setAttribute('aria-disabled',String(disabled));if(el.tagName==='BUTTON')el.disabled=disabled;}}
async function squareWalletTokenize(wallet,payments,prepared,stage){
 // Apple requires tokenize() to run in the original click, before any await.
 const tokenizing=wallet.tokenize();
 const result=await squareVerificationAwait(tokenizing,180000,'Wallet confirmation timed out. No payment was submitted.');
 if(result.status!=='OK')throw Object.assign(Error(result.status==='Cancel'?'Payment cancelled.':'Choose another payment method.'),{code:'wallet_cancelled'});
 const verification=await squareVerificationAwait(payments.verifyBuyer(result.token,{amount:(prepared.plan.amount/100).toFixed(2),currencyCode:'GBP',intent:'CHARGE',customerInitiated:true,sellerKeyedIn:false,billingContact:stage==='contract'?squareBillingContact():{}}),180000,'Bank verification timed out. No payment was submitted.');
 if(verification&&(!verification.token||!/^verf:[A-Za-z0-9_-]{1,1000}$/.test(verification.token)))throw Error('Wallet verification could not be completed. Try your card instead.');
 return {...result,verificationToken:verification?.token||null};
}
async function squarePrepareWallets(payments,prepared,stage,button,submit,alive){
 const region=document.getElementById('square-wallets');if(!region||typeof payments.paymentRequest!=='function'||typeof payments.verifyBuyer!=='function')return;
 const request=()=>payments.paymentRequest({countryCode:'GB',currencyCode:'GBP',total:{amount:(prepared.plan.amount/100).toFixed(2),label:stage==='entry'?'Entry fee':'Contract fee'}});
 const register=async(kind)=>{let method;const apple=kind==='applePay',el=document.getElementById(apple?'square-apple-pay':'square-google-pay');if(!el||typeof payments[kind]!=='function')return;
  try{method=await payments[kind](request());if(!alive()){await method.destroy();return;}squareWalletMethods.add(method);el.hidden=false;region.hidden=false;if(!apple)await method.attach('#square-google-pay',{buttonColor:'black',buttonType:'long',buttonSizeMode:'fill'});if(!alive()){squareWalletMethods.delete(method);await method.destroy();return;}el.onclick=event=>{event.preventDefault();if(!squarePaymentAcknowledged(stage)){squareRequireAcknowledgement(stage,document.getElementById(stage==='entry'?'entry-lightbox-status':'learning-status'));return;}return submit(method,payments);};squareSyncWalletButtons(stage,button);
  }catch{if(method){squareWalletMethods.delete(method);await method.destroy().catch(()=>{});}if(alive()){el.hidden=true;region.hidden=!region.querySelector('[data-square-wallet-action]:not([hidden])');}}
 };
 await Promise.allSettled([register('applePay'),register('googlePay')]);
}
