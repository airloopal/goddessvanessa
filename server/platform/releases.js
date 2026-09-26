export const release={version:'2026.09.26.1',date:'2026-09-26',title:'Status centre & site identity'};
export const changelog=[
 {...release,changes:['Added a branded favicon and home-screen icon.','Added an owner-only status centre with connection checks, recent server issues and a downloadable diagnostic report.','Added this dated release history.']},
 {version:'95fd2be',date:'2026-09-26',title:'Admin-issued student access',changes:['Students can apply and request verification without email sign-in.','Only Vanessa can issue or replace chat access codes.','Removed student self-service code emails; admin sign-in stays separate.']},
 {version:'9290a58',date:'2026-09-26',title:'Contracts & application settings',changes:['Contract names, GBP rates, questions and options share the same settings with the backend.','Added a publish review and validation for prices and options.','Saved agreements keep their original details; changed applications require a fresh review.']},
 {version:'b8d3354',date:'2026-09-26',title:'Vercel & Supabase migration',changes:['Moved hosting to Vercel with GitHub deployments.','Connected the private database and file storage.','Preserved the application, dashboard, access-code chat and visual editors.']}
];
