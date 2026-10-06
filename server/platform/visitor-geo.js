export function visitorLocation(headers,onVercel=false){
 if(!onVercel)return null;
 const country=headers.get('x-vercel-ip-country')||'';if(!/^[A-Z]{2}$/.test(country))return null;
 let city='';try{city=decodeURIComponent(headers.get('x-vercel-ip-city')||'');}catch{}
 if(city.length>70||!/^[\p{L}\p{M}\p{N} .,'’()-]*$/u.test(city))city='';
 return {country,city:city||null};
}
