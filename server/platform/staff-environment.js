// Environment selection is server-owned. No request field can select a schema or storage namespace.
export const staffEnvironment=env=>env.VERCEL_ENV==='preview'?'sandbox':env.VERCEL_ENV==='production'&&env.SQUARE_ENVIRONMENT!=='sandbox'?'live':null;
export const staffOrigins=env=>staffEnvironment(env)==='sandbox'?['goddessvanessa-git-square-sandbox-system-admin.vercel.app']:['houseofvanessa.com','www.houseofvanessa.com','goddessvanessa.vercel.app','goddessvanessa-git-main-system-admin.vercel.app'];
